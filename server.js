"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 4700;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon"
};

const CACHEABLE_EXTENSIONS = new Set([".css", ".js", ".wav", ".ttf", ".png"]);
const LEVEL_MANIFEST = scanLevelManifest();

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (path.basename(filePath).toLowerCase() === "index.html") return "no-store";
  if (ext === ".json") return "no-store";
  if (CACHEABLE_EXTENSIONS.has(ext)) return "public, max-age=3600";
  return "no-store";
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function scanLevelManifest() {
  const levelDir = path.join(ROOT, "level");
  if (!fs.existsSync(levelDir)) return [];
  return fs.readdirSync(levelDir)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const filePath = path.join(levelDir, file);
      const id = path.basename(file, ".json");
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return {
          id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : id,
          title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : titleFromSlug(id),
          file: `level/${file}`
        };
      } catch (error) {
        console.warn(`Skipping invalid level JSON ${path.relative(ROOT, filePath)}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function titleFromSlug(value) {
  return String(value || "level")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Level";
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const requestPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, normalizedPath);
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  const requestUrl = req.url || "/";
  if (requestUrl.split("?")[0] === "/api/levels") {
    const body = JSON.stringify({ levels: LEVEL_MANIFEST });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(req.method === "HEAD" ? "" : body);
    return;
  }

  const filePath = resolveRequestPath(requestUrl);

  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControlFor(filePath)
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    fs.createReadStream(filePath)
      .on("error", () => send(res, 500, "Server error"))
      .pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Breachline 2D server running at http://${HOST}:${PORT}/`);
});
