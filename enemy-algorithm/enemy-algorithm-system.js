"use strict";

(function () {
  // Stores enemy action learning and chooses weighted actions for combat contact.
  function create(deps = {}) {
    const storageKey = "delta-geometry-enemy-algorithm-v1";
    const actions = ["retreating", "shooting", "calling-support"];
    const defaultProbability = 20;
    const defaultDifficultUpgradeChance = 50;
    let state = loadState();
    let difficultSession = defaultDifficultSession();

    function defaultState() {
      return {
        version: 1,
        configuredNonRepeatProbability: defaultProbability,
        currentNonRepeatProbability: defaultProbability,
        successes: {
          retreating: 0,
          shooting: 0,
          "calling-support": 0
        },
        lastActions: {}
      };
    }

    function defaultDifficultSession() {
      return {
        active: false,
        configuredEquipmentUpgradeChance: defaultDifficultUpgradeChance,
        equipmentUpgradeChance: defaultDifficultUpgradeChance,
        playerWins: 0,
        enemyWins: 0
      };
    }

    function loadState() {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (!parsed || parsed.version !== 1) return defaultState();
        const fallback = defaultState();
        return {
          version: 1,
          configuredNonRepeatProbability: clampPercent(parsed.configuredNonRepeatProbability ?? fallback.configuredNonRepeatProbability),
          currentNonRepeatProbability: clampPercent(parsed.currentNonRepeatProbability ?? fallback.currentNonRepeatProbability),
          successes: {
            retreating: Math.max(0, Number(parsed.successes?.retreating) || 0),
            shooting: Math.max(0, Number(parsed.successes?.shooting) || 0),
            "calling-support": Math.max(0, Number(parsed.successes?.["calling-support"]) || 0)
          },
          lastActions: parsed.lastActions && typeof parsed.lastActions === "object" ? { ...parsed.lastActions } : {}
        };
      } catch {
        return defaultState();
      }
    }

    function saveState() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // The game should remain playable if storage is blocked.
      }
    }

    function clampPercent(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return defaultProbability;
      return Math.max(0, Math.min(100, Math.round(numeric)));
    }

    function actionWeight(action) {
      return 1 + (state.successes[action] || 0);
    }

    function isDifficultMode() {
      return Boolean(deps.isDifficultMode && deps.isDifficultMode());
    }

    function weightedChoice(candidates) {
      const total = candidates.reduce((sum, action) => sum + actionWeight(action), 0);
      let roll = Math.random() * total;
      for (const action of candidates) {
        roll -= actionWeight(action);
        if (roll <= 0) return action;
      }
      return candidates[candidates.length - 1] || "shooting";
    }

    function chooseAction(enemy) {
      if (!isDifficultMode()) return "shooting";
      const enemyKey = enemy && enemy.id ? enemy.id : "unknown";
      const previous = state.lastActions[enemyKey];
      let candidates = [...actions];
      if (previous && candidates.length > 1 && Math.random() * 100 < state.currentNonRepeatProbability) {
        candidates = candidates.filter((action) => action !== previous);
      }
      const chosen = weightedChoice(candidates);
      state.lastActions[enemyKey] = chosen;
      saveState();
      return chosen;
    }

    function recordActionSuccess(enemy, action, damageInfo = {}) {
      if (!isDifficultMode()) return false;
      if (!actions.includes(action)) return false;
      const totalDamage = Number(damageInfo.totalDamage ?? damageInfo.damage ?? 0);
      if (!(totalDamage > 0)) return false;
      state.successes[action] = (state.successes[action] || 0) + 1;
      if (enemy && enemy.id) state.lastActions[enemy.id] = action;
      saveState();
      if (deps.onChange) deps.onChange(snapshot());
      return true;
    }

    function recordPlayerFailure() {
      if (!isDifficultMode()) return state.currentNonRepeatProbability;
      state.currentNonRepeatProbability = Math.min(100, state.currentNonRepeatProbability + 10);
      saveState();
      if (deps.onChange) deps.onChange(snapshot());
      return state.currentNonRepeatProbability;
    }

    function setConfiguredNonRepeatProbability(value) {
      const next = clampPercent(value);
      state.configuredNonRepeatProbability = next;
      state.currentNonRepeatProbability = next;
      saveState();
      if (deps.onChange) deps.onChange(snapshot());
      return next;
    }

    function resetLearningData() {
      const configured = clampPercent(state.configuredNonRepeatProbability);
      state = defaultState();
      state.configuredNonRepeatProbability = configured;
      state.currentNonRepeatProbability = configured;
      saveState();
      if (deps.onChange) deps.onChange(snapshot());
      return snapshot();
    }

    function startDifficultSession() {
      if (!difficultSession.active) difficultSession = defaultDifficultSession();
      difficultSession.active = true;
      if (deps.onChange) deps.onChange(snapshot());
      return getDifficultSessionSnapshot();
    }

    function resetDifficultSession() {
      difficultSession = defaultDifficultSession();
      if (deps.onChange) deps.onChange(snapshot());
      return getDifficultSessionSnapshot();
    }

    function recordDifficultResult(result, mode) {
      if (!isDifficultMode() || !difficultSession.active) return getDifficultSessionSnapshot();
      if (mode === "tutorial" && result === "success") return getDifficultSessionSnapshot();
      if (result === "success") {
        difficultSession.playerWins += 1;
        difficultSession.equipmentUpgradeChance = Math.min(100, difficultSession.equipmentUpgradeChance + 10);
      } else {
        difficultSession.enemyWins += 1;
        difficultSession.equipmentUpgradeChance = Math.max(0, difficultSession.equipmentUpgradeChance - 10);
      }
      if (deps.onChange) deps.onChange(snapshot());
      return getDifficultSessionSnapshot();
    }

    function setDifficultEquipmentUpgradeChance(value) {
      const next = clampPercent(value);
      if (!difficultSession.active) difficultSession.active = isDifficultMode();
      difficultSession.configuredEquipmentUpgradeChance = next;
      difficultSession.equipmentUpgradeChance = next;
      if (deps.onChange) deps.onChange(snapshot());
      return getDifficultSessionSnapshot();
    }

    function resetDifficultEquipmentUpgradeChance() {
      difficultSession.equipmentUpgradeChance = clampPercent(difficultSession.configuredEquipmentUpgradeChance);
      if (deps.onChange) deps.onChange(snapshot());
      return getDifficultSessionSnapshot();
    }

    function getDifficultSessionSnapshot() {
      return { ...difficultSession };
    }

    function shouldUpgradeEnemyEquipment() {
      if (!isDifficultMode() || !difficultSession.active) return false;
      return Math.random() * 100 < difficultSession.equipmentUpgradeChance;
    }

    function snapshot() {
      return {
        configuredNonRepeatProbability: state.configuredNonRepeatProbability,
        currentNonRepeatProbability: state.currentNonRepeatProbability,
        successes: { ...state.successes },
        weights: {
          retreating: actionWeight("retreating"),
          shooting: actionWeight("shooting"),
          "calling-support": actionWeight("calling-support")
        },
        lastActions: { ...state.lastActions },
        difficultSession: getDifficultSessionSnapshot()
      };
    }

    return {
      actions: [...actions],
      chooseAction,
      recordActionSuccess,
      recordPlayerFailure,
      setConfiguredNonRepeatProbability,
      resetLearningData,
      startDifficultSession,
      resetDifficultSession,
      recordDifficultResult,
      getDifficultSessionSnapshot,
      setDifficultEquipmentUpgradeChance,
      resetDifficultEquipmentUpgradeChance,
      shouldUpgradeEnemyEquipment,
      snapshot
    };
  }

  window.EnemyAlgorithmSystem = { create };
}());
