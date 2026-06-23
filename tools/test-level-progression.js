"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadBrowserSystem(relativePath, globals = {}) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    ...globals
  });
  context.window = context.window || {};
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
  return context;
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    read(key) {
      return values.get(key);
    }
  };
}

function createProgression(saved = {}) {
  const storage = createStorage({
    "breachline-progression-v1": JSON.stringify(saved)
  });
  const context = loadBrowserSystem("systems/progression-system.js", {
    localStorage: storage
  });
  const progression = context.window.ProgressionSystem.create({
    runtime: {},
    elements: {}
  });
  return { progression, storage };
}

const levels = [
  { id: "level-one", title: "Level One" },
  { id: "level-two", title: "Level Two" },
  { id: "level-three", title: "Level Three" },
  { id: "level-four", title: "Level Four" }
];

function testFreshProgressUnlocksOnlyFirstLevel() {
  const { progression } = createProgression();
  progression.syncLevelUnlocks(levels);
  assert.strictEqual(progression.isLevelUnlocked("level-one"), true);
  assert.strictEqual(progression.isLevelUnlocked("level-two"), false);
}

function testMigrationGrandfathersCompletedLevelsAndSuccessors() {
  const { progression } = createProgression({
    completedLevels: ["level-three"],
    completedTutorials: [],
    unlockedLevels: ["missing-level"]
  });
  progression.syncLevelUnlocks(levels);
  assert.deepStrictEqual(
    Array.from(progression.snapshot().unlockedLevels),
    ["level-one", "level-three", "level-four"]
  );
}

function testMissionCompletionPersistsNextUnlock() {
  const { progression, storage } = createProgression();
  progression.syncLevelUnlocks(levels);
  progression.recordMission(levels[0], {});
  assert.strictEqual(progression.isLevelUnlocked("level-two"), true);
  const saved = JSON.parse(storage.read("breachline-progression-v1"));
  assert.deepStrictEqual(saved.completedLevels, ["level-one"]);
  assert.deepStrictEqual(saved.unlockedLevels, ["level-one", "level-two"]);
}

function testExplicitUnlockSurvivesSyncWhenStillValid() {
  const { progression } = createProgression({
    completedLevels: [],
    unlockedLevels: ["level-three"]
  });
  progression.syncLevelUnlocks(levels);
  assert.strictEqual(progression.isLevelUnlocked("level-three"), true);
}

function testSourceContainsCentralGuardAndResultVisibility() {
  const levelSource = fs.readFileSync(path.join(root, "systems/level-system.js"), "utf8");
  const missionSource = fs.readFileSync(path.join(root, "systems/mission-system.js"), "utf8");
  assert.match(levelSource, /isLevelUnlocked\(storyMeta\.id\)/);
  assert.match(levelSource, /Level Locked/);
  assert.match(missionSource, /nextLevelButton\.classList\.toggle\("hidden", result !== "success"\)/);
}

async function testLockedLevelRejectsBeforeFetchOrRuntimeMutation() {
  let fetchCalls = 0;
  const context = loadBrowserSystem("systems/level-system.js", {
    fetch: async () => {
      fetchCalls += 1;
      throw new Error("fetch should not run");
    }
  });
  const runtime = {
    currentLevelMeta: { id: "existing-level" },
    activeMode: "level"
  };
  const classList = {
    add() {},
    remove() {}
  };
  const system = context.window.LevelSystem.create({
    runtime,
    elements: {
      bannerTitle: { textContent: "" },
      bannerText: { textContent: "" },
      banner: { classList }
    },
    world: {},
    defaultWorld: { w: 960, h: 640 },
    levelOptions: levels,
    tutorialOptions: [],
    tempLevelOptions: [],
    progression: {
      isLevelUnlocked(id) {
        return id === "level-one";
      }
    }
  });
  const loaded = await system.loadLevel("level-three");
  assert.strictEqual(loaded, false);
  assert.strictEqual(fetchCalls, 0);
  assert.strictEqual(runtime.currentLevelMeta.id, "existing-level");
}

function testSfxGainIsExactlyOnePointOneTimesPreviousValue() {
  const mainSource = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.match(mainSource, /volume:\s*0\.605/);
  assert.match(mainSource, /loopVolume:\s*0\.374/);
}

const tests = [
  testFreshProgressUnlocksOnlyFirstLevel,
  testMigrationGrandfathersCompletedLevelsAndSuccessors,
  testMissionCompletionPersistsNextUnlock,
  testExplicitUnlockSurvivesSyncWhenStillValid,
  testSourceContainsCentralGuardAndResultVisibility,
  testLockedLevelRejectsBeforeFetchOrRuntimeMutation,
  testSfxGainIsExactlyOnePointOneTimesPreviousValue
];

async function run() {
  for (const test of tests) {
    await test();
    console.log(`PASS ${test.name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
