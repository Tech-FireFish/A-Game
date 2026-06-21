"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "demo");
const INLINE_STYLE_SOURCES = new Set([
  "styles.css",
  "css-pixel-art/css-pixel-art.css"
]);
const MIRRORED_ASSET_DIRS = [
  "docs",
  "sounds",
  "level",
  "tutorials",
  "equipment",
  "css-pixel-art"
];

function main() {
  const indexFile = path.join(ROOT, "index.html");
  let html = fs.readFileSync(indexFile, "utf8");
  html = inlineStyles(html);
  html = removeMobileControls(html);

  const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((match) => match[1].split("?")[0])
    .filter((source) => !source.startsWith("mobile/"));
  const inlineScripts = [
    demoDataScript(),
    demoDesktopShimScript(),
    ...scriptSources.map((source) => inlineScript(source))
  ].join("\n");
  html = html.replace(/(?:\s*<script src="[^"]+"><\/script>)+\s*$/m, `\n${inlineScripts}\n`);

  fs.mkdirSync(DEMO_DIR, { recursive: true });
  syncDemoAssets();
  removeDemoRecycle();
  fs.writeFileSync(path.join(DEMO_DIR, "index.html"), html);
  console.log("Rebuilt demo/index.html as an inline standalone file.");
}

function inlineStyles(html) {
  return html.replace(/\s*<link rel="stylesheet" href="([^"]+)">/g, (tag, href) => {
    const source = href.split("?")[0];
    if (source.startsWith("mobile/")) return "";
    if (INLINE_STYLE_SOURCES.has(source)) return `\n${inlineStyle(source)}`;
    return tag;
  });
}

function inlineStyle(source) {
  const css = fs.readFileSync(path.join(ROOT, source), "utf8");
  return `<style>\n${css}\n</style>`;
}

function inlineScript(source) {
  let js = fs.readFileSync(path.join(ROOT, source), "utf8");
  if (source === "main.js") {
    js = js.replace(
      /const response = await fetch\("\/api\/levels", \{ cache: "no-store" \}\);/,
      "const response = await window.__demoLevelManifestRequest();"
    );
  }
  js = js.replace(/\bfetch\(/g, "window.__demoDataRequest(");
  return `    <script data-inline-source="${source}">\n${js}\n    </script>`;
}

function removeMobileControls(html) {
  return html.replace(/\n    <div id="mobileControls" class="mobile-controls hidden"[\s\S]*?\n    <\/div>(?=\n    <section id="endSequenceOverlay")/, "");
}

function syncDemoAssets() {
  for (const dir of MIRRORED_ASSET_DIRS) {
    mirrorDir(path.join(ROOT, dir), path.join(DEMO_DIR, dir));
  }
}

function mirrorDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mirrorDir(source, target);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

function removeDemoRecycle() {
  fs.rmSync(path.join(DEMO_DIR, "recycle"), { recursive: true, force: true });
}

function demoDesktopShimScript() {
  return `    <script data-inline-source="desktop-demo-shims">
window.ObjectScaleSystem = {
  create(deps) {
    return {
      update() { return 1; },
      objectScale() { return 1; },
      scaledRadius(obj) { return Number(obj && obj.radius) || 0; },
      scaledRect(rect) { return rect; },
      scaledRectVisual(rect) { return rect; },
      scaledCircle(circle) { return circle; },
      scaledPointRectDistance(point, rect) { return deps.pointRectDistance(point, rect); },
      scaleHitboxes() { return false; }
    };
  }
};
window.MobileControlSystem = {
  create() {
    return { bindEvents() {} };
  }
};
    </script>`;
}

function demoDataScript() {
  const levels = collectJson("level");
  const tutorials = collectJson("tutorials");
  const equipment = collectJson("equipment");
  const data = {
    levels,
    tutorials,
    temp: {},
    equipment
  };
  const levelManifest = Object.keys(levels)
    .filter((key) => key.startsWith("level/"))
    .sort()
    .map((file) => {
      const level = levels[file] || {};
      return {
        id: level.id || path.basename(file, ".json"),
        title: level.title || titleFromFile(file),
        file
      };
    });
  return `    <script data-inline-source="demo-data">\nwindow.DemoData = ${JSON.stringify(data)};\nwindow.__demoLevelManifestRequest = async function demoLevelManifestRequest() {\n  return demoResponse({ levels: ${JSON.stringify(levelManifest)} });\n};\nwindow.__demoDataRequest = async function demoDataRequest(file) {\n  const key = String(file || \"\").replace(/^\\.\\//, \"\");\n  const stores = [window.DemoData.levels, window.DemoData.tutorials, window.DemoData.temp, window.DemoData.equipment];\n  for (const store of stores) {\n    if (store[key]) return demoResponse(store[key]);\n    const found = Object.values(store).find((item) => item && (item.id === key || item.file === key));\n    if (found) return demoResponse(found);\n  }\n  return { ok: false, status: 404, json: async function () { return null; } };\n};\nfunction demoResponse(data) {\n  return { ok: true, status: 200, json: async function () { return JSON.parse(JSON.stringify(data)); } };\n}\n    </script>`;
}

function collectJson(folder) {
  const dir = path.join(ROOT, folder);
  const result = {};
  for (const file of fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".json")).sort()) {
    const rel = `${folder}/${file}`;
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    result[rel] = data;
    if (data.id) result[data.id] = data;
  }
  return result;
}

function titleFromFile(file) {
  return path.basename(file, ".json")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Level";
}

main();
