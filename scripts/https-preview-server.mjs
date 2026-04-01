import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { extname, join, normalize } from "node:path";
import process from "node:process";

const host = process.env.HTTPS_HOST || "0.0.0.0";
const port = Number(process.env.HTTPS_PORT || "4443");
const distDir = process.env.DIST_DIR || "dist";
const pfxPath = process.env.HTTPS_PFX_PATH;
const pfxPassphrase = process.env.HTTPS_PFX_PASSPHRASE || "";

if (!pfxPath) {
  console.error("Missing HTTPS_PFX_PATH");
  process.exit(1);
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".ico", "image/x-icon"],
]);

function resolveFilePath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const normalizedPath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(distDir, normalizedPath);

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  return join(distDir, "index.html");
}

const server = createSecureServer(
  {
    allowHTTP1: true,
    pfx: await readFile(pfxPath),
    passphrase: pfxPassphrase,
  },
  (req, res) => {
    const requestUrl = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    const filePath = resolveFilePath(requestUrl.pathname);
    const contentType = mimeTypes.get(extname(filePath)) || "application/octet-stream";

    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=300",
    });

    createReadStream(filePath).pipe(res);
  },
);

server.listen(port, host, () => {
  console.log(`HTTPS preview running on https://${host}:${port}`);
});
