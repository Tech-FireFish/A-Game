"use strict";

(function () {
  // Builds the movement, door, and combat API around shared game dependencies.
  function create(deps) {
    // Reads the live runtime state through the dependency boundary.
    function getState() {
      return deps.getState();
    }

    // Handles the actual door effect for locked and unlocked doors.
    function interactWithDoor(op, door) {
      const state = getState();
      if (!state || !door || !op || op.down) return false;
      if (deps.isLockedDigitalDoor(door)) {
        deps.audio.play("door-locked");
        deps.enemyBehavior.noticeDoor(door, op);
        deps.openDigitalLock(door);
        state.message = `${door.id} locked`;
        deps.updateHud();
        return true;
      }
      door.state = "open";
      op.action = null;
      deps.audio.play("door-open");
      deps.enemyBehavior.noticeDoor(door, op);
      state.message = `${op.id} opened ${door.id}`;
      deps.updateHud();
      return true;
    }

    // Attempts to interact with the nearest closed door to the selected operator.
    function openNearestDoor() {
      deps.interaction.interactNearest();
    }

    // Attempts door interaction from a mouse click, including range checks.
    function openDoorByClick(door) {
      const state = getState();
      if (!state) return false;
      const op = deps.selectedOperator();
      if (!op || op.down) return false;
      if (deps.pointRectDistance(op, door) > 52) {
        state.message = "Move closer to the door";
        deps.updateHud();
        return true;
      }
      return interactWithDoor(op, door);
    }

    // Moves an operator along manual input or planned pathing.
    function updateOperator(op, dt) {
      const state = getState();
      if (!state || op.down) return;
      if (op.action) {
        op.action.timer -= dt;
        if (op.action.timer <= 0) {
          const door = state.level.doors.find((item) => item.id === op.action.doorId);
          if (door) door.state = "breached";
          op.action = null;
        }
        return;
      }

      if (op.id === state.selectedId && deps.hasManualInput()) {
        updateManualOperator(op, dt);
        return;
      }

      /*
      Plan/execute waypoint movement disabled:
      const target = op.path[0];
      if (!target) return;

      const dist = deps.pointDistance(op, target);
      if (dist < 4) {
        op.path.shift();
        return;
      }

      const direction = deps.angleTo(op, target);
      op.aim = direction;
      const step = Math.min(dist, op.speed * dt);
      const next = {
        x: op.x + Math.cos(direction) * step,
        y: op.y + Math.sin(direction) * step,
        radius: op.radius
      };

      if (!deps.collidesWithMap(state.level, next)) {
        op.x = next.x;
        op.y = next.y;
        op.movedBefore = true;
        deps.audio.noteLoopActivity("operator-walk");
      }
      */
    }

    // Applies WASD movement to the selected operator.
    function updateManualOperator(op, dt) {
      const state = getState();
      if (!state) return;
      let dx = 0;
      let dy = 0;
      if (deps.isActionDown("moveUp")) dy -= 1;
      if (deps.isActionDown("moveDown")) dy += 1;
      if (deps.isActionDown("moveLeft")) dx -= 1;
      if (deps.isActionDown("moveRight")) dx += 1;
      if (dx === 0 && dy === 0) return;

      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      op.path = [];
      op.aim = Math.atan2(dy, dx);

      const speedMultiplier = deps.isActionDown("sprint") ? 1.55 : (deps.isActionDown("sneak") ? 0.48 : 1);
      const next = {
        x: op.x + dx * op.speed * speedMultiplier * dt,
        y: op.y + dy * op.speed * speedMultiplier * dt,
        radius: op.radius
      };

      if (!deps.collidesWithMap(state.level, next)) {
        op.x = next.x;
        op.y = next.y;
        op.movedBefore = true;
        if (state.tutorial) {
          if (deps.isActionDown("sneak")) state.tutorial.sneaked = true;
          if (deps.isActionDown("sprint")) state.tutorial.sprinted = true;
        }
        deps.audio.noteLoopActivity("operator-walk");
      }
    }

    // Updates enemy targeting, watch direction, patrol, and firing.
    function updateEnemy(enemy, dt) {
      if (enemy.down && enemy.respawnDelay) {
        updateEnemyRespawn(enemy, dt);
        return;
      }
      deps.shooting.updateReload(enemy, dt);
      deps.enemyBehavior.updateEnemy(enemy, dt, {
        fireAtOperator: (shooter, target, weapon, frameDt) => {
          fireAutomatic(shooter, target, weapon, frameDt, damageOperator, deps.colors.enemy);
        }
      });
    }

    // Restores tutorial enemies after their authored respawn delay.
    function updateEnemyRespawn(enemy, dt) {
      enemy.respawnTimer = Math.max(0, (enemy.respawnTimer || enemy.respawnDelay) - dt);
      if (enemy.respawnTimer > 0) return;
      enemy.x = enemy.spawn ? enemy.spawn.x : enemy.x;
      enemy.y = enemy.spawn ? enemy.spawn.y : enemy.y;
      enemy.angle = enemy.spawn ? enemy.spawn.angle : enemy.angle;
      enemy.health = 100;
      enemy.armor = enemy.maxArmor;
      enemy.down = false;
      enemy.status = "calm";
      enemy.targetId = null;
      enemy.fireTimer = 0;
      enemy.reaction = 0;
      enemy.suspicionTimer = 0;
      enemy.searchTarget = null;
      enemy.returnTarget = null;
      enemy.chasePath = null;
      deps.shooting.resetAmmo(enemy);
    }

    // Moves an enemy through its patrol route when no target is visible.
    function updateEnemyPatrol(enemy, dt) {
      deps.enemyBehavior.updateEnemyPatrol(enemy, dt);
    }

    // Finds visible hostile targets and fires the operator weapon automatically.
    function updateOperatorCombat(op, dt) {
      const state = getState();
      if (!state || op.down) return;
      deps.shooting.updateReload(op, dt);
      op.fireTimer = Math.max(0, (op.fireTimer || 0) - dt);
      if (state.shootingMode === "manual") return;
      const weapon = deps.weaponById(op.weaponId);
      if (weapon.canFire === false) return;
      const visible = state.level.enemies
        .filter((enemy) => !enemy.down)
        .filter((enemy) => deps.pointDistance(op, enemy) <= Math.min(weapon.range, deps.operatorSightRange(op)) + deps.scaledRadius(enemy))
        .filter((enemy) => deps.hasLineOfSight(op, enemy, state.level))
        .sort((a, b) => deps.pointDistance(op, a) - deps.pointDistance(op, b));

      const target = visible[0];
      if (!target) {
        op.targetId = null;
        op.reaction = Math.max(0, op.reaction - dt * 0.9);
        op.fireTimer = Math.max(0, op.fireTimer - dt);
        return;
      }

      op.aim = deps.angleTo(op, target);
      fireAutomatic(op, target, weapon, dt, damageEnemy, op.color);
    }

    // Runs reaction timing, fire rate timing, damage, and tracer creation.
    function fireAutomatic(shooter, target, weapon, dt, damageTarget, color) {
      if (weapon.canFire === false) return;
      if (shooter.targetId !== target.id) {
        shooter.targetId = target.id;
        shooter.reaction = 0;
        shooter.fireTimer = 0;
      }

      shooter.reaction += dt;
      deps.shooting.updateReload(shooter, dt);
      shooter.fireTimer = Math.max(0, shooter.fireTimer - dt);
      if (shooter.reaction < weapon.reactionDelay || shooter.fireTimer > 0) {
        return;
      }

      if (weapon.attackType === "melee") {
        if (deps.pointDistance(shooter, target) > weapon.range + deps.scaledRadius(shooter) + deps.scaledRadius(target)) return;
        if (!deps.hasLineOfSight(shooter, target, getState().level)) return;
        deps.audio.play("melee-hit");
        const stealthMelee = shooter.kind === "operator";
        damageTarget(target, weapon.damage, shooter, { stealthMelee });
        if (!stealthMelee) deps.enemyBehavior.noticeShot(shooter, target);
        shooter.fireTimer = weapon.fireInterval;
        return;
      }

      if (!deps.shooting.consumeRound(shooter, weapon)) return;
      deps.shooting.breakWindowsOnSegment(shooter, target);
      damageTarget(target, weapon.damage, shooter);
      deps.shooting.addShot(shooter, target, color, weapon.tracerTtl);
      const state = getState();
      if (state && state.tutorial && shooter.kind === "operator" && state.shootingMode === "automatic") {
        state.tutorial.automaticShotFired = true;
      }
      deps.audio.playWeapon(weapon.id || shooter.weaponId);
      deps.enemyBehavior.noticeShot(shooter, target);
      shooter.fireTimer = weapon.fireInterval;
    }

    // Applies damage to an enemy and marks it down at zero health.
    function damageEnemy(enemy, amount, source, options = {}) {
      const wasDown = enemy.down;
      if (source && source.kind === "operator" && source.disguised) {
        source.disguised = false;
        source.disguiseSourceEnemyId = "";
        const state = getState();
        if (state) state.message = `${source.id} disguise blown`;
      }
      applyDamage(enemy, amount);
      if (!options.stealthMelee) deps.enemyBehavior.noticeDamage(enemy, source);
      if (enemy.health <= 0) {
        enemy.health = 0;
        enemy.down = true;
        enemy.respawnTimer = enemy.respawnDelay || 0;
        enemy.status = "down";
        enemy.targetId = null;
        enemy.fireTimer = 0;
        if (!wasDown) {
          const state = getState();
          if (state) {
            state.enemyDownCount = (state.enemyDownCount || 0) + 1;
            if (state.tutorial) {
              if (!state.tutorial.completedEnemies) state.tutorial.completedEnemies = new Set();
              state.tutorial.completedEnemies.add(enemy.id);
              if (!state.tutorial.enemyNeutralizedCounts) state.tutorial.enemyNeutralizedCounts = {};
              if (!state.tutorial.enemyNeutralizedModeCounts) state.tutorial.enemyNeutralizedModeCounts = {};
              state.tutorial.enemyNeutralizedCounts[enemy.id] = (state.tutorial.enemyNeutralizedCounts[enemy.id] || 0) + 1;
              const mode = state.shootingMode === "manual" ? "manual" : "automatic";
              if (!state.tutorial.enemyNeutralizedModeCounts[mode]) state.tutorial.enemyNeutralizedModeCounts[mode] = {};
              state.tutorial.enemyNeutralizedModeCounts[mode][enemy.id] = (state.tutorial.enemyNeutralizedModeCounts[mode][enemy.id] || 0) + 1;
            }
          }
          if (options.stealthMelee && source && source.kind === "operator") {
            createEnemyClothes(enemy);
          } else {
            deps.enemyBehavior.noticeEnemyDown(enemy, source);
          }
        }
      }
    }

    // Drops a disguise item from an enemy neutralized silently by melee.
    function createEnemyClothes(enemy) {
      const state = getState();
      if (!state || !enemy) return;
      const itemId = `enemy-clothes-${enemy.id}`;
      if ((state.level.items || []).some((item) => item.id === itemId && !item.picked)) return;
      state.level.items.push({
        id: itemId,
        type: "disguise",
        name: "Enemy Clothes",
        x: enemy.x - 10,
        y: enemy.y - 9,
        w: 20,
        h: 18,
        picked: false,
        effect: "disguise",
        consumable: true,
        quantity: 1,
        maxStack: 1,
        sourceEnemyId: enemy.id,
        text: "Use to disguise this operator until they damage an enemy."
      });
    }

    // Applies damage to an operator and clears active behavior when downed.
    function damageOperator(op, amount) {
      const wasDown = op.down;
      applyDamage(op, amount, { operatorFatalOnly: !wasDown });
      if (op.health <= 0) {
        op.health = 0;
        op.down = true;
        op.path = [];
        op.action = null;
        op.fireTimer = 0;
      } else if (!wasDown && op.health <= 25 && !op.lowHealthWarned) {
        op.lowHealthWarned = true;
        deps.audio.play("low-health-warning");
      }
    }

    // Spends armor before allowing remaining damage to reduce health.
    function applyDamage(unit, amount, options = {}) {
      let remaining = amount;
      let armorDamage = 0;
      let healthDamage = 0;
      const startingHealth = unit.health;
      if (unit.armor > 0) {
        const absorbed = Math.min(unit.armor, remaining);
        unit.armor -= absorbed;
        remaining -= absorbed;
        armorDamage = absorbed;
      }
      if (remaining > 0) {
        unit.health -= remaining;
        healthDamage = remaining;
      }
      if (armorDamage > 0) deps.audio.play("armor-hit");
      if (healthDamage > 0) {
        if (options.operatorFatalOnly && startingHealth > 0 && unit.health <= 0) {
          deps.audio.play("operator-down");
        } else {
          deps.audio.play("body-hit");
        }
      }
    }

    return {
      openNearestDoor,
      openDoorByClick,
      updateOperator,
      updateManualOperator,
      updateEnemy,
      updateEnemyRespawn,
      updateEnemyPatrol,
      updateOperatorCombat,
      damageEnemy,
      damageOperator,
      applyDamage
    };
  }

  window.ActionSystem = { create };
}());
