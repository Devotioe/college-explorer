/// <reference types="vite/client" />

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { findNccuTranscriptColumns, gridWidth, transcriptBrightnessCurve, transcriptInkContrast, type TranscriptGridColumn } from "./nccu-transcript-grid";
import type { TranscriptRow } from "./transcript-review";
import {
  completeTranscriptRowCount, needsUncutTranscriptRetry, preferTranscriptScanRetry, transcriptScanCrops, transcriptScanRotations,
  type ScanColumn, type ScanRotation, type TranscriptScanLayout,
} from "./transcript-scan-layout";

const maxPageEdge = 2700;
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

async function requestScan(form: FormData) {
  const response = await fetch("/api/ocr/transcript", { method: "POST", body: form });
  const data = await response.json().catch(() => null) as {
    rows?: TranscriptRow[]; discardedPageText?: number; layout?: TranscriptScanLayout | null; error?: string;
  } | null;
  if (!response.ok || !data) throw new Error(data?.error ?? "成績單辨識失敗");
  return data;
}

async function findLayout(page: HTMLCanvasElement) {
  const form = new FormData();
  form.append("mode", "layout");
  for (const rotation of transcriptScanRotations) {
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
  const { rows, discardedPageText } = await requestScan(form);
  if (!Array.isArray(rows)) throw new Error("OCR 沒有回傳可讀取的課程資料");
  return { rows, discardedPageText: discardedPageText ?? 0 };
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

function prepareNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number) {
  const scale = 4;
  const gutter = 60;
  const headerHeight = column.headerHeight;
  const stripHeight = Math.round(column.rowHeight * scale);
  const rowHeight = stripHeight + 8;
  const width = (column.right - column.left) * scale;
  const { canvas, context } = makeCanvas(width + gutter, headerHeight * scale + column.lines.length * rowHeight);
  const scaleX = page.width / gridWidth;
  const scaleY = page.height / gridHeight;
  function drawStrip(top: number, height: number, y: number, header = false) {
    const targetHeight = Math.round(height * scale);
    context.drawImage(page, column.left * scaleX, top * scaleY, (column.right - column.left) * scaleX,
      height * scaleY, gutter, y, width, targetHeight);
    const pixels = context.getImageData(gutter, y, width, targetHeight);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const red = pixels.data[i];
      const green = pixels.data[i + 1];
      const blue = pixels.data[i + 2];
      const luminance = red * .299 + green * .587 + blue * .114;
      const level = header ? luminance : (luminance + Math.max(red, green, blue)) / 2;
      const blackPoint = header ? 156 : 139;
      const value = Math.min(255, Math.max(0, (level - blackPoint) * 255 / (246 - blackPoint)));
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    }
    context.putImageData(pixels, gutter, y);
  }
  drawStrip(column.headerTop, headerHeight, 0, true);
  context.font = "bold 25px sans-serif";
  for (const [index, { line, center }] of column.lines.entries()) {
    const y = headerHeight * scale + index * rowHeight;
    drawStrip(center - column.rowHeight / 2, column.rowHeight, y + 4);
    context.fillStyle = "#10283f";
    context.fillText(String(line).padStart(2, "0"), 12, y + 41);
    context.fillStyle = "#d3dae2";
    context.fillRect(0, y, canvas.width, 1);
  }
  return canvas;
}

async function recognizeNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number) {
  const image = prepareNccuColumn(page, column, gridHeight);
  const form = new FormData();
  form.append("mode", "grid");
  try {
    form.append("file", await jpeg(image, .96), "nccu-year-column.jpg");
  } finally {
    image.width = image.height = 0;
  }
  form.append("slots", JSON.stringify(column.lines.map(({ line, upper, lower }) => ({ line, upper, lower }))));
  return readColumn(form);
}

async function recognizeIntactNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, gridHeight: number,
  treatment: "original" | "brighten" | "remove-watermark" = "original") {
  const crop = cropPage(page, {
    left: Math.floor(column.left * 1000 / gridWidth), right: Math.ceil(column.right * 1000 / gridWidth),
    top: Math.floor(Math.max(0, column.headerTop - 8) * 1000 / gridHeight),
    bottom: Math.floor(column.bodyBottom * 1000 / gridHeight), expectedRows: null,
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
    const gray = grayscale(pixels.data);
    const tileSize = Math.max(32, Math.round(48 * crop.width / (column.right - column.left)));
    const ink = transcriptInkContrast(gray, crop.width, tileSize);
    for (let i = 0; i < ink.length; i++) {
      const tone = Math.max(0, 255 - Math.max(0, ink[i] - 18) * 4);
      pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = tone;
    }
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
      const landscape = page.width >= page.height;
      const ratio = Math.max(page.width, page.height) / Math.min(page.width, page.height);
      const gridRotations = landscape ? [0, 180] as const : [90, 270] as const;
      let usedGrid = false;
      if (ratio >= 1.25 && ratio <= 3.8) {
        for (const rotation of gridRotations) {
          const upright = rotatePage(page, rotation, maxPageEdge);
          const { columns, height, cleaned } = identifyNccuGrid(upright);
          if (columns) {
            const pageRows: TranscriptRow[] = [];
            const pageWarnings: string[] = [];
            for (const [index, column] of columns.entries()) {
              const expected = column.lines.reduce((count, { upper, lower }) => count + Number(upper) + Number(lower), 0);
              if (!expected && !cleaned) continue;
              const label = `${pageLabel}第 ${index + 1} 欄`;
              progress(cleaned ? `正在淡化${label}的浮水印並辨識原始欄位…` : `正在逐列辨識${label}…`);
              const reading = cleaned ? await recognizeIntactNccuColumn(upright, column, height, "remove-watermark")
                : await recognizeNccuColumn(upright, column, height);
              let columnRows = reading.rows;
              if (cleaned && !completeTranscriptRowCount(columnRows)) {
                progress(`正在調亮${label}的原始影像並重讀…`);
                let retry = await recognizeIntactNccuColumn(upright, column, height, "brighten").catch(() => null);
                if (!retry || !completeTranscriptRowCount(retry.rows)) {
                  retry = await recognizeIntactNccuColumn(upright, column, height).catch(() => null) ?? retry;
                }
                if (retry && (completeTranscriptRowCount(retry.rows) || preferTranscriptScanRetry(columnRows, retry.rows))) {
                  columnRows = retry.rows;
                }
              }
              if (!cleaned && needsUncutTranscriptRetry(columnRows, expected, reading.discardedPageText)) {
                progress(`正在重新辨識${label}的原始欄位…`);
                const retry = await recognizeIntactNccuColumn(upright, column, height).catch(() => null);
                if (retry) {
                  const before = completeTranscriptRowCount(columnRows);
                  const after = completeTranscriptRowCount(retry.rows);
                  const anchors = columnRows.filter((row) => row.courseName && row.gradeRaw && !row.requiresOcrReview);
                  if ((after > before && preferTranscriptScanRetry(anchors, retry.rows))
                    || (after > 0 && after === before && reading.discardedPageText > 0 && !retry.discardedPageText
                      && preferTranscriptScanRetry(anchors, retry.rows))) {
                    columnRows = retry.rows;
                  }
                }
                if (needsUncutTranscriptRetry(columnRows, expected, 0)) {
                  pageWarnings.push(`${label}的欄位讀取不完整，請對照原檔確認是否有漏列或錯位。`);
                }
              }
              if (cleaned && columnRows.length && !completeTranscriptRowCount(columnRows)) {
                pageWarnings.push(`${label}沒有辨識到完整的課名和成績，請對照原檔。`);
              }
              const blanks = columnRows.filter((row) => row.requiresOcrReview && (!row.courseName || !row.gradeRaw)).length;
              if (blanks) pageWarnings.push(`${label}有 ${blanks} 筆課名或成績待核對，請比對原檔。`);
              pageRows.push(...columnRows.filter(({ courseName, courseCode, gradeRaw, credits }) => courseName || courseCode || gradeRaw || credits !== null));
            }
            if (completeTranscriptRowCount(pageRows) > 0) {
              warnings.push(...pageWarnings);
              rows.push(...pageRows);
              usedGrid = true;
            }
          }
          if (upright !== page) upright.width = upright.height = 0;
          if (usedGrid) break;
        }
      }
      if (usedGrid) {
        page.width = page.height = 0;
        continue;
      }
      const layout = await findLayout(page);
      const orientedPage = rotatePage(page, layout?.orientationConfirmed ? layout.rotation : 0, maxPageEdge);
      const crops = transcriptScanCrops(layout?.orientationConfirmed ? layout.columns : []);
      if (!crops[0].annual && crops[0].left === 0 && crops[0].top === 0 && crops[0].right === 1000 && crops[0].bottom === 1000) {
        warnings.push(`${pageLabel}無法確認方向或分欄位置，已按整頁辨識。請核對這一頁是否有漏列。`);
      }

      for (const [index, bounds] of crops.entries()) {
        const label = crops.length > 1 ? `${pageLabel}第 ${index + 1} 欄` : pageLabel;
        const crop = cropPage(orientedPage, bounds);
        const brightened = brightenTranscript(crop);
        try {
          progress(brightened ? `已調亮${label}，正在辨識科目與成績…` : `正在辨識${label}的科目與成績…`);
          const image = await jpeg(brightened ?? crop, .94);
          const reading = await recognize(image, bounds.annual ? "intact" : "column");
          let columnRows = reading.rows;
          const expected = bounds.expectedRows;
          const complete = completeTranscriptRowCount(columnRows);
          const hasGap = expected !== null && complete < expected;
          if (reading.discardedPageText > 0 || hasGap || (brightened && !complete)) {
            progress(`正在回查${label}可能漏掉的科目…`);
            const retryImage = brightened ? await jpeg(crop, .94) : image;
            const retry = await recognize(retryImage, bounds.annual ? "intact" : "retry").catch(() => null);
            if (retry && (preferTranscriptScanRetry(columnRows, retry.rows) || (!complete
              && completeTranscriptRowCount(retry.rows) > 0))) columnRows = retry.rows;
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
          if (brightened) brightened.width = brightened.height = 0;
          if (crop !== orientedPage) crop.width = crop.height = 0;
        }
      }
      if (orientedPage !== page) orientedPage.width = orientedPage.height = 0;
      page.width = page.height = 0;
    }
    if (!rows.some(({ courseCode, gradeRaw, credits }) => courseCode.trim() || gradeRaw.trim() || credits !== null)) {
      throw new Error("這份檔案沒有辨識到可核對的課程資料。請確認影像包含清楚的學年度、科目、學分與成績欄，再按開始 OCR。");
    }
    return { rows, warnings };
  } finally {
    await transcript.close();
  }
}
