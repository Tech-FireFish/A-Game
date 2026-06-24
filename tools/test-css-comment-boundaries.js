"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

assert.strictEqual(
  (css.match(/Legacy mission result CSS backup:/g) || []).length,
  1,
  "only the small, independently bounded legacy result backup should remain"
);
assert.match(withoutComments, /\.hidden\s*\{\s*display:\s*none;\s*\}/);
assert.match(
  withoutComments,
  /#banner\.mission-result-board\.hidden\s*\{\s*display:\s*none\s*!important;\s*\}/
);
assert.match(withoutComments, /@media\s*\(max-width:\s*1050px\)/);
assert.match(withoutComments, /body\.pixel-style-geometry \.settings-panel\s*\{/);
assert.match(withoutComments, /\.weapon-pixel-art-rifle \.weapon-pixel-cell:is\(/);
assert.match(withoutComments, /body\.pixel-style-geometry select\s*\{\s*appearance:\s*none;/);

assert.match(css, /\/\*\s*Geometry weapon group disabled\.[\s\S]*?\.weapon-geometry-none[\s\S]*?\*\//);
assert.doesNotMatch(withoutComments, /\.banner-actions button\s*\{\s*border:\s*0;/);
assert.doesNotMatch(withoutComments, /\.result-level-picker select\s*\{\s*min-height:\s*48px;/);
assert.doesNotMatch(withoutComments, /\.mission-report div\s*\{\s*border:\s*0;/);

console.log("PASS CSS comment boundaries and restored UI rules");
