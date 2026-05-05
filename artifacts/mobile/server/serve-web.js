/**
 * Simple static HTTP server for the Expo web build (dist/).
 * Serves the SPA with index.html fallback for client-side routing.
 *
 * BASE_PATH handling: Expo's `experiments.baseUrl` (set to "/app" in app.json)
 * makes the build emit asset references like "/app/_expo/static/js/foo.js",
 * but the physical files are at "dist/_expo/static/js/foo.js" (no /app prefix
 * on disk). The shared proxy does NOT rewrite paths, so requests arrive here
 * with the full "/app/..." prefix. We strip it before resolving to disk.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
const port = parseInt(process.env.PORT || "18115", 10);

// Normalize BASE_PATH to a leading-slash, no-trailing-slash form (e.g. "/app").
// Falls back to "/app" because that matches app.json `experiments.baseUrl`.
function normalizeBase(raw) {
  let b = (raw || "/app").trim();
  if (!b.startsWith("/")) b = "/" + b;
  // Collapse repeated trailing slashes (e.g. "/app//" → "/app")
  while (b.length > 1 && b.endsWith("/")) b = b.slice(0, -1);
  return b === "/" ? "" : b;
}
const BASE = normalizeBase(process.env.BASE_PATH);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
  ".map":  "application/json",
  ".webp": "image/webp",
  ".mp4":  "video/mp4",
};

if (!fs.existsSync(DIST_ROOT)) {
  console.error("ERROR: dist/ folder not found. Run 'pnpm run build:web' first.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let urlPath = new URL(req.url || "/", `http://localhost`).pathname;

  // Strip BASE prefix so on-disk lookups don't include it. Accept both
  // "/app" and "/app/..." forms; everything else (e.g. "/healthz") passes
  // through unchanged so health checks still work.
  if (BASE && (urlPath === BASE || urlPath.startsWith(BASE + "/"))) {
    urlPath = urlPath.slice(BASE.length) || "/";
  }

  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(DIST_ROOT, safePath);

  // Security: stay inside dist/
  if (!filePath.startsWith(DIST_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // Directory → try index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  // File doesn't exist → SPA fallback to root index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_ROOT, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  // Cache static assets aggressively; HTML never cached
  const isHtml = ext === ".html";
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": isHtml ? "no-store" : "public, max-age=31536000, immutable",
  });
  res.end(fs.readFileSync(filePath));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`KItchenOS web app running on port ${port} (base=${BASE || "/"})`);
});
