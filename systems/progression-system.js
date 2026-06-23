"use strict";

(function () {
  // Builds local progress, privilege, unlock, and mission reward helpers.
  function create(deps) {
    const storageKey = "breachline-progression-v1";
    const rewardPrivilege = 2;
    const rewardEquipment = ["advanced-carbine", "compact-pdw", "marksman-pistol", "heavy-armor"];
    const state = load();
    let configuredLevels = [];

    // Loads saved progress from localStorage.
    function load() {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
        return {
          completedLevels: Array.isArray(saved.completedLevels) ? saved.completedLevels : [],
          completedTutorials: Array.isArray(saved.completedTutorials) ? saved.completedTutorials : [],
          unlockedLevels: Array.isArray(saved.unlockedLevels) ? saved.unlockedLevels : [],
          privilege: Math.max(1, Number(saved.privilege) || 1),
          unlockedEquipment: Array.isArray(saved.unlockedEquipment) ? saved.unlockedEquipment : []
        };
      } catch (error) {
        return { completedLevels: [], completedTutorials: [], unlockedLevels: [], privilege: 1, unlockedEquipment: [] };
      }
    }

    // Saves progress to localStorage.
    function save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        return;
      }
    }

    // Returns a copy of the current progress state.
    function snapshot() {
      return {
        completedLevels: [...state.completedLevels],
        completedTutorials: [...state.completedTutorials],
        unlockedLevels: [...state.unlockedLevels],
        privilege: state.privilege,
        unlockedEquipment: [...state.unlockedEquipment]
      };
    }

    // Reconciles persisted unlock IDs with the current server-provided story order.
    function syncLevelUnlocks(levelOptions = []) {
      configuredLevels = levelOptions.filter((level) => level && typeof level.id === "string");
      const validIds = new Set(configuredLevels.map((level) => level.id));
      const unlocked = new Set((state.unlockedLevels || []).filter((id) => validIds.has(id)));
      if (configuredLevels[0]) unlocked.add(configuredLevels[0].id);
      for (const completedId of state.completedLevels) {
        const index = configuredLevels.findIndex((level) => level.id === completedId);
        if (index < 0) continue;
        unlocked.add(completedId);
        if (configuredLevels[index + 1]) unlocked.add(configuredLevels[index + 1].id);
      }
      const nextUnlocked = configuredLevels
        .map((level) => level.id)
        .filter((id) => unlocked.has(id));
      const changed = JSON.stringify(nextUnlocked) !== JSON.stringify(state.unlockedLevels || []);
      state.unlockedLevels = nextUnlocked;
      if (changed) save();
      return snapshot();
    }

    // Unlocks the completed story level and its immediate successor.
    function unlockNextLevel(completedLevelId) {
      const index = configuredLevels.findIndex((level) => level.id === completedLevelId);
      if (index < 0) {
        save();
        return null;
      }
      const nextLevel = configuredLevels[index + 1] || null;
      const unlocked = new Set(state.unlockedLevels || []);
      unlocked.add(configuredLevels[index].id);
      if (nextLevel) unlocked.add(nextLevel.id);
      state.unlockedLevels = configuredLevels
        .map((level) => level.id)
        .filter((id) => unlocked.has(id));
      save();
      return nextLevel;
    }

    // Computes a simple level complexity score from authored components.
    function complexity(level) {
      if (!level) return 0;
      return (level.enemies || []).length * 4
        + (level.walls || []).length
        + (level.windows || []).length * 2
        + (level.stairs || []).length * 3
        + (level.cameras || []).length * 3
        + (level.equipmentTables || []).length * 2
        + (level.laptops || []).length * 3
        + (level.items || []).length * 2
        + (level.doors || []).length * 2
        + (level.objective ? 3 : 0);
    }

    // Calculates privilege from completed story levels.
    function privilegeFromCompleted() {
      return Math.max(1, Math.min(3, 1 + Math.floor(state.completedLevels.length / 2)));
    }

    // Records story mission completion and returns unlock/report data.
    function recordMission(levelMeta, level) {
      /*
      Privilege/access progression disabled: story completions no longer increase
      privilege or unlock rewards. Store ownership remains separate.
      */
      if (levelMeta && levelMeta.id && !state.completedLevels.includes(levelMeta.id)) {
        state.completedLevels.push(levelMeta.id);
      }
      if (levelMeta && levelMeta.id) unlockNextLevel(levelMeta.id);
      else save();
      return {
        privilegeEarned: 0,
        rewardsUnlocked: [],
        complexity: complexity(level)
      };
    }

    // Records successful tutorial completion without restoring access gates.
    function recordTutorial(tutorialMeta) {
      if (!tutorialMeta || !tutorialMeta.id) return snapshot();
      if (!state.completedTutorials.includes(tutorialMeta.id)) {
        state.completedTutorials.push(tutorialMeta.id);
        save();
      }
      return snapshot();
    }

    // Reports whether every configured tutorial has been completed.
    function allTutorialsComplete(tutorialOptions = []) {
      if (!tutorialOptions.length) return false;
      return tutorialOptions.every((tutorial) => state.completedTutorials.includes(tutorial.id));
    }

    // Reports whether a piece of equipment can be selected by operators.
    function isEquipmentUnlocked(id, item) {
      // Privilege/access progression disabled: equipment is never locked by privilege.
      return true;
    }

    // Reports whether a story level is unlocked.
    function isLevelUnlocked(levelId) {
      return Boolean(levelId && state.unlockedLevels.includes(levelId));
    }

    // Renders privilege status into menus.
    function renderPrivilegeBoard() {
      const el = deps.elements.privilegeBoard;
      if (!el) return;
      /*
      Privilege/access board disabled while progression/access locks are disabled.
      const rewards = rewardEquipment.map((id) => {
        const unlocked = state.unlockedEquipment.includes(id) || state.privilege >= rewardPrivilege;
        return `<span class="${unlocked ? "unlocked" : "locked"}">${label(id)} ${unlocked ? "Unlocked" : "Locked"}</span>`;
      }).join("");
      el.innerHTML = `
        <div class="summary-row"><span>Privilege</span><strong>${state.privilege}</strong></div>
        <div class="summary-row"><span>Story Clears</span><strong>${state.completedLevels.length}</strong></div>
        <div class="reward-list">${rewards}</div>
      `;
      */
      el.innerHTML = "";
    }

    // Converts IDs to compact display labels.
    function label(id) {
      return String(id).split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
    }

    return {
      snapshot,
      syncLevelUnlocks,
      unlockNextLevel,
      complexity,
      recordMission,
      recordTutorial,
      allTutorialsComplete,
      isEquipmentUnlocked,
      isLevelUnlocked,
      renderPrivilegeBoard,
      label
    };
  }

  window.ProgressionSystem = { create };
}());
