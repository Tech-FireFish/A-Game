"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mission = fs.readFileSync(path.join(root, "systems", "mission-system.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const activeHtml = html.replace(/<!--[\s\S]*?-->/g, "");

assert.match(html, /Legacy mission result backup/);
assert.match(html, /id="banner" class="banner mission-result-board hidden"/);
assert.strictEqual((activeHtml.match(/id="banner"/g) || []).length, 1);
assert.strictEqual((activeHtml.match(/id="missionReport"/g) || []).length, 1);
assert.strictEqual((activeHtml.match(/id="resultLevelSelect"/g) || []).length, 1);

assert.match(mission, /Legacy renderMissionReport template backup/);
assert.match(mission, /mission-report-tile mission-report-score/);
assert.match(mission, /mission-report-tile mission-report-enemies/);
assert.match(mission, /mission-report-tile mission-report-complexity/);
assert.match(mission, /mission-report-tile mission-report-status/);

assert.match(css, /Legacy mission result CSS backup/);
assert.match(css, /#banner\.mission-result-board/);
assert.match(css, /\.mission-report-score/);
assert.match(css, /\.mission-report-status/);
assert.match(css, /@media \(max-width: 620px\)/);

console.log("PASS mission result board source contract");
