"use strict";

(function () {
  // Builds map object interactions for doors, windows, stairs, items, and tables.
  function create(deps) {
    const range = 54;
    const doorAnimationDuration = 0.2;

    // Interacts with the nearest usable map object around the selected operator.
    function interactNearest() {
      const state = deps.getState();
      const op = deps.selectedOperator();
      if (!state || !op || op.down || state.gameOver) return false;
      const item = nearest(op, state.level.items || [], (target) => !target.picked);
      if (item) return deps.inventory.pickItem(op, item);
      const table = nearestOverlapping(op, state.level.equipmentTables || []);
      if (table) {
        deps.inventory.openEquipmentTable(table);
        return true;
      }
      const laptop = nearest(op, state.level.laptops || []);
      if (laptop) {
        deps.cameraHack.openLaptop(laptop);
        return true;
      }
      const win = nearest(op, state.level.windows || []);
      if (win) return interactWindow(op, win);
      const stair = nearest(op, state.level.stairs || []);
      if (stair) return interactStair(op, stair);
      const door = nearestDoor(op);
      if (door) return interactDoor(op, door);
      state.message = "Nothing in reach";
      deps.updateHud();
      return false;
    }

    // Handles locked, closed, and open door interactions.
    function interactDoor(op, door) {
      const state = deps.getState();
      if (door.state === "opening" || door.state === "closing") {
        state.message = `${door.id} moving`;
        deps.updateHud();
        return true;
      }
      if (door.state === "open") {
        if (doorBlockedByUnit(door)) {
          state.message = "Door blocked";
          deps.updateHud();
          return true;
        }
        beginDoorTransition(door, "closed");
        deps.audio.play("door-close");
        state.message = `${op.id} closed ${door.id}`;
        deps.updateHud();
        return true;
      }
      if (deps.geometry.isLockedDigitalDoor(door)) {
        deps.audio.play("door-locked");
        deps.enemyBehavior.noticeDoor(door, op);
        deps.openDigitalLock(door);
        state.message = `${door.id} locked`;
        deps.updateHud();
        return true;
      }
      beginDoorTransition(door, "open");
      deps.audio.play("door-open");
      deps.enemyBehavior.noticeDoor(door, op);
      state.message = `${op.id} opened ${door.id}`;
      deps.updateHud();
      return true;
    }

    // Starts a short open/close transition around the door's configured hinge.
    function beginDoorTransition(door, targetState) {
      const opening = targetState === "open";
      door.state = opening ? "opening" : "closing";
      door.animDirection = opening ? 1 : -1;
      door.animDuration = doorAnimationDuration;
      door.animProgress = Number.isFinite(door.animProgress) ? door.animProgress : (opening ? 0 : 1);
      door.animTimer = opening ? door.animProgress * doorAnimationDuration : (1 - door.animProgress) * doorAnimationDuration;
      door.hinge = door.hinge || (door.orientation === "vertical" ? "top" : "left");
    }

    // Advances all active door animations and settles them into stable states.
    function updateDoors(dt) {
      const state = deps.getState();
      if (!state) return;
      for (const door of state.level.doors || []) {
        if (door.state !== "opening" && door.state !== "closing") continue;
        const duration = door.animDuration || doorAnimationDuration;
        const direction = door.animDirection || (door.state === "opening" ? 1 : -1);
        const start = Number.isFinite(door.animProgress) ? door.animProgress : (direction > 0 ? 0 : 1);
        door.animProgress = Math.max(0, Math.min(1, start + direction * (duration > 0 ? dt / duration : 1)));
        if (direction > 0 && door.animProgress >= 1) {
          door.state = "open";
          door.animDirection = 0;
          door.animTimer = 0;
        } else if (direction < 0 && door.animProgress <= 0) {
          if (doorBlockedByUnit(door)) {
            door.state = "opening";
            door.animDirection = 1;
            door.animProgress = 0.05;
            door.animTimer = 0;
            continue;
          }
          door.state = "closed";
          door.animDirection = 0;
          door.animTimer = 0;
        } else {
          door.animTimer = (door.animTimer || 0) + dt;
        }
      }
    }

    // Opens or vaults through a window depending on its state.
    function interactWindow(op, win) {
      const state = deps.getState();
      if (win.state === "closed") {
        win.state = "open";
        deps.audio.play("window-open");
        if (state.tutorial) state.tutorial.windowOpened = true;
        state.message = `${op.id} opened ${win.id}`;
        deps.updateHud();
        return true;
      }
      vaultWindow(op, win, win.state === "broken");
      state.message = win.state === "broken" ? `${op.id} climbed through broken glass` : `${op.id} climbed through ${win.id}`;
      deps.updateHud();
      return true;
    }

    // Moves an operator to the opposite side of a window.
    function vaultWindow(op, win, damaged) {
      const center = deps.geometry.rectCenter(win);
      if (win.orientation === "vertical") {
        op.x = op.x < center.x ? center.x + 34 : center.x - 34;
        op.y = center.y;
      } else {
        op.x = center.x;
        op.y = op.y < center.y ? center.y + 34 : center.y - 34;
      }
      op.movedBefore = true;
      win.vaulted = true;
      deps.audio.play("window-vault");
      if (damaged) {
        deps.audio.play("glass-step-damage");
        deps.actions.damageOperator(op, win.damage || 8);
      }
    }

    // Moves an operator to the paired stair target.
    function interactStair(op, stair) {
      const state = deps.getState();
      if (!stair.target) return false;
      op.x = stair.target.x;
      op.y = stair.target.y;
      op.floor = stair.target.floor || stair.to || op.floor;
      op.zone = stair.target.label || stair.label || op.zone;
      op.path = [];
      op.movedBefore = true;
      stair.used = true;
      deps.audio.play("stairs-use");
      state.message = `${op.id} moved to ${op.zone || "stairs"}`;
      deps.updateHud();
      return true;
    }

    // Returns a hint for the nearest usable object.
    function nearestHint(op) {
      const state = deps.getState();
      if (!state || !op) return "";
      const item = nearest(op, state.level.items || [], (target) => !target.picked);
      if (item) return `Press E to pick up ${item.name || item.id}`;
      const table = nearestOverlapping(op, state.level.equipmentTables || []);
      if (table) return "Press E to use equipment table";
      const laptop = nearest(op, state.level.laptops || []);
      if (laptop) return "Press E to use camera laptop";
      const win = nearest(op, state.level.windows || []);
      if (win) return win.state === "closed" ? "Press E to open window" : "Press E to climb through window";
      const stair = nearest(op, state.level.stairs || []);
      if (stair) return `Press E to use ${stair.name || "stairs"}`;
      const door = nearestDoor(op);
      if (door) {
        if (door.state === "open") return "Press E to close door";
        if (door.state === "opening" || door.state === "closing") return "Door moving";
        if (deps.geometry.isLockedDigitalDoor(door)) return "Door locked: press E to enter code";
        if (deps.geometry.isDigitalLockDoor(door)) return "Door unlocked: press E to open";
        return "Door nearby: press E to open";
      }
      return "";
    }

    // Finds the nearest object by center distance.
    function nearest(op, list, filter = () => true) {
      let best = null;
      let bestDist = Infinity;
      for (const target of list) {
        if (!filter(target)) continue;
        const dist = deps.geometry.scaledPointRectDistance(op, target);
        if (dist <= range && dist < bestDist) {
          best = target;
          bestDist = dist;
        }
      }
      return best;
    }

    // Finds the nearest object whose authored collision area overlaps the operator body.
    function nearestOverlapping(op, list, filter = () => true) {
      let best = null;
      let bestDist = Infinity;
      for (const target of list) {
        if (!filter(target)) continue;
        if (!deps.geometry.circleRectCollides(op, target)) continue;
        const dist = deps.geometry.pointRectDistance(op, target);
        if (dist < bestDist) {
          best = target;
          bestDist = dist;
        }
      }
      return best;
    }

    // Finds the nearest door, whether open or closed.
    function nearestDoor(op) {
      let best = null;
      let bestDist = Infinity;
      for (const door of deps.getState().level.doors) {
        if (!deps.geometry.doorCanInteract(door)) continue;
        const dist = deps.geometry.scaledPointRectDistance(op, door);
        if (dist <= range && dist < bestDist) {
          best = door;
          bestDist = dist;
        }
      }
      return best;
    }

    // Prevents closing doors through unit bodies.
    function doorBlockedByUnit(door) {
      const state = deps.getState();
      const units = [...state.level.operators, ...state.level.enemies].filter((unit) => !unit.down);
      return units.some((unit) => deps.geometry.circleRectCollides(unit, deps.geometry.scaledRect(door), 2));
    }

    return {
      interactNearest,
      interactDoor,
      beginDoorTransition,
      updateDoors,
      interactWindow,
      interactStair,
      nearestHint,
      nearest,
      nearestOverlapping,
      nearestDoor,
      doorBlockedByUnit
    };
  }

  window.InteractionSystem = { create };
}());
