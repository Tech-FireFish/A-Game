"use strict";

(function () {
  // Builds difficulty-aware visibility and fog-of-war helpers.
  function create(deps) {
    const runtime = deps.runtime;

    // Returns weapon range normally or the short difficult-mode sight range.
    function operatorSightRange(op) {
      if (runtime.currentDifficulty !== "easy") return deps.difficultOperatorSight * carriedSightBoost(op);
      return Math.max(230, deps.equipment.weaponById(op.weaponId).range);
    }

    // Applies passive utility sight bonuses while carried.
    function carriedSightBoost(op) {
      const items = op && op.inventory && Array.isArray(op.inventory.items) ? op.inventory.items : [];
      return items.some((item) => item && item.effect === "sight" && item.sightBoost)
        ? Math.max(...items.filter((item) => item && item.effect === "sight").map((item) => item.sightBoost || 1), 1)
        : 1;
    }

    // Checks whether the selected living operator can currently see a target.
    function visibleToOperators(target) {
      const state = runtime.state;
      if (!state) return false;
      const selected = state.level.operators.find((op) => op.id === state.selectedId && !op.down)
        || state.level.operators.find((op) => !op.down);
      if (!selected) return false;
      return deps.geometry.pointDistance(selected, target) <= operatorSightRange(selected)
        && deps.geometry.hasLineOfSight(selected, target, state.level);
    }

    // Checks whether any living operator can reveal a hidden map object by sight.
    function hiddenObjectVisible(obj) {
      const state = runtime.state;
      if (!state || !obj) return false;
      const isRect = obj.w !== undefined && obj.h !== undefined;
      const target = isRect ? deps.geometry.rectCenter(obj) : obj;
      return state.level.operators
        .filter((op) => !op.down)
        .some((op) => {
          const inRange = isRect
            ? deps.geometry.scaledPointRectDistance(op, obj) <= operatorSightRange(op)
            : deps.geometry.pointDistance(op, target) <= operatorSightRange(op);
          if (!inRange) return false;
          if (isRect && deps.geometry.hasLineOfSightIgnoring) {
            return deps.geometry.hasLineOfSightIgnoring(op, target, state.level, obj);
          }
          return deps.geometry.hasLineOfSight(op, target, state.level);
        });
    }

    // Decides whether the VIP objective should be drawn in the current mode.
    function objectiveVisible() {
      const state = runtime.state;
      if (!state) return false;
      const obj = state.level.objective;
      if (deps.cameraHack && deps.cameraHack.isRevealed(obj)) return true;
      return obj.secured || obj.harmed || visibleToOperators(obj);
    }

    return {
      operatorSightRange,
      visibleToOperators,
      hiddenObjectVisible,
      objectiveVisible
    };
  }

  window.VisibilitySystem = { create };
}());
