import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import getRawBody from "raw-body";

const endpoint = "/__course_compass/transcript-preprocess";
const supportedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localAddresses = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);

function interpreter() {
  if (process.env.COURSE_COMPASS_PYTHON) return process.env.COURSE_COMPASS_PYTHON;
  if (process.platform !== "win32") return "python3";
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    const directory = entry.replace(/^"|"$/g, "");
    if (!directory || /windowsapps/i.test(directory)) continue;
    const candidate = join(directory, "python.exe");
    if (existsSync(candidate)) return candidate;
  }
  return "python.exe";
}

function preprocess(script, body, rotation, logger) {
  return new Promise((resolve, reject) => {
    const args = ["-B", script, ...(rotation === null ? [] : [rotation])];
    const child = execFile(interpreter(), args, {
      windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, OPENCV_IO_MAX_IMAGE_PIXELS: "64000000", OPENCV_LOG_LEVEL: "ERROR", PYTHONIOENCODING: "utf-8" },
    }, (error, stdout, stderr) => {
      if (error) {
        logger.warn(`OpenCV 前處理程式結束（${error.code ?? error.signal ?? "unknown"}）${stderr.trim().slice(-700)}`);
        if (error.code === "ENOENT" || stderr.includes("ModuleNotFoundError")) {
          reject(Object.assign(new Error("找不到 Python 或 OpenCV，請檢查本機 OCR 前處理設定。"), { statusCode: 503 }));
        } else if (stderr.includes("Invalid transcript image")) {
          reject(Object.assign(new Error("OpenCV 無法讀取這張成績單影像。"), { statusCode: 422 }));
        } else {
          reject(new Error("OpenCV 前處理失敗，請確認檔案可正常開啟。"));
        }
      } else resolve(stdout);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(body);
  });
}

export function transcriptPreprocess() {
  return {
    name: "course-compass-transcript-preprocess",
    apply: "serve",
    configureServer(server) {
      const script = join(server.config.root, "scripts", "transcript-preprocess.py");
      server.middlewares.use((request, response, next) => {
        const [pathname] = (request.url ?? "").split("?");
        if (pathname !== endpoint) return next();
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");

        const fail = (status, error) => {
          response.statusCode = status;
          response.end(JSON.stringify({ error }));
        };
        let authority;
        try {
          authority = new URL(`${request.socket.encrypted ? "https" : "http"}://${request.headers.host ?? "invalid"}`);
        } catch {
          return fail(403, "OpenCV 前處理僅供本機網站使用。");
        }
        const origin = request.headers.origin;
        if (!localHosts.has(authority.hostname) || !localAddresses.has(request.socket.remoteAddress)
          || (origin && origin !== authority.origin)) {
          return fail(403, "OpenCV 前處理僅供本機網站使用。");
        }
        if (request.method !== "POST") return fail(405, "請上傳要前處理的影像。");
        if (!supportedImages.has(request.headers["content-type"])) return fail(415, "不支援的成績單影像格式。");
        const rotation = new URL(request.url, authority).searchParams.get("rotation");
        if (rotation !== null && !["0", "90", "180", "270"].includes(rotation)) return fail(400, "不支援的旋轉角度。");
        void getRawBody(request, { limit: "16mb" })
          .then((body) => preprocess(script, body, rotation, server.config.logger))
          .then((result) => response.end(result))
          .catch((error) => {
            if (error.statusCode === 413) return fail(413, "成績單影像超過本機前處理的大小限制。");
            fail(error.statusCode ?? 500, error.message);
          });
      });
    },
  };
}
