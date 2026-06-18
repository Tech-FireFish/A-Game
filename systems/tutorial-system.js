"use strict";

(function () {
  // Builds guided tutorial card behavior for levels with tutorialSteps.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;

    // Updates tutorial progress flags and renders the active step.
    function update() {
      const state = runtime.state;
      if (runtime.activeMode !== "tutorial" || !state || !state.level.tutorialSteps || !state.level.tutorialSteps.length) {
        hide();
        return;
      }
      if (!state.tutorial) initState(state);
      updateFlags(state);
      render(state);
    }

    // Initializes per-level tutorial tracking.
    function initState(state) {
      state.tutorial = {
        completed: new Set(),
        inventoryOpened: false,
        lockOpened: false,
        tableOpened: false,
        completedEnemies: new Set(),
        enemyNeutralizedCounts: {},
        enemyNeutralizedModeCounts: {},
        completedNeutralizeMode: null,
        prematureObjectiveTouches: 0,
        objectiveTouchLatched: false,
        warningText: "",
        attentionUntil: 0
      };
    }

    // Records state-driven tutorial completions.
    function updateFlags(state) {
      if (runtime.inventoryOpen) state.tutorial.inventoryOpened = true;
      if (runtime.digitalLockOpen) state.tutorial.lockOpened = true;
      if (runtime.equipmentTableOpen) state.tutorial.tableOpened = true;
      if (!objectiveTouched(state)) state.tutorial.objectiveTouchLatched = false;
      for (const step of state.level.tutorialSteps) {
        if (stepComplete(state, step)) state.tutorial.completed.add(step.id);
      }
    }

    // Evaluates a level-authored completion condition.
    function stepComplete(state, step) {
      const op = selectedOperator(state);
      const door = step.doorId ? state.level.doors.find((item) => item.id === step.doorId) : null;
      const item = step.itemId ? state.level.items.find((target) => target.id === step.itemId) : null;
      const win = step.windowId ? (state.level.windows || []).find((target) => target.id === step.windowId) : null;
      const stair = step.stairId ? (state.level.stairs || []).find((target) => target.id === step.stairId) : null;
      const enemy = step.enemyId ? state.level.enemies.find((target) => target.id === step.enemyId) : null;
      if (step.completeWhen === "nearItem") return Boolean(op && item && deps.pointRectDistance(op, item) < 58);
      if (step.completeWhen === "itemPicked") return Boolean(item && item.picked);
      if (step.completeWhen === "inventoryOpened") return state.tutorial.inventoryOpened;
      if (step.completeWhen === "nearDoor") return Boolean(op && door && deps.pointRectDistance(op, door) < 62);
      if (step.completeWhen === "lockOpened") return state.tutorial.lockOpened;
      if (step.completeWhen === "doorUnlocked") return Boolean(door && door.locked === false);
      if (step.completeWhen === "doorOpen") return Boolean(door && door.state !== "closed");
      if (step.completeWhen === "movementStarted") return state.level.operators.some((unit) => unit.movedBefore);
      if (step.completeWhen === "shootingPracticeStarted") return state.level.operators.some((unit) => unit.movedBefore)
        || Boolean(state.tutorial.automaticShotFired)
        || Boolean(state.tutorial.manualShotFired)
        || (state.tutorial.enemyNeutralizedCounts && Object.values(state.tutorial.enemyNeutralizedCounts).some((count) => count > 0));
      if (step.completeWhen === "sneaked") return Boolean(state.tutorial.sneaked);
      if (step.completeWhen === "sprinted") return Boolean(state.tutorial.sprinted);
      if (step.completeWhen === "operatorSelected") return Boolean(step.operatorId && state.selectedId === step.operatorId);
      if (step.completeWhen === "shootingMode") return Boolean(step.mode && state.shootingMode === step.mode);
      if (step.completeWhen === "automaticShotFired") return Boolean(state.tutorial.automaticShotFired);
      if (step.completeWhen === "manualShotFired") return Boolean(state.tutorial.manualShotFired);
      if (step.completeWhen === "enemyNeutralized") return enemy ? enemy.down || state.tutorial.completedEnemies?.has(enemy.id) : state.enemyDownCount > 0;
      if (step.completeWhen === "enemyNeutralizedCount") return enemyNeutralizedCount(state, step) >= (step.count || 1);
      if (step.completeWhen === "tableOpened") return state.tutorial.tableOpened;
      if (step.completeWhen === "weaponEquipped") return state.level.operators.some((unit) => unit.weaponId !== "no-weapon");
      if (step.completeWhen === "armorEquipped") return state.level.operators.some((unit) => unit.armorId !== "no-armor" && unit.maxArmor > 0);
      if (step.completeWhen === "gearEquipped") return state.level.operators.some((unit) => unit.weaponId !== "no-weapon" && unit.armorId !== "no-armor");
      if (step.completeWhen === "windowOpened") return Boolean(win && win.state === "open");
      if (step.completeWhen === "windowBroken") return Boolean(win && win.state === "broken");
      if (step.completeWhen === "windowVaulted") return Boolean(win && win.vaulted);
      if (step.completeWhen === "stairUsed") return Boolean(stair && stair.used);
      if (step.completeWhen === "objectiveSecured") return Boolean(state.level.objective.secured);
      return false;
    }

    // Reads total or mode-specific repeated enemy-down counts for respawning target practice.
    function enemyNeutralizedCount(state, step) {
      const targetId = step.enemyId || "any";
      if (step.modeAware) {
        const modeCounts = state.tutorial.enemyNeutralizedModeCounts || {};
        const automatic = modeCounts.automatic?.[targetId] || 0;
        const manual = modeCounts.manual?.[targetId] || 0;
        const required = step.count || 1;
        if (!state.tutorial.completedNeutralizeMode) {
          if (automatic >= required) state.tutorial.completedNeutralizeMode = "automatic";
          if (manual >= required) state.tutorial.completedNeutralizeMode = "manual";
        }
        const completedMode = state.tutorial.completedNeutralizeMode;
        return completedMode ? (modeCounts[completedMode]?.[targetId] || 0) : Math.max(automatic, manual);
      }
      return (state.tutorial.enemyNeutralizedCounts || {})[targetId] || 0;
    }

    // Builds mode-aware tutorial copy for steps that branch on automatic/manual shooting.
    function stepText(state, step) {
      if (!step.modeAware) return step.text;
      const mode = state.tutorial.completedNeutralizeMode || state.shootingMode || "automatic";
      if (mode === "manual" && step.textManual) return step.textManual;
      if (mode === "automatic" && step.textAutomatic) return step.textAutomatic;
      return step.text;
    }

    // Shows count progress for mode-aware practice without adding extra authored steps.
    function stepProgress(state, step, fallback) {
      if (step.completeWhen !== "enemyNeutralizedCount") return fallback;
      const targetId = step.enemyId || "any";
      const required = step.count || 1;
      const mode = state.tutorial.completedNeutralizeMode || state.shootingMode || "automatic";
      const modeCounts = state.tutorial.enemyNeutralizedModeCounts || {};
      const count = step.modeAware
        ? Math.min(modeCounts[mode]?.[targetId] || 0, required)
        : Math.min((state.tutorial.enemyNeutralizedCounts || {})[targetId] || 0, required);
      const label = step.modeAware ? `${mode.charAt(0).toUpperCase()}${mode.slice(1)} practice` : "Practice";
      return `${label}: ${count} / ${required}`;
    }

    // Finds the selected operator for distance-based checks.
    function selectedOperator(state) {
      return state.level.operators.find((op) => op.id === state.selectedId && !op.down)
        || state.level.operators.find((op) => !op.down);
    }

    // Reports whether the active level is a guided tutorial.
    function isTutorialLevel(state = runtime.state) {
      return Boolean(runtime.activeMode === "tutorial" && state && state.level.tutorialSteps && state.level.tutorialSteps.length);
    }

    // Returns the first incomplete tutorial step index.
    function activeStepIndex(state = runtime.state) {
      if (!isTutorialLevel(state)) return -1;
      if (!state.tutorial) initState(state);
      updateFlags(state);
      return state.level.tutorialSteps.findIndex((step) => !state.tutorial.completed.has(step.id));
    }

    // Returns the first incomplete tutorial step.
    function activeStep(state = runtime.state) {
      const index = activeStepIndex(state);
      return index >= 0 ? state.level.tutorialSteps[index] : null;
    }

    // Reports whether every non-objective checkpoint before the VIP step is complete.
    function allCheckpointsComplete(state = runtime.state) {
      if (!isTutorialLevel(state)) return true;
      if (!state.tutorial) initState(state);
      updateFlags(state);
      const objectiveIndex = state.level.tutorialSteps.findIndex((step) => step.completeWhen === "objectiveSecured");
      const end = objectiveIndex === -1 ? state.level.tutorialSteps.length : objectiveIndex;
      for (let index = 0; index < end; index += 1) {
        if (!state.tutorial.completed.has(state.level.tutorialSteps[index].id)) return false;
      }
      return true;
    }

    // Reports whether VIP contact should be blocked until checkpoints are done.
    function shouldGateObjective(state = runtime.state) {
      if (!isTutorialLevel(state)) return false;
      return state.level.tutorialSteps.some((step) => step.completeWhen === "objectiveSecured") && !allCheckpointsComplete(state);
    }

    // Records an early VIP touch and emphasizes the active tutorial instruction.
    function recordPrematureObjectiveTouch(state = runtime.state) {
      if (!isTutorialLevel(state)) return;
      if (!state.tutorial) initState(state);
      if (!state.tutorial.objectiveTouchLatched) {
        state.tutorial.prematureObjectiveTouches += 1;
        state.tutorial.objectiveTouchLatched = true;
      }
      const step = activeStep(state);
      state.tutorial.warningText = step
        ? `Finish this checkpoint before the VIP: ${step.title}. ${stepText(state, step)}`
        : "Finish the tutorial checkpoints before touching the VIP.";
      if (state.tutorial.prematureObjectiveTouches >= 2) {
        state.tutorial.attentionUntil = performance.now() + 1800;
      }
      render(state);
    }

    // Warns before the player leaves an unfinished tutorial through a selector.
    function warnExit(state = runtime.state) {
      if (!isTutorialLevel(state) || allCheckpointsComplete(state) || state.gameOver) return false;
      if (!state.tutorial) initState(state);
      const step = activeStep(state);
      state.tutorial.warningText = step
        ? `Leaving tutorial before completion. Current checkpoint: ${step.title}. ${stepText(state, step)}`
        : "Leaving tutorial before completion.";
      state.tutorial.attentionUntil = performance.now() + 2200;
      render(state);
      return true;
    }

    // Checks current operator contact with the VIP marker.
    function objectiveTouched(state) {
      if (!state || !state.level || !state.level.objective) return false;
      if (!deps.pointDistance) return false;
      return state.level.operators.some((op) => !op.down && deps.pointDistance(op, state.level.objective) < 34);
    }

    // Renders the first incomplete step or final completion state.
    function render(state) {
      const steps = state.level.tutorialSteps;
      const index = steps.findIndex((step) => !state.tutorial.completed.has(step.id));
      const complete = index === -1;
      const step = complete ? steps[steps.length - 1] : steps[index];
      const attention = performance.now() < (state.tutorial.attentionUntil || 0);
      document.body.classList.toggle("tutorial-overlay-follow", overlayOpen());
      elements.tutorialCard.classList.remove("hidden");
      elements.tutorialCard.classList.toggle("attention", attention);
      if (elements.hintCard) elements.hintCard.classList.toggle("attention", attention);
      elements.tutorialTitle.textContent = complete ? "Tutorial Complete" : step.title;
      elements.tutorialText.textContent = state.tutorial.warningText && attention
        ? state.tutorial.warningText
        : (complete ? "Lesson complete. Try another tutorial or return to the main levels." : stepText(state, step));
      elements.tutorialProgress.textContent = complete
        ? `${steps.length} / ${steps.length} Complete`
        : stepProgress(state, step, `Step ${index + 1} / ${steps.length}`);
    }

    // Hides tutorial UI when the active level has no tutorial data.
    function hide() {
      document.body.classList.remove("tutorial-overlay-follow");
      if (elements.tutorialCard) elements.tutorialCard.classList.add("hidden");
      if (elements.tutorialCard) elements.tutorialCard.classList.remove("attention");
      if (elements.hintCard) elements.hintCard.classList.remove("attention");
    }

    // Reports whether tutorial text should float above another active overlay.
    function overlayOpen() {
      return runtime.settingsOpen
        || runtime.digitalLockOpen
        || runtime.inventoryOpen
        || runtime.equipmentTableOpen
        || runtime.laptopOpen
        || runtime.settingChangeOpen;
    }

    return {
      update,
      initState,
      isTutorialLevel,
      activeStep,
      activeStepIndex,
      allCheckpointsComplete,
      shouldGateObjective,
      recordPrematureObjectiveTouch,
      warnExit
    };
  }

  window.TutorialSystem = { create };
}());
