"use strict";

(function () {
  // Builds level loading, cloning, restart, and level navigation helpers.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;
    const world = deps.world;

    // Creates a fresh playable runtime state for a level definition.
    function createGameState(level) {
      const firstOperator = level.operators[0];
      const state = {
        running: false,
        gameOver: false,
        result: null,
        debug: false,
        selectedId: firstOperator ? firstOperator.id : null,
        message: "Review mission status, then press Finish.",
        shootingMode: runtime.state ? runtime.state.shootingMode || "automatic" : "automatic",
        shots: [],
        enemyDownCount: 0,
        combatAlertActive: false,
        combatAlertPoint: null,
        combatAlertTriggeredAt: 0,
        tutorial: null,
        cameraHack: {
          started: false,
          revealedCameras: new Set(),
          revealedZones: new Set(),
          discoveredZones: new Set()
        },
        level: cloneLevel(level)
      };
      injectMissionHealItem(state.level);
      grantStoreMissionItems(state.level);
      return state;
    }

    // Deep-enough clones level data and applies current operator/enemy loadouts.
    function cloneLevel(level) {
      const maxOperators = Math.max(1, Math.min(runtime.activeOperatorCount, level.operators.length));
      const levelWeaponLoadouts = deps.equipment.currentLevelWeaponLoadouts();
      const levelArmorLoadouts = deps.equipment.currentLevelArmorLoadouts();
      const levelPersonalityLoadouts = deps.equipment.currentLevelPersonalityLoadouts ? deps.equipment.currentLevelPersonalityLoadouts() : {};
      return {
        id: level.id,
        title: level.title,
        sceneSource: level.sceneSource ? clonePlain(level.sceneSource) : null,
        requireObjective: Boolean(level.requireObjective),
        width: level.width || deps.defaultWorld.w,
        height: level.height || deps.defaultWorld.h,
        floorZones: (level.floorZones || []).map((zone) => ({ ...zone })),
        rooms: (level.rooms || []).map((room) => ({ ...room })),
        labels: (level.labels || []).map((label) => ({ ...label })),
        tutorialSteps: (level.tutorialSteps || []).map((step) => ({ ...step })),
        cameras: (level.cameras || []).map((camera) => ({ ...camera })),
        laptops: (level.laptops || []).map((laptop) => ({ ...laptop })),
        walls: level.walls.map((wall) => ({ ...wall })),
        windows: (level.windows || []).map((win) => ({ ...win, state: win.state || "closed" })),
        stairs: (level.stairs || []).map((stair) => ({ ...stair, target: stair.target ? { ...stair.target } : null })),
        items: buildItems(level),
        equipmentTables: (level.equipmentTables || []).map((table) => ({ ...table })),
        doors: buildDoors(level),
        operators: level.operators.slice(0, maxOperators).map((op) => {
          const useSavedLoadout = !level.forceLoadouts;
          const storeDefaults = deps.storeLoadoutDefaults ? deps.storeLoadoutDefaults() : {};
          const armorId = deps.equipment.validArmorId((useSavedLoadout && deps.operatorArmorLoadouts[op.id]) || (useSavedLoadout && storeDefaults.armorId) || op.armorId || "light-armor");
          const backpackId = deps.equipment.validBackpackId((useSavedLoadout && deps.operatorBackpackLoadouts[op.id]) || (useSavedLoadout && storeDefaults.backpackId) || op.backpackId || "no-backpack");
          const armor = deps.equipment.armorById(armorId);
          const backpack = deps.equipment.backpackById(backpackId);
          const baseSpeed = op.speed || 92;
          const unit = {
            ...op,
            kind: "operator",
            radius: deps.unitRadius,
            health: 100,
            armorId,
            armor: armor.armor,
            maxArmor: armor.armor,
            backpackId,
            baseSpeed,
            speed: baseSpeed * armor.speedMultiplier * (backpack.speedMultiplier || 1),
            spawn: { x: op.x, y: op.y, angle: op.angle || 0 },
            weaponId: deps.equipment.validWeaponId((useSavedLoadout && deps.operatorLoadouts[op.id]) || (useSavedLoadout && storeDefaults.weaponId) || op.weaponId || "rifle"),
            fireTimer: 0,
            path: [],
            aim: 0,
            action: null,
            reaction: 0,
            targetId: null,
            down: false,
            routeIndex: 0,
            movedBefore: false,
            floor: op.floor || "Floor 1",
            zone: op.zone || "Entry",
            inventory: {
              slots: backpack.slots,
              items: []
            }
          };
          deps.shooting.resetAmmo(unit);
          return unit;
        }),
        enemies: level.enemies.map((enemy) => {
          const useSavedLoadout = !level.forceLoadouts;
          const difficultRandom = runtime.currentDifficulty !== "easy" && useSavedLoadout;
          const difficultPersonalityRandom = runtime.currentDifficulty === "difficult" && useSavedLoadout;
          const weaponId = deps.equipment.validWeaponId(difficultRandom
            ? randomEnemyWeaponId()
            : ((useSavedLoadout && levelWeaponLoadouts[enemy.id]) || enemy.weaponId || "rifle"));
          const armorId = deps.equipment.validArmorId(difficultRandom
            ? randomEnemyArmorId()
            : ((useSavedLoadout && levelArmorLoadouts[enemy.id]) || enemy.armorId || "light-armor"));
          const armor = deps.equipment.armorById(armorId);
          const baseSpeed = enemy.speed || 34;
          return {
            ...enemy,
            watch: enemy.watch ? { ...enemy.watch } : null,
            radius: 12,
            health: 100,
            armorId,
            armor: armor.armor,
            maxArmor: armor.armor,
            baseSpeed,
            speed: baseSpeed * armor.speedMultiplier,
            weaponId,
            personality: deps.equipment.validEnemyPersonality
              ? deps.equipment.validEnemyPersonality(difficultPersonalityRandom
                ? randomEnemyPersonality()
                : ((useSavedLoadout && levelPersonalityLoadouts[enemy.id]) || enemy.personality || "calm"))
              : (difficultPersonalityRandom
                ? randomEnemyPersonality()
                : ((useSavedLoadout && levelPersonalityLoadouts[enemy.id]) || enemy.personality || "calm")),
            spawn: { x: enemy.x, y: enemy.y, angle: enemy.angle || 0 },
            fireTimer: 0,
            sightRange: enemy.sightRange || Math.max(190, deps.equipment.weaponById(weaponId).range),
            fov: Math.PI * 0.78,
            reaction: 0,
            targetId: null,
            down: false,
            respawnDelay: enemy.respawnDelay || 0,
            respawnTimer: 0,
            patrolIndex: 0,
            status: "calm",
            alertState: "calm",
            alertLocked: false,
            alertCooldown: 0,
            combatAlertActive: false,
            lastAlertTriggerAt: 0,
            algorithmAction: "",
            algorithmActionStartedAt: 0,
            algorithmActionUntil: 0,
            supportBoostUntil: 0,
            supportSourceEnemyId: "",
            retreatUntil: 0,
            retreatTeamCreditUntil: 0,
            lastKnownOperator: null,
            suspicionTimer: 0,
            searchTarget: null
          };
        }),
        objective: { ...level.objective }
      };
    }

    // Builds door clones and generates fresh digital passwords on every restart.
    function buildDoors(level) {
      const passwords = {};
      const doors = level.doors.map((door) => {
        const password = door.lockType === "digital" ? randomPassword() : door.password;
        if (door.lockType === "digital") passwords[door.id] = password;
        return {
          ...door,
          state: door.state || "closed",
          animProgress: door.state === "open" ? 1 : 0,
          animDirection: 0,
          animTimer: 0,
          animDuration: 0.2,
          hinge: door.hinge || (door.orientation === "vertical" ? "top" : "left"),
          password,
          locked: door.lockType === "digital" ? door.locked !== false : Boolean(door.locked)
        };
      });
      runtime.generatedPasswords = passwords;
      return doors;
    }

    // Builds item clones and injects paper clues for each generated digital door password.
    function buildItems(level) {
      const baseItems = (level.items || []).map((item) => ({ ...item, picked: false }));
      const digitalDoors = level.doors.filter((door) => door.lockType === "digital");
      return baseItems.map((item) => ({ ...item }));
    }

    // Clones nested plain JSON metadata without carrying object references across restarts.
    function clonePlain(value) {
      return JSON.parse(JSON.stringify(value));
    }

    // Applies generated passwords to paper notes after door generation.
    function syncPaperClues(stateLevel) {
      const doors = stateLevel.doors.filter((door) => door.lockType === "digital");
      for (const door of doors) {
        let paper = stateLevel.items.find((item) => item.type === "paper" && item.passwordFor === door.id);
        if (!paper) {
          const firstOp = stateLevel.operators[0] || { x: 80, y: 80 };
          paper = {
            id: `paper-${door.id}`,
            type: "paper",
            name: `${door.id} Code Paper`,
            x: firstOp.x + 20,
            y: firstOp.y - 42,
            w: 22,
            h: 18,
            passwordFor: door.id,
            picked: false
          };
          stateLevel.items.push(paper);
        }
        paper.text = `${door.id} code: ${door.password}`;
      }
    }

    // Adds one random medical pickup to each mission instance.
    function injectMissionHealItem(stateLevel) {
      if (!stateLevel || (stateLevel.items || []).some((item) => item.generatedHeal)) return;
      const rate = [10, 50, 100][Math.floor(Math.random() * 3)];
      const anchor = (stateLevel.items || []).find((item) => !item.picked)
        || (stateLevel.equipmentTables || [])[0]
        || (stateLevel.operators || [])[0]
        || { x: 80, y: 80 };
      stateLevel.items.push({
        id: `generated-heal-${rate}`,
        type: "healing",
        name: rate === 10 ? "Field Patch 10%" : (rate === 50 ? "Med Kit 50%" : "Trauma Kit 100%"),
        x: Math.max(24, Math.min((stateLevel.width || deps.defaultWorld.w) - 24, (anchor.x || 80) + 34)),
        y: Math.max(24, Math.min((stateLevel.height || deps.defaultWorld.h) - 24, (anchor.y || 80) + 22)),
        w: 20,
        h: 18,
        picked: false,
        generatedHeal: true,
        effect: "heal",
        healPercent: rate,
        consumable: true,
        quantity: 1,
        maxStack: 1,
        text: `Restores ${rate}% operator health.`
      });
    }

    // Adds owned Store utility items to operator backpacks when slots are free.
    function grantStoreMissionItems(stateLevel) {
      if (!deps.storeMissionItems) return;
      const items = deps.storeMissionItems();
      if (!items.length) return;
      for (const op of stateLevel.operators || []) {
        if (!op.inventory || !Array.isArray(op.inventory.items)) continue;
        for (const item of items) {
          const slotIndex = op.inventory.items.findIndex((slot) => !slot);
          if (slotIndex < 0) break;
          op.inventory.items[slotIndex] = { ...item };
        }
      }
    }

    // Generates a random four-digit digital lock password.
    function randomPassword() {
      return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    }

    // Picks a difficult-mode enemy weapon excluding no-weapon.
    function randomEnemyWeaponId() {
      const ids = ["rifle", "smg", "pistol", "silenced-pistol", "advanced-carbine", "compact-pdw", "marksman-pistol", "melee"]
        .filter((id) => deps.equipment.weaponById(id));
      return ids[Math.floor(Math.random() * ids.length)] || "rifle";
    }

    // Picks a difficult-mode enemy armor tier.
    function randomEnemyArmorId() {
      const ids = ["light-armor", "medium-armor", "heavy-armor"];
      return ids[Math.floor(Math.random() * ids.length)] || "light-armor";
    }

    // Picks a difficult-mode enemy personality.
    function randomEnemyPersonality() {
      const ids = ["aggressive", "calm", "loyal", "violent"];
      return ids[Math.floor(Math.random() * ids.length)] || "calm";
    }

    // Rebuilds the active level state and resets transient gameplay state.
    function restart() {
      if (!runtime.currentLevel) return;
      deps.keysDown.clear();
      runtime.state = createGameState(runtime.currentLevel);
      syncPaperClues(runtime.state.level);
      resizeWorld(runtime.state.level.width, runtime.state.level.height);
      runtime.lastTime = performance.now();
      elements.banner.classList.add("hidden");
      if (elements.exitTutorialButton) elements.exitTutorialButton.classList.add("hidden");
      if (runtime.activeMode !== "tutorial" && elements.tutorialCard) elements.tutorialCard.classList.add("hidden");
      elements.levelTitle.textContent = runtime.currentLevel.title || runtime.currentLevelMeta.title;
      if (deps.saveResumePoint && runtime.activeMode !== "preview") deps.saveResumePoint(runtime.currentLevelMeta, runtime.activeMode);
      if (deps.showMissionBriefing) deps.showMissionBriefing();
      deps.updateHud();
    }

    // Resizes the canvas and world dimensions to match the loaded level.
    function resizeWorld(width, height) {
      world.w = width || deps.defaultWorld.w;
      world.h = height || deps.defaultWorld.h;
      elements.canvas.style.aspectRatio = `${deps.defaultWorld.w} / ${deps.defaultWorld.h}`;
      if (deps.resizeCanvas) deps.resizeCanvas();
    }

    // Finds the active level index in the level option list.
    function currentLevelIndex() {
      return Math.max(0, deps.levelOptions.findIndex((level) => level.id === runtime.currentLevelMeta.id));
    }

    // Finds the active tutorial index in the tutorial option list.
    function currentTutorialIndex() {
      const options = deps.tutorialOptions || [];
      return Math.max(0, options.findIndex((level) => level.id === runtime.currentLevelMeta.id));
    }

    // Fills the level selector from the configured level list.
    function populateLevelSelect() {
      elements.levelSelect.innerHTML = "";
      for (const level of deps.levelOptions) {
        const option = document.createElement("option");
        option.value = level.id;
        option.textContent = level.title;
        elements.levelSelect.append(option);
      }
      if (!elements.tutorialSelect) return;
      elements.tutorialSelect.innerHTML = "<option value=\"\">Choose Tutorial</option>";
      for (const tutorial of deps.tutorialOptions || []) {
        const option = document.createElement("option");
        option.value = tutorial.id;
        option.textContent = tutorial.title;
        elements.tutorialSelect.append(option);
      }
      if (!elements.tempLevelSelect) return;
      elements.tempLevelSelect.innerHTML = "<option value=\"\">Choose Temporary Level</option>";
      for (const tempLevel of deps.tempLevelOptions || []) {
        const option = document.createElement("option");
        option.value = tempLevel.id;
        option.textContent = tempLevel.title;
        elements.tempLevelSelect.append(option);
      }
    }

    // Fetches a level JSON file and starts it when loading succeeds.
    async function loadLevel(levelId) {
      const storyMeta = deps.levelOptions.find((level) => level.id === levelId);
      const tutorialMeta = (deps.tutorialOptions || []).find((level) => level.id === levelId);
      const tempMeta = (deps.tempLevelOptions || []).find((level) => level.id === levelId);
      const meta = storyMeta || tutorialMeta || tempMeta || deps.levelOptions[0];
      runtime.currentLevelMeta = meta;
      runtime.activeMode = tutorialMeta ? "tutorial" : (tempMeta ? "temp" : "level");
      elements.levelSelect.value = storyMeta ? meta.id : "";
      if (elements.tutorialSelect) elements.tutorialSelect.value = tutorialMeta ? meta.id : "";
      if (elements.tempLevelSelect) elements.tempLevelSelect.value = tempMeta ? meta.id : "";
      elements.levelSelect.disabled = true;
      if (elements.tutorialSelect) elements.tutorialSelect.disabled = true;
      if (elements.tempLevelSelect) elements.tempLevelSelect.disabled = true;
      elements.levelTitle.textContent = "Loading...";

      try {
        const response = await fetch(meta.file, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Unable to load ${meta.file}: ${response.status}`);
        }
        runtime.currentLevel = await response.json();
        runtime.currentLevel.id = runtime.currentLevel.id || meta.id;
        runtime.currentLevel.title = runtime.currentLevel.title || meta.title;
        restart();
      } catch (error) {
        runtime.currentLevel = null;
        runtime.state = null;
        if (deps.hideMissionBriefing) deps.hideMissionBriefing();
        elements.levelTitle.textContent = "Level Load Failed";
        elements.bannerTitle.textContent = "Level Load Failed";
        elements.bannerText.textContent = error.message;
        elements.banner.classList.remove("hidden");
      } finally {
        elements.levelSelect.disabled = false;
        if (elements.tutorialSelect) elements.tutorialSelect.disabled = false;
        if (elements.tempLevelSelect) elements.tempLevelSelect.disabled = false;
      }
    }

    // Starts a playable level from an in-memory JSON object, used by editor preview.
    async function loadLevelObject(levelObject, meta = {}) {
      const title = meta.title || levelObject.title || "Editor Preview";
      runtime.currentLevelMeta = {
        id: meta.id || levelObject.id || "editor-preview",
        title: `${title} (Preview)`,
        file: ""
      };
      runtime.activeMode = meta.mode || "preview";
      elements.levelSelect.value = "";
      if (elements.tutorialSelect) elements.tutorialSelect.value = "";
      if (elements.tempLevelSelect) elements.tempLevelSelect.value = "";
      runtime.currentLevel = clonePlain(levelObject);
      runtime.currentLevel.id = runtime.currentLevel.id || runtime.currentLevelMeta.id;
      runtime.currentLevel.title = runtime.currentLevelMeta.title;
      restart();
    }

    // Advances to the next configured story level without wrapping after the final level.
    function loadNextLevel() {
      if (!runtime.currentLevelMeta) return false;
      const nextIndex = currentLevelIndex() + 1;
      if (nextIndex >= deps.levelOptions.length) return false;
      loadLevel(deps.levelOptions[nextIndex].id);
      return true;
    }

    // Advances to the next tutorial, returning to the first story level when none exist.
    function loadNextTutorial() {
      const options = deps.tutorialOptions || [];
      if (!options.length) {
        loadFirstLevel();
        return;
      }
      if (deps.progression && deps.progression.allTutorialsComplete && deps.progression.allTutorialsComplete(options)) {
        loadFirstLevel();
        return;
      }
      const nextIndex = (currentTutorialIndex() + 1) % options.length;
      loadLevel(options[nextIndex].id);
    }

    // Loads the first configured story level.
    function loadFirstLevel() {
      if (!deps.levelOptions.length) return;
      loadLevel(deps.levelOptions[0].id);
    }

    return {
      createGameState,
      cloneLevel,
      restart,
      resizeWorld,
      currentLevelIndex,
      currentTutorialIndex,
      populateLevelSelect,
      loadLevel,
      loadLevelObject,
      loadNextLevel,
      loadNextTutorial,
      loadFirstLevel
    };
  }

  window.LevelSystem = { create };
}());
