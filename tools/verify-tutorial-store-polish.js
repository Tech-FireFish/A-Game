"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function parseJson(file) {
  return JSON.parse(read(file));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const main = read("main.js");
const index = read("index.html");
const styles = read("styles.css");
const progression = read("systems/progression-system.js");
const levelSystem = read("systems/level-system.js");
const actionSystem = read("systems/action-system.js");
const shootingSystem = read("systems/shooting-system.js");
const tutorialSystem = read("systems/tutorial-system.js");
const cameraSystem = read("systems/camera-system.js");
const pixelArt = read("css-pixel-art/store-pixel-art.js");
const weapon = parseJson("equipment/silenced-pistol.json");

assert(weapon.id === "silenced-pistol", "silenced pistol JSON must use id silenced-pistol");
assert(weapon.silent === true, "silenced pistol JSON must declare silent: true");
assert(weapon.shotSound === "silenced-shot", "silenced pistol JSON must map to silenced-shot");
assert(/id:\s*"silenced-pistol"/.test(main), "main.js must register silenced-pistol in options/catalog");
assert(/silenced-shot/.test(main), "main.js must register silenced-shot audio");
assert(/"silenced-pistol"/.test(pixelArt), "Store pixel art must define silenced-pistol");
assert(/option value="easy">Easy/.test(index), "index.html must expose Easy difficulty");
assert(/option value="medium">Medium/.test(index), "index.html must expose Medium difficulty");
assert(/option value="difficult">Difficult/.test(index), "index.html must expose Difficult difficulty");
assert(/completedTutorials/.test(progression), "progression must persist completedTutorials");
assert(/recordTutorial/.test(progression), "progression must expose tutorial completion recording");
assert(/allTutorialsComplete/.test(progression), "progression must expose all-tutorial completion");
assert(/randomEnemyPersonality/.test(levelSystem), "level clone must support difficult random personalities");
assert(/weapon\.silent/.test(actionSystem) || /silent/.test(shootingSystem), "shooting/combat must branch on silent weapons");
assert(/triggerShake/.test(cameraSystem), "camera system must expose triggerShake");
assert(/triggerOperatorCounterEffect/.test(actionSystem), "operator counterattack effect must be triggered from damage logic");
assert(/expanded-low-health/.test(styles), "styles must define expanded low health glow");
assert(/tutorialDialogue/.test(index), "index must include tutorial dialogue bar elements");
assert(/dismissTutorialDialogue/.test(tutorialSystem), "tutorial system must support dismissing dialogue");
assert(/tutorial-dialogue-bar/.test(styles), "styles must define tutorial dialogue bar");

console.log("tutorial/store polish contract verified");
