/// <reference types="vite/client" />

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { gridHeight, gridRowHeight, gridWidth, readNccuTranscriptGrid, type TranscriptGridColumn } from "./nccu-transcript-grid";
import { normalizeTranscriptAcademicYear, type TranscriptRow } from "./transcript-review";
import {
  preferTranscriptScanRetry, transcriptScanCrops, transcriptScanRotations,
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
    rows?: TranscriptRow[]; layout?: TranscriptScanLayout | null; error?: string;
  } | null;
  if (!response.ok || !data) throw new Error(data?.error ?? "成績單辨識失敗");
  return data;
}

async function findLayout(page: HTMLCanvasElement) {
  const form = new FormData();
  form.append("mode", "layout");
  for (const rotation of transcriptScanRotations) {
    const preview = rotatePage(page, rotation, 1100);
    form.append("preview", await jpeg(preview, .8), `orientation-${rotation}.jpg`);
    if (preview !== page) preview.width = preview.height = 0;
  }
  return (await requestScan(form)).layout ?? null;
}

async function recognize(file: Blob, earliestYear: string, mode: "column" | "retry" | "", name = "course-column.jpg") {
  const form = new FormData();
  form.append("file", file, name);
  if (mode) form.append("mode", mode);
  if (earliestYear) form.append("earliestYear", earliestYear);
  const { rows } = await requestScan(form);
  if (!Array.isArray(rows)) throw new Error("OCR 沒有回傳可讀取的課程資料");
  return rows;
}

function identifyNccuGrid(page: HTMLCanvasElement) {
  const { canvas, context } = makeCanvas(gridWidth, gridHeight);
  context.drawImage(page, 0, 0, gridWidth, gridHeight);
  const { data } = context.getImageData(0, 0, gridWidth, gridHeight);
  const gray = new Uint8Array(gridWidth * gridHeight);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(data[i * 4] * .299 + data[i * 4 + 1] * .587 + data[i * 4 + 2] * .114);
  canvas.width = canvas.height = 0;
  return readNccuTranscriptGrid(gray);
}

function prepareNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn) {
  const scale = 4;
  const gutter = 60;
  const headerHeight = 50;
  const rowHeight = gridRowHeight * scale + 8;
  const width = (column.right - column.left) * scale;
  const { canvas, context } = makeCanvas(width + gutter, headerHeight * scale + column.lines.length * rowHeight);
  const scaleX = page.width / gridWidth;
  const scaleY = page.height / gridHeight;
  function drawStrip(top: number, height: number, y: number, header = false) {
    context.drawImage(page, column.left * scaleX, top * scaleY, (column.right - column.left) * scaleX,
      height * scaleY, gutter, y, width, height * scale);
    const pixels = context.getImageData(gutter, y, width, height * scale);
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
    drawStrip(center - 7, gridRowHeight, y + 4);
    context.fillStyle = "#10283f";
    context.fillText(String(line).padStart(2, "0"), 12, y + 41);
    context.fillStyle = "#d3dae2";
    context.fillRect(0, y, canvas.width, 1);
  }
  return canvas;
}

async function recognizeNccuColumn(page: HTMLCanvasElement, column: TranscriptGridColumn, earliestYear: string) {
  const image = prepareNccuColumn(page, column);
  const form = new FormData();
  form.append("mode", "grid");
  form.append("file", await jpeg(image, .96), "nccu-year-column.jpg");
  image.width = image.height = 0;
  form.append("slots", JSON.stringify(column.lines.map(({ line, upper, lower }) => ({ line, upper, lower }))));
  if (earliestYear) form.append("earliestYear", earliestYear);
  const { rows } = await requestScan(form);
  if (!Array.isArray(rows)) throw new Error("OCR 沒有回傳可讀取的課程資料");
  return rows;
}

export async function scanTranscript(file: File, earliestYear: string, progress: (message: string) => void) {
  if (!types.has(file.type)) throw new Error("只支援 PDF、JPG、PNG 或 WebP");
  if (file.size > 10 * 1024 * 1024) throw new Error("檔案不可超過 10 MB");
  if (earliestYear && !normalizeTranscriptAcademicYear(earliestYear)) throw new Error("請輸入有效的最早學年度，例如 110。");

  const warnings: string[] = [];
  const rows: TranscriptRow[] = [];
  const wholeFile = async () => ({
    rows: await recognize(file, earliestYear, "", file.name),
    warnings: ["瀏覽器無法分頁處理這份檔案，已用整份檔案辨識。請開啟原檔核對是否有漏列。"],
  });

  progress("正在開啟成績單…");
  const transcript = await openTranscript(file).catch(() => null);
  if (!transcript) return wholeFile();

  try {
    for (let pageNumber = 1; pageNumber <= transcript.pageCount; pageNumber++) {
      const pageLabel = `第 ${pageNumber} 頁`;
      progress(`正在判斷${pageLabel}的方向與欄位…`);
      const page = await transcript.render(pageNumber).catch(() => null);
      if (!page && pageNumber === 1) return wholeFile();
      if (!page) {
        warnings.push(`${pageLabel}無法開啟，請依原檔補上該頁的科目。`);
        continue;
      }
      const landscape = page.width >= page.height;
      const ratio = Math.max(page.width, page.height) / Math.min(page.width, page.height);
      const gridRotations = landscape ? [0, 180] as const : [90, 270] as const;
      let usedGrid = false;
      if (ratio >= 1.34 && ratio <= 1.48) {
        for (const rotation of gridRotations) {
          const upright = rotatePage(page, rotation, maxPageEdge);
          const grid = identifyNccuGrid(upright);
          if (grid) {
            for (const [index, column] of grid.entries()) {
              if (!column.lines.some(({ upper, lower }) => upper || lower)) continue;
              const label = `${pageLabel}第 ${index + 1} 欄`;
              progress(`正在逐列辨識${label}…`);
              const columnRows = await recognizeNccuColumn(upright, column, earliestYear);
              const blanks = columnRows.filter((row) => row.requiresOcrReview && (!row.courseName || !row.gradeRaw)).length;
              if (blanks) warnings.push(`${label}有 ${blanks} 筆課名或成績待核對，請比對原檔。`);
              rows.push(...columnRows);
            }
            usedGrid = true;
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
      if (crops[0].left === 0 && crops[0].top === 0 && crops[0].right === 1000 && crops[0].bottom === 1000) {
        warnings.push(`${pageLabel}無法確認方向或分欄位置，已按整頁辨識。請核對這一頁是否有漏列。`);
      }

      for (const [index, bounds] of crops.entries()) {
        const label = crops.length > 1 ? `${pageLabel}第 ${index + 1} 欄` : pageLabel;
        progress(`正在辨識${label}的科目與成績…`);
        const crop = cropPage(orientedPage, bounds);
        const image = await jpeg(crop, .94);
        if (crop !== orientedPage) crop.width = crop.height = 0;
        let columnRows = await recognize(image, earliestYear, "column");
        if (bounds.expectedRows !== null && columnRows.length < bounds.expectedRows) {
          progress(`正在回查${label}可能漏掉的科目…`);
          const retry = await recognize(image, earliestYear, "retry").catch(() => []);
          if (preferTranscriptScanRetry(columnRows, retry)) columnRows = retry;
          if (columnRows.length < bounds.expectedRows) {
            warnings.push(`${label}辨識到 ${columnRows.length} 筆成績，版面估計約有 ${bounds.expectedRows} 筆。請對照原檔補上漏列。`);
          }
        } else if (!columnRows.length) {
          warnings.push(`${label}沒有辨識到科目，請對照原檔。`);
        }
        rows.push(...columnRows);
      }
      if (orientedPage !== page) orientedPage.width = orientedPage.height = 0;
      page.width = page.height = 0;
    }
    return { rows, warnings };
  } finally {
    await transcript.close();
  }
}
