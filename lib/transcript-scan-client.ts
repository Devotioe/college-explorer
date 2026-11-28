/// <reference types="vite/client" />

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { findNccuTranscriptColumns, gridWidth, transcriptBrightnessCurve, transcriptGridBatches, transcriptGridCellId, transcriptGridFields, transcriptGridSummaryBounds, transcriptInkContrast, type TranscriptGridColumn } from "./nccu-transcript-grid";
import { applyTranscriptTitleCorrections, consolidateTranscriptSummaries, type TranscriptRow, type TranscriptSemesterSummary, type TranscriptTitleCorrection } from "./transcript-review";
import {
  completeTranscriptRowCount, hasIncompleteGridReading, hasTranscriptRowEvidence, keepReadableTranscriptGridLines,
  reconcileNumberedTranscriptGrades, reconcileNumberedTranscriptTitles, reconcileTranscriptScanRetry, transcriptScanCrops, transcriptScanRotations,
  type ScanColumn, type ScanRotation, type TranscriptScanLayout,
} from "./transcript-scan-layout";

const maxPageEdge = 3600;
const types = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
type RenderedTranscript = { pageCount: number; render: (page: number) => Promise<HTMLCanvasElement>; close: () => Promise<void> };

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("瀏覽器無法處理成績單影像");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

async function openTranscript(file: File): Promise<RenderedTranscript> {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise.catch(async (error: unknown) => {
      await task.destroy().catch(() => {});
      throw error;
    });
    return {
      pageCount: pdf.numPages,
      async render(pageNumber) {
        const page = await pdf.getPage(pageNumber);
        try {
          const original = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: maxPageEdge / Math.max(original.width, original.height) });
          const { canvas } = makeCanvas(viewport.width, viewport.height);
          await page.render({ canvas, viewport }).promise;
          return canvas;
        } finally {
          page.cleanup();
        }
      },
      close: () => task.destroy(),
    };
  }

  const bitmap = await createImageBitmap(file);
  return {
    pageCount: 1,
    async render() {
      const scale = Math.min(1, maxPageEdge / Math.max(bitmap.width, bitmap.height));
      const { canvas, context } = makeCanvas(bitmap.width * scale, bitmap.height * scale);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    },
    async close() { bitmap.close(); },
  };
}

function rotatePage(source: HTMLCanvasElement, degrees: ScanRotation, maxEdge: number) {
  if (!degrees && Math.max(source.width, source.height) <= maxEdge) return source;
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = source.width * scale;
  const height = source.height * scale;
  const sideways = degrees === 90 || degrees === 270;
  const { canvas, context } = makeCanvas(sideways ? height : width, sideways ? width : height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(degrees * Math.PI / 180);
  context.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

function cropPage(page: HTMLCanvasElement, bounds: ScanColumn) {
  const left = Math.round(page.width * bounds.left / 1000);
  const right = Math.round(page.width * bounds.right / 1000);
  const top = Math.round(page.height * bounds.top / 1000);
  const bottom = Math.round(page.height * bounds.bottom / 1000);
  const width = right - left;
  const height = bottom - top;
  if (width === page.width && height === page.height) return page;
  const scale = Math.max(1, Math.min(1.35, 1600 / Math.max(width, height)));
  const { canvas, context } = makeCanvas(width * scale, height * scale);
  context.imageSmoothingQuality = "high";
  context.drawImage(page, left, top, width, height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function jpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("無法產生成績單的辨識影像"));
  }, "image/jpeg", quality));
}

const localPreprocessEndpoint = "/__course_compass/transcript-preprocess";

function usesLocalOpenCv() {
  return import.meta.env?.DEV && ["localhost", "127.0.0.1", "[::1]"].includes(globalThis.location?.hostname);
}

function decodedJpeg(data: string) {
  return new Blob([Uint8Array.from(atob(data), (character) => character.charCodeAt(0))], { type: "image/jpeg" });
}

async function canvasFromImage(image: Blob) {
  const bitmap = await createImageBitmap(image);
  try {
    const { canvas, context } = makeCanvas(bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

async function prepareWithOpenCv(source: Blob, rotation?: ScanRotation) {
  const url = rotation === undefined ? localPreprocessEndpoint : `${localPreprocessEndpoint}?rotation=${rotation}`;
  const response = await fetch(url, { method: "POST", body: source });
  const result = await response.json().catch(() => null) as {
    original: string; enhanced: string; columns: TranscriptGridColumn[] | null; height: number;
    previews?: string[]; error?: string;
  } | null;
  if (!response.ok || !result?.original || !result.enhanced) throw new Error(result?.error ?? "無法使用本機 OpenCV 前處理。");
  const sourceImage = decodedJpeg(result.original);
  const [original, enhanced] = await Promise.all([canvasFromImage(sourceImage), canvasFromImage(decodedJpeg(result.enhanced))]);
  return { original, enhanced, sourceImage, columns: result.columns, height: result.height, previews: result.previews };
}

async function requestScan(form: FormData) {
  const response = await fetch("/api/ocr/transcript", { method: "POST", body: form });
  const data = await response.json().catch(() => null) as {
    rows?: TranscriptRow[]; discardedPageText?: number; summaries?: TranscriptSemesterSummary[];
    layout?: TranscriptScanLayout | null; error?: string;
  } | null;
  if (!response.ok || !data) throw new Error(data?.error ?? "成績單辨識失敗");
  return data;
}

async function findLayout(page: HTMLCanvasElement, previews?: string[]) {
  const form = new FormData();
  form.append("mode", "layout");
  for (const [index, rotation] of transcriptScanRotations.entries()) {
    if (previews?.[index]) {
      form.append("preview", decodedJpeg(previews[index]), `orientation-${rotation}.jpg`);
      continue;
    }
    const preview = rotatePage(page, rotation, 1100);
    const brightened = brightenTranscript(preview);
    try {
      form.append("preview", await jpeg(brightened ?? preview, .8), `orientation-${rotation}.jpg`);
    } finally {
      if (brightened) brightened.width = brightened.height = 0;
      if (preview !== page) preview.width = preview.height = 0;
    }
  }
  return (await requestScan(form)).layout ?? null;
}

async function recognize(file: Blob, mode: "column" | "retry" | "intact") {
  const form = new FormData();
  form.append("file", file, "course-column.jpg");
  form.append("mode", mode);
  return readColumn(form);
}

async function readColumn(form: FormData) {
  const { rows, discardedPageText, summaries } = await requestScan(form);
  if (!Array.isArray(rows)) throw new Error("OCR 沒有回傳可讀取的課程資料");
  return { rows, discardedPageText: discardedPageText ?? 0, summaries: summaries ?? [] };
}

async function correctCourseTitles(rows: TranscriptRow[]) {
  const titles = rows.filter(({ courseName }) => courseName.trim())
    .map(({ id, sourceLine, courseName, term, credits }) => ({ id, sourceLine, courseName, term, credits }));
  if (!titles.length) return rows;
  const response = await fetch("/api/ocr/transcript/course-titles", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(titles),
  });
  if (!response.ok) throw new Error("無法配對課名");
  const { corrections } = await response.json() as { corrections: TranscriptTitleCorrection[] };
  return applyTranscriptTitleCorrections(rows, corrections);
}

function grayscale(data: Uint8ClampedArray) {
  const gray = new Uint8Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(data[i * 4] * .299 + data[i * 4 + 1] * .587 + data[i * 4 + 2] * .114);
  return gray;
}

function brightenTranscript(source: HTMLCanvasElement) {
  const pixels = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);
  const gray = grayscale(pixels.data);
  const curve = transcriptBrightnessCurve(gray);
  if (!curve) return null;
  for (let i = 0; i < gray.length; i++) {
    const tone = curve[gray[i]];
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = tone;
  }
  const { canvas, context } = makeCanvas(source.width, source.height);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function identifyNccuGrid(page: HTMLCanvasElement) {
  const height = Math.round(page.height * gridWidth / page.width);
  const { canvas, context } = makeCanvas(gridWidth, height);
  context.drawImage(page, 0, 0, gridWidth, height);
  const gray = grayscale(context.getImageData(0, 0, gridWidth, height).data);
  canvas.width = canvas.height = 0;
  return { ...findNccuTranscriptColumns(gray), height };
}

function removeTranscriptWatermark(pixels: ImageData, tileSize: number) {
  const ink = transcriptInkContrast(grayscale(pixels.data), pixels.width, tileSize);
  for (let i = 0; i < ink.length; i++) {
    const tone = Math.max(0, 255 - Math.max(0, ink[i] - 18) * 4);
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = tone;
  }
}

type GridBatch = ReturnType<typeof transcriptGridBatches>[number];
type GridField = ReturnType<typeof transcriptGridFields>[number] | { field: "rows"; left: number; right: number };
type GridTreatment = "cleaned" | "contrast" | "original" | "whole-rows";

function prepareNccuField(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number,
  batch: GridBatch, { field, left, right }: GridField, treatment: GridTreatment, enhanced?: HTMLCanvasElement) {
  const header = field === "titles" || field === "rows";
  const lines = field === "upper" || field === "lower" ? batch.lines.filter((line) => line[field]) : batch.lines;
  if (!lines.length) return null;
  const continuation = header ? batch.continuation : undefined;
  const scale = 5;
  const gutter = 84;
  const width = (right - left - 2) * scale;
  const headerHeight = header ? Math.round(column.headerHeight * width / (column.right - column.left)) : 0;
  const rowHeight = Math.round(column.rowHeight * scale) + 10;
  const { canvas, context } = makeCanvas(width + gutter, headerHeight + (lines.length + Number(Boolean(continuation))) * rowHeight);
  context.imageSmoothingQuality = "high";
  const scaleX = page.width / gridWidth;
  const scaleY = page.height / gridHeight;
  const source = treatment === "original" || treatment === "whole-rows" ? page : enhanced ?? page;
  function enhance(y: number, targetHeight: number) {
    if (enhanced || treatment === "original" || treatment === "whole-rows") return;
    const pixels = context.getImageData(gutter, y, width, targetHeight);
    if (treatment === "cleaned") {
      removeTranscriptWatermark(pixels, 48 * scale);
      context.putImageData(pixels, gutter, y);
      return;
    }
    for (let i = 0; i < pixels.data.length; i += 4) {
      const red = pixels.data[i];
      const green = pixels.data[i + 1];
      const blue = pixels.data[i + 2];
      const luminance = red * .299 + green * .587 + blue * .114;
      const level = (luminance + Math.max(red, green, blue)) / 2;
      const value = Math.min(255, Math.max(0, (level - 139) * 255 / (246 - 139)));
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    }
    context.putImageData(pixels, gutter, y);
  }
  if (header) {
    context.drawImage(page, column.left * scaleX, column.headerTop * scaleY, (column.right - column.left) * scaleX,
      column.headerHeight * scaleY, gutter, 0, width, headerHeight);
  }
  function drawLine(center: number, y: number) {
    const targetHeight = rowHeight - 10;
    context.drawImage(source, (left + 1) * scaleX, (center - column.rowHeight / 2) * scaleY, (right - left - 2) * scaleX,
      column.rowHeight * scaleY, gutter, y + 5, width, targetHeight);
    enhance(y + 5, targetHeight);
  }
  context.font = "bold 30px sans-serif";
  for (const [index, { line, center, upperCenter, lowerCenter }] of lines.entries()) {
    const y = headerHeight + index * rowHeight;
    drawLine(field === "upper" ? upperCenter : field === "lower" ? lowerCenter : center, y);
    context.fillStyle = "#10283f";
    const label = field === "upper" || field === "lower" ? String(transcriptGridCellId(line, field)) : String(line).padStart(2, "0");
    context.fillText(label, 12, y + Math.round(rowHeight * .68));
    context.fillStyle = "#d3dae2";
    context.fillRect(0, y, canvas.width, 1);
  }
  if (continuation) drawLine(continuation.center, headerHeight + lines.length * rowHeight);
  return canvas;
}

async function recognizeNccuBatch(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number,
  batch: GridBatch, treatment: GridTreatment, includeSummary = false, enhanced?: HTMLCanvasElement) {
  const form = new FormData();
  const wholeRows = treatment === "whole-rows";
  form.append("mode", wholeRows ? "grid" : "grid-cells");
  const fields: readonly GridField[] = wholeRows ? [{ field: "rows", left: column.left, right: column.right }] : transcriptGridFields(column);
  for (const region of fields) {
    const image = prepareNccuField(page, column, gridHeight, batch, region, treatment, enhanced);
    if (!image) continue;
    try {
      form.append(region.field === "upper" || region.field === "lower" ? region.field : "file", await jpeg(image, .96), `${region.field}.jpg`);
    } finally {
      image.width = image.height = 0;
    }
  }
  form.append("slots", JSON.stringify(batch.lines.map(({ line, upper, lower }) => ({ line, upper, lower }))));
  const bounds = includeSummary ? transcriptGridSummaryBounds(column, gridHeight) : null;
  if (bounds) {
    const footer = cropPage(page, bounds);
    try {
      form.append("footer", await jpeg(footer, .96), "semester-summary.jpg");
    } finally {
      if (footer !== page) footer.width = footer.height = 0;
    }
  }
  return readColumn(form);
}

async function recognizeNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number, cleaned: boolean,
  enhanced?: HTMLCanvasElement) {
  const batches = transcriptGridBatches(column.lines);
  const readings = await Promise.all(batches.map(async (batch, index) => {
    const reading = await recognizeNccuBatch(page, column, gridHeight, batch, cleaned ? "cleaned" : "contrast", index === batches.length - 1, enhanced);
    if (!reading.rows.some((row) => row.requiresTitleReview || row.requiresOcrReview)) return reading;
    const readableLines = new Set(reading.rows.filter(hasTranscriptRowEvidence).map(({ scanLine }) => scanLine));
    const missing = new Set(reading.rows.filter((row) => row.requiresOcrReview && (!row.courseName || !row.gradeRaw || row.credits === null))
      .map((row) => row.scanLine));
    const retryBatches = readableLines.size && missing.size ? transcriptGridBatches(batch.lines, 3) : [batch];
    const last = retryBatches.at(-1);
    if (last) last.continuation ??= batch.continuation;
    const wideLines = new Set<number>();
    const retry = await Promise.all(retryBatches.filter(({ lines }) => !missing.size || lines.some(({ line }) => missing.has(line)))
      .map((part) => {
        const wholeRows = !part.lines.some(({ line }) => readableLines.has(line));
        if (wholeRows) part.lines.forEach(({ line }) => wideLines.add(line));
        return recognizeNccuBatch(page, column, gridHeight, part, wholeRows ? "whole-rows" : "original").catch(() => null);
      }));
    const extraRows = retry.flatMap((part) => part?.rows ?? []);
    if (!extraRows.length) return reading;
    const titled = reconcileNumberedTranscriptTitles(reading.rows, extraRows);
    const recovered = reconcileNumberedTranscriptGrades(titled, extraRows).map((row) => row.scanLine !== undefined
      && wideLines.has(row.scanLine) && row.gradeRaw ? { ...row, requiresOcrReview: true as const } : row);
    return { ...reading, rows: recovered };
  }));
  return {
    rows: readings.flatMap((reading) => reading.rows),
    discardedPageText: readings.reduce((sum, reading) => sum + reading.discardedPageText, 0),
    summaries: readings.flatMap((reading) => reading.summaries),
  };
}

async function recognizeIntactNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number,
  treatment: "original" | "brighten" | "remove-watermark" = "original") {
  const summary = transcriptGridSummaryBounds(column, gridHeight);
  const crop = cropPage(page, {
    left: Math.floor(column.left * 1000 / gridWidth), right: Math.ceil(column.right * 1000 / gridWidth),
    top: Math.floor(Math.max(0, column.headerTop - 8) * 1000 / gridHeight),
    bottom: Math.max(summary?.bottom ?? 0, Math.floor(column.bodyBottom * 1000 / gridHeight)), expectedRows: null,
  });
  try {
    if (treatment !== "remove-watermark") {
      const brightened = treatment === "brighten" ? brightenTranscript(crop) : null;
      try {
        return await recognize(await jpeg(brightened ?? crop, .96), "intact");
      } finally {
        if (brightened) brightened.width = brightened.height = 0;
      }
    }
    const context = crop.getContext("2d")!;
    const pixels = context.getImageData(0, 0, crop.width, crop.height);
    const tileSize = Math.max(32, Math.round(48 * crop.width / (column.right - column.left)));
    removeTranscriptWatermark(pixels, tileSize);
    context.putImageData(pixels, 0, 0);
    const scale = Math.max(1, Math.min(3, 1550 / Math.max(crop.width, crop.height)));
    const enlarged = makeCanvas(crop.width * scale, crop.height * scale);
    try {
      enlarged.context.imageSmoothingQuality = "high";
      enlarged.context.drawImage(crop, 0, 0, enlarged.canvas.width, enlarged.canvas.height);
      return await recognize(await jpeg(enlarged.canvas, .96), "intact");
    } finally {
      enlarged.canvas.width = enlarged.canvas.height = 0;
    }
  } finally {
    if (crop !== page) crop.width = crop.height = 0;
  }
}

export async function scanTranscript(file: File, progress: (message: string) => void) {
  if (!types.has(file.type)) throw new Error("只支援 PDF、JPG、PNG 或 WebP");
  if (file.size > 10 * 1024 * 1024) throw new Error("檔案不可超過 10 MB");

  const warnings: string[] = [];
  const rows: TranscriptRow[] = [];
  const summaries: TranscriptSemesterSummary[] = [];
  const localOpenCv = usesLocalOpenCv();
  const unreadable = "瀏覽器無法開啟這份檔案，請把裁切後的課程表另存為 JPG 或 PNG 再試。";

  progress("正在開啟成績單…");
  const transcript = await openTranscript(file).catch(() => null);
  if (!transcript) throw new Error(unreadable);

  try {
    for (let pageNumber = 1; pageNumber <= transcript.pageCount; pageNumber++) {
      const pageLabel = `第 ${pageNumber} 頁`;
      progress(`正在判斷${pageLabel}的方向與欄位…`);
      const page = await transcript.render(pageNumber).catch(() => null);
      if (!page && pageNumber === 1) throw new Error(unreadable);
      if (!page) {
        warnings.push(`${pageLabel}無法開啟，請依原檔補上該頁的科目。`);
        continue;
      }
      if (localOpenCv) progress(`正在用 OpenCV 校正${pageLabel}…`);
      const local = localOpenCv ? await prepareWithOpenCv(file.type === "application/pdf" ? await jpeg(page, .98) : file) : null;
      const base = local?.original ?? page;
      const landscape = base.width >= base.height;
      const ratio = Math.max(base.width, base.height) / Math.min(base.width, base.height);
      const gridRotations = landscape ? [0, 180] as const : [90, 270] as const;
      let usedGrid = false;
      if (local ? local.columns : ratio >= 1.25 && ratio <= 3.8) {
        for (const rotation of local ? [0] as const : gridRotations) {
          const upright = local ? base : rotatePage(base, rotation, maxPageEdge);
          const { columns, height, cleaned } = local
            ? { columns: local.columns, height: local.height, cleaned: false }
            : identifyNccuGrid(upright);
          if (columns) {
            const pageRows: TranscriptRow[] = [];
            const pageWarnings: string[] = [];
            const pageSummaries: TranscriptSemesterSummary[] = [];
            for (const [index, column] of columns.entries()) {
              const expected = column.lines.reduce((count, { upper, lower }) => count + Number(upper) + Number(lower), 0);
              const numbered = expected > 0;
              const label = `${pageLabel}第 ${index + 1} 欄`;
              progress(numbered ? `正在逐列辨識${label}…` : `正在補讀${label}的原始欄位…`);
              const reading = numbered ? await recognizeNccuColumn(upright, column, height, cleaned, local?.enhanced)
                : await recognizeIntactNccuColumn(local?.enhanced ?? upright, column, height, cleaned ? "remove-watermark" : "original");
              let columnRows = reading.rows;
              pageSummaries.push(...reading.summaries);
              if (numbered) {
                const trimmed = keepReadableTranscriptGridLines(columnRows);
                columnRows = trimmed.rows;
                if (!columnRows.length) {
                  progress(`正在用原始整欄影像補讀${label}…`);
                  const retry = await recognizeIntactNccuColumn(upright, column, height).catch(() => null);
                  if (retry && completeTranscriptRowCount(retry.rows)) {
                    columnRows = retry.rows.filter(hasTranscriptRowEvidence).map((row) => ({ ...row, requiresOcrReview: true }));
                    if (!reading.summaries.length) pageSummaries.push(...retry.summaries);
                    pageWarnings.push(`${label}由原始整欄影像補讀，請對照原檔核對學期。`);
                  }
                }
                if (trimmed.unreadableLines && columnRows.every(({ scanLine }) => scanLine !== undefined)) {
                  pageWarnings.push(`${label}有 ${trimmed.unreadableLines} 列的課名和成績均未讀到，請對照原檔補登。`);
                }
              }
              if (!numbered && !completeTranscriptRowCount(columnRows)) {
                progress(`正在調亮${label}的原始影像並重讀…`);
                let retry = await recognizeIntactNccuColumn(upright, column, height, local ? "original" : "brighten").catch(() => null);
                if (cleaned && (!retry || !completeTranscriptRowCount(retry.rows))) {
                  retry = await recognizeIntactNccuColumn(upright, column, height).catch(() => null) ?? retry;
                }
                if (retry) {
                  columnRows = reconcileTranscriptScanRetry(columnRows, retry.rows);
                  if (!reading.summaries.length) pageSummaries.push(...retry.summaries);
                }
              }
              if (numbered && hasIncompleteGridReading(columnRows, expected, reading.discardedPageText)) {
                pageWarnings.push(`${label}有欄位讀取不完整，請對照原檔確認學期及成績。`);
              }
              if (!numbered) {
                pageWarnings.push(columnRows.length
                  ? `${label}由整欄影像補讀，請對照原檔核對學期。`
                  : `${label}補讀後仍未辨識到科目，請確認原檔是否有資料。`);
              }
              const pending = columnRows.filter((row) => row.requiresOcrReview || row.requiresTitleReview).length;
              if (pending) pageWarnings.push(`${label}有 ${pending} 筆辨識結果待核對，請比對原檔。`);
              pageRows.push(...columnRows);
            }
            if (completeTranscriptRowCount(pageRows) > 0 || pageRows.some(({ scanLine }) => scanLine !== undefined)) {
              warnings.push(...pageWarnings);
              rows.push(...pageRows);
              summaries.push(...pageSummaries);
              usedGrid = true;
            }
          }
          if (upright !== base) upright.width = upright.height = 0;
          if (usedGrid) break;
        }
      }
      if (usedGrid) {
        page.width = page.height = 0;
        if (local) {
          local.original.width = local.original.height = 0;
          local.enhanced.width = local.enhanced.height = 0;
        }
        continue;
      }
      const layout = await findLayout(base, local?.previews);
      const rotation = layout?.orientationConfirmed ? layout.rotation : 0;
      const oriented = local && rotation ? await prepareWithOpenCv(local.sourceImage, rotation) : local;
      const orientedPage = oriented?.original ?? rotatePage(base, rotation, maxPageEdge);
      const enhancedPage = oriented?.enhanced;
      const crops = transcriptScanCrops(layout?.orientationConfirmed ? layout.columns : []);
      if (!crops[0].annual && crops[0].left === 0 && crops[0].top === 0 && crops[0].right === 1000 && crops[0].bottom === 1000) {
        warnings.push(`${pageLabel}無法確認方向或分欄位置，已按整頁辨識。請核對這一頁是否有漏列。`);
      }

      for (const [index, bounds] of crops.entries()) {
        const label = crops.length > 1 ? `${pageLabel}第 ${index + 1} 欄` : pageLabel;
        const crop = cropPage(orientedPage, bounds);
        const brightened = enhancedPage ? cropPage(enhancedPage, bounds) : brightenTranscript(crop);
        try {
          progress(brightened ? `已調亮${label}，正在辨識科目與成績…` : `正在辨識${label}的科目與成績…`);
          const image = await jpeg(brightened ?? crop, .94);
          const reading = await recognize(image, bounds.annual ? "intact" : "column");
          summaries.push(...reading.summaries);
          if (bounds.annual && reading.rows.length) {
            warnings.push(`${label}無法獨立定位上下學期欄位，請對照原檔核對學期。`);
          }
          let columnRows = reading.rows;
          const expected = bounds.expectedRows;
          const complete = completeTranscriptRowCount(columnRows);
          const hasGap = expected !== null && complete < expected;
          if (reading.discardedPageText > 0 || hasGap || (brightened && !complete)
            || columnRows.some((row) => row.requiresOcrReview)) {
            progress(`正在回查${label}可能漏掉的科目…`);
            const retryImage = brightened ? await jpeg(crop, .94) : image;
            const retry = await recognize(retryImage, bounds.annual ? "intact" : "retry").catch(() => null);
            if (retry) {
              columnRows = reconcileTranscriptScanRetry(columnRows, retry.rows);
              if (!reading.summaries.length) summaries.push(...retry.summaries);
            }
            const after = completeTranscriptRowCount(columnRows);
            if (expected !== null && after < expected) {
              warnings.push(`${label}辨識到 ${after} 筆完整成績，版面估計約有 ${expected} 筆。請對照原檔補上漏列。`);
            }
          }
          if (!columnRows.length) {
            warnings.push(`${label}沒有辨識到科目，請對照原檔。`);
          }
          rows.push(...columnRows);
        } finally {
          if (brightened && brightened !== enhancedPage) brightened.width = brightened.height = 0;
          if (crop !== orientedPage) crop.width = crop.height = 0;
        }
      }
      if (orientedPage !== base) orientedPage.width = orientedPage.height = 0;
      if (enhancedPage) enhancedPage.width = enhancedPage.height = 0;
      if (local) {
        local.original.width = local.original.height = 0;
        local.enhanced.width = local.enhanced.height = 0;
      }
      page.width = page.height = 0;
    }
    if (!rows.some(({ courseCode, gradeRaw, credits }) => courseCode.trim() || gradeRaw.trim() || credits !== null)) {
      throw new Error("這份檔案沒有辨識到可核對的課程資料。請確認影像包含清楚的學年度、科目、學分與成績欄，再按開始 OCR。");
    }
    progress("正在用政大課程資料配對課名…");
    const corrected = await correctCourseTitles(rows).catch(() => {
      warnings.push("課名自動配對暫時無法使用，請核對 OCR 課名。");
      return rows;
    });
    return { rows: corrected, warnings, summaries: consolidateTranscriptSummaries(summaries) };
  } finally {
    await transcript.close();
  }
}
