import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);
const PUBLIC_ROOT = path.resolve(process.cwd());

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, message) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(message),
  });
  res.end(message);
}

function resolvePublicPath(urlPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }

  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolvedPath = path.resolve(PUBLIC_ROOT, relativePath);
  const insideRoot = resolvedPath === PUBLIC_ROOT || resolvedPath.startsWith(`${PUBLIC_ROOT}${path.sep}`);

  return insideRoot ? resolvedPath : null;
}

async function serveStatic(req, res, pathname) {
  const filePath = resolvePublicPath(pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  if (!fileStat.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "content-type": mimeTypes.get(ext) || "application/octet-stream",
    "content-length": fileStat.size,
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  };

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method || "")) {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "eyebloom-gallery" });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`eyebloom gallery listening on http://${HOST}:${PORT}`);
});
