"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "systems", "keybinding-system.js"), "utf8");
const tutorial = JSON.parse(fs.readFileSync(path.join(root, "tutorials", "basics-movement.json"), "utf8"));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    snapshot(key) {
      return values.has(key) ? JSON.parse(values.get(key)) : null;
    }
  };
}

function createSystem(storage) {
  const context = {
    localStorage: storage,
    window: {},
    console
  };
  vm.runInNewContext(source, context, { filename: "systems/keybinding-system.js" });
  return context.window.KeybindingSystem.create({
    elements: {
      keyBindingList: { innerHTML: "" }
    }
  });
}

const freshStorage = createStorage();
const fresh = createSystem(freshStorage);
assert.strictEqual(fresh.bindings.sneak.value, "AltLeft");
assert.strictEqual(fresh.bindings.sneak.display, "Left Alt");
assert.strictEqual(fresh.matches({ code: "AltLeft", key: "Alt" }, "sneak"), true);
assert.strictEqual(fresh.matches({ code: "ControlLeft", key: "Control" }, "sneak"), false);

const migratedStorage = createStorage({
  "breachline-keybindings-v2": JSON.stringify({
    moveUp: { label: "Move Up", value: "ArrowUp", display: "ArrowUp" },
    sneak: { label: "Sneak", value: "KeyZ", display: "Z" }
  })
});
const migrated = createSystem(migratedStorage);
assert.strictEqual(migrated.bindings.moveUp.value, "ArrowUp");
assert.strictEqual(migrated.bindings.sneak.value, "AltLeft");
assert.strictEqual(migrated.bindings.sneak.display, "Left Alt");
assert.strictEqual(migratedStorage.snapshot("breachline-keybindings-v3").sneak.value, "AltLeft");

migrated.capture("sneak", { code: "KeyZ", key: "z" });
assert.strictEqual(migratedStorage.snapshot("breachline-keybindings-v3").sneak.value, "KeyZ");
const reloaded = createSystem(migratedStorage);
assert.strictEqual(reloaded.bindings.sneak.value, "KeyZ");

reloaded.capture("sneak", { code: "AltRight", key: "Alt" });
assert.strictEqual(reloaded.bindings.sneak.display, "Right Alt");

reloaded.reset();
assert.strictEqual(reloaded.bindings.sneak.value, "AltLeft");
assert.strictEqual(reloaded.bindings.sneak.display, "Left Alt");

const sneakStep = tutorial.tutorialSteps.find((step) => step.id === "sneak");
assert.ok(sneakStep);
assert.match(sneakStep.text, /Left Alt/);
assert.doesNotMatch(sneakStep.text, /Ctrl|Control/);

console.log("PASS Sneak defaults, migration, remapping, reset, and tutorial copy");
