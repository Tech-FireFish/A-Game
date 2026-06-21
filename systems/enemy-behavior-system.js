"use strict";

(function () {
  // Builds status-driven enemy awareness, search, and attack behavior.
  function create(deps) {
    const calmStatus = "calm";
    const suspiciousStatus = "suspicious";
    const alertStatus = "alert";
    const returnStatus = "return";
    const downStatus = "down";
    const alertCooldownThreshold = 1.25;
    const gunfireHearingRadius = 420;
    const difficultTeamRadius = 280;

    // Updates one enemy through calm, suspicious, alert, or down behavior.
    function updateEnemy(enemy, dt, combat) {
      const state = deps.getState();
      if (!state) return;
      if (enemy.down) {
        enemy.status = downStatus;
        return;
      }
      updateAlertGate(enemy, dt);

      const weapon = deps.weaponById(enemy.weaponId);
      const seen = findVisibleOperator(enemy, weapon);
      if (seen) {
        updateAlgorithmContact(enemy, seen, weapon, dt, combat);
        return;
      }

      enemy.targetId = null;
      enemy.reaction = Math.max(0, enemy.reaction - dt * 0.8);
      enemy.fireTimer = Math.max(0, enemy.fireTimer - dt);
      if (enemy.status === alertStatus) {
        setStatus(enemy, suspiciousStatus, enemy.lastKnownOperator);
      }
      if (enemy.status === suspiciousStatus) {
        updateSuspiciousEnemy(enemy, dt);
        return;
      }
      if (enemy.status === returnStatus) {
        updateReturningEnemy(enemy, dt);
        return;
      }
      updateCalmEnemy(enemy, dt);
    }

    // Chooses and runs one learned enemy action while an operator is in contact.
    function updateAlgorithmContact(enemy, seen, weapon, dt, combat) {
      const now = Date.now();
      if (!enemy.algorithmAction || (enemy.algorithmActionUntil || 0) <= now) {
        const action = isDifficultMode() && deps.enemyAlgorithm && deps.enemyAlgorithm.chooseAction
          ? deps.enemyAlgorithm.chooseAction(enemy, { target: seen, weapon })
          : "shooting";
        startAlgorithmAction(enemy, action, seen, now);
      }
      triggerEnemyAlert(enemy, alertStatus, seen);
      if (enemy.algorithmAction === "retreating") {
        updateRetreatingEnemy(enemy, seen, dt);
        return;
      }
      if (enemy.algorithmAction === "calling-support") {
        callSupport(enemy, seen, now);
        enemy.angle = deps.angleTo(enemy, seen);
        return;
      }
      if (isDifficultMode()) coordinateNearbyEnemies(enemy, seen, now);
      enemy.algorithmAction = "shooting";
      enemy.angle = deps.angleTo(enemy, seen);
      combat.fireAtOperator(enemy, seen, weapon, dt);
    }

    function isDifficultMode() {
      return Boolean(deps.isDifficultMode && deps.isDifficultMode());
    }

    // Starts a short action window so enemies do not re-roll every animation frame.
    function startAlgorithmAction(enemy, action, target, now) {
      enemy.algorithmAction = action;
      enemy.algorithmActionStartedAt = now;
      const duration = action === "retreating" ? 2200 : (action === "calling-support" ? 1300 : 1200);
      enemy.algorithmActionUntil = now + duration;
      if (action === "retreating") {
        enemy.retreatUntil = now + duration;
        enemy.retreatTeamCreditUntil = now + duration + 900;
      }
      if (target) {
        enemy.lastKnownOperator = { x: target.x, y: target.y };
        enemy.searchTarget = { x: target.x, y: target.y };
      }
    }

    // Moves an enemy away from the current contact point.
    function updateRetreatingEnemy(enemy, target, dt) {
      const state = deps.getState();
      const angle = deps.angleTo(target, enemy);
      enemy.angle = deps.angleTo(enemy, target);
      const next = {
        x: enemy.x + Math.cos(angle) * enemy.speed * 1.05 * dt,
        y: enemy.y + Math.sin(angle) * enemy.speed * 1.05 * dt,
        radius: enemy.radius
      };
      if (!deps.collidesWithMap(state.level, next)) {
        enemy.x = next.x;
        enemy.y = next.y;
        deps.audio.noteLoopActivity("enemy-walk");
      } else if (enemy.spawn) {
        moveEnemyByPath(enemy, enemy.spawn, dt, 0.85);
      }
    }

    // Alerts and boosts nearby enemies once during the support action window.
    function callSupport(enemy, target, now) {
      if (enemy.supportCalledAt && enemy.supportCalledAt >= enemy.algorithmActionStartedAt) return;
      enemy.supportCalledAt = now;
      const state = deps.getState();
      const point = target || enemy;
      notifyNearby(enemy, 360, (other) => {
        if (other.id === enemy.id) return;
        other.supportBoostUntil = now + 3200;
        other.supportSourceEnemyId = enemy.id;
        triggerEnemyAlert(other, alertStatus, point, { combat: true });
      });
      if (state) state.combatAlertActive = true;
    }

    // Reads the enemy's configured behavior personality.
    function personalityOf(enemy) {
      const value = enemy && enemy.personality;
      return value === "aggressive" || value === "loyal" || value === "violent" ? value : "calm";
    }

    // Returns lightweight personality modifiers for current AI decisions.
    function personalityProfile(enemy) {
      const personality = personalityOf(enemy);
      if (personality === "aggressive") {
        return { searchSpeed: 1.1, pathSearch: true, alertTimer: 6.2, suspicionTimer: 7.2, retreat: false, reactToDown: true };
      }
      if (personality === "loyal") {
        return { searchSpeed: 0.82, pathSearch: false, alertTimer: 5.2, suspicionTimer: 6.4, retreat: false, reactToDown: true };
      }
      if (personality === "violent") {
        return { searchSpeed: 1.2, pathSearch: true, alertTimer: 5.8, suspicionTimer: 6.2, retreat: false, reactToDown: false };
      }
      return { searchSpeed: 0.7, pathSearch: false, alertTimer: 4.5, suspicionTimer: 5.5, retreat: true, reactToDown: true };
    }

    // Calm enemies can break off when the defense is mostly defeated.
    function shouldRetreat(enemy) {
      const profile = personalityProfile(enemy);
      if (!profile.retreat || !deps.enemyTeamPressure) return false;
      const pressure = deps.enemyTeamPressure(enemy);
      return Boolean(pressure && pressure.mostDown);
    }

    // Sends an enemy back to its defensive origin.
    function startReturn(enemy) {
      enemy.status = returnStatus;
      enemy.lastKnownOperator = null;
      enemy.searchTarget = null;
      enemy.returnTarget = enemy.spawn ? { x: enemy.spawn.x, y: enemy.spawn.y } : (enemy.watch ? { ...enemy.watch } : null);
    }

    // Finds the first living operator visible to an enemy with the current weapon.
    function findVisibleOperator(enemy, weapon) {
      const state = deps.getState();
      const liveOps = state.level.operators.filter((op) => !op.down && !op.disguised);
      return liveOps
        .filter((op) => deps.pointDistance(enemy, op) <= weapon.range)
        .find((op) => deps.inFieldOfView(enemy, op) && deps.hasLineOfSight(enemy, op, state.level));
    }

    // Applies a status and stores search information when a target point exists.
    function setStatus(enemy, status, target) {
      const previousStatus = enemy.status;
      enemy.status = status;
      if (status === alertStatus || status === suspiciousStatus) {
        const profile = personalityProfile(enemy);
        const point = target ? { x: target.x, y: target.y } : enemy.lastKnownOperator;
        enemy.lastKnownOperator = point ? { ...point } : null;
        enemy.searchTarget = point ? { ...point } : enemy.searchTarget;
        enemy.suspicionTimer = status === alertStatus
          ? profile.alertTimer
          : Math.max(enemy.suspicionTimer || 0, profile.suspicionTimer);
      }
      if ((status === calmStatus || status === returnStatus) && previousStatus !== status) {
        enemy.alertState = status;
      }
    }

    // Decrements the alert gate so enemies can become eligible for a later alert.
    function updateAlertGate(enemy, dt) {
      enemy.alertCooldown = Math.max(0, (enemy.alertCooldown || 0) - dt);
      const suspicionLow = (enemy.suspicionTimer || 0) <= alertCooldownThreshold;
      if ((enemy.status === calmStatus || suspicionLow) && !enemy.combatAlertActive) {
        enemy.alertLocked = false;
      }
      if (enemy.status === calmStatus) {
        enemy.alertState = calmStatus;
        enemy.combatAlertActive = false;
      }
    }

    // Reports whether this enemy can emit a fresh alert/suspicion cue.
    function canTriggerEnemyAlert(enemy, status, options = {}) {
      if (!enemy || enemy.down) return false;
      if (options.silent) return false;
      if (options.combat && enemy.combatAlertActive) return false;
      if (enemy.alertLocked && (enemy.suspicionTimer || 0) > alertCooldownThreshold) return false;
      if (enemy.alertCooldown > 0 && enemy.alertState === status) return false;
      return enemy.alertState !== status || !enemy.alertLocked;
    }

    // Applies status, search target, and non-spammy audio feedback for one enemy.
    function triggerEnemyAlert(enemy, status, target, options = {}) {
      const shouldPlay = canTriggerEnemyAlert(enemy, status, options);
      setStatus(enemy, status, target);
      if (status === alertStatus || status === suspiciousStatus) {
        enemy.alertState = status;
        enemy.alertLocked = true;
        enemy.alertCooldown = status === alertStatus ? 1.8 : 1.2;
        enemy.lastAlertTriggerAt = Date.now();
        if (options.combat) enemy.combatAlertActive = true;
      }
      if (shouldPlay) {
        deps.audio.play(status === alertStatus ? "enemy-alert" : "enemy-suspicious");
      }
    }

    // Moves or aims a suspicious enemy toward its last known contact point.
    function updateSuspiciousEnemy(enemy, dt) {
      if (shouldRetreat(enemy)) {
        startReturn(enemy);
        return;
      }
      const profile = personalityProfile(enemy);
      enemy.suspicionTimer = Math.max(0, (enemy.suspicionTimer || 0) - dt);
      const target = enemy.searchTarget || enemy.lastKnownOperator;
      if (target) {
        enemy.angle = deps.angleTo(enemy, target);
        if (isDifficultMode()) {
          openBlockingDoor(enemy, target);
          coordinateNearbyEnemies(enemy, target, Date.now());
        }
        if (profile.pathSearch || deps.enemyTraceMode && deps.enemyTraceMode() === "chase") {
          moveEnemyByPath(enemy, target, dt, profile.searchSpeed);
        } else {
          moveEnemyToward(enemy, target, dt, profile.searchSpeed);
        }
        if (deps.pointDistance(enemy, target) < 18) {
          enemy.searchTarget = null;
        }
      } else if (enemy.watch) {
        enemy.angle = deps.angleTo(enemy, enemy.watch);
      }
      if (enemy.suspicionTimer <= 0) {
        if (profile.pathSearch || deps.enemyTraceMode && deps.enemyTraceMode() === "chase") {
          startReturn(enemy);
        } else {
          enemy.status = calmStatus;
          enemy.alertState = calmStatus;
          enemy.alertLocked = false;
          enemy.combatAlertActive = false;
          enemy.lastKnownOperator = null;
          enemy.searchTarget = null;
          enemy.returnTarget = null;
        }
      }
    }

    // Sends a search enemy back toward its authored spawn or watch point.
    function updateReturningEnemy(enemy, dt) {
      const target = enemy.returnTarget || (enemy.spawn ? { x: enemy.spawn.x, y: enemy.spawn.y } : enemy.watch);
      if (!target) {
        enemy.status = calmStatus;
        return;
      }
      enemy.angle = deps.angleTo(enemy, target);
      if (deps.pointDistance(enemy, target) > 14) {
        moveEnemyByPath(enemy, target, dt);
        return;
      }
      enemy.status = calmStatus;
      enemy.alertState = calmStatus;
      enemy.alertLocked = false;
      enemy.combatAlertActive = false;
      enemy.returnTarget = null;
      if (enemy.watch) enemy.angle = deps.angleTo(enemy, enemy.watch);
    }

    // Keeps calm enemies watching assigned points or following their patrol.
    function updateCalmEnemy(enemy, dt) {
      if (shouldRetreat(enemy)) {
        startReturn(enemy);
        updateReturningEnemy(enemy, dt);
        return;
      }
      enemy.status = calmStatus;
      if (enemy.watch) {
        enemy.angle = deps.angleTo(enemy, enemy.watch);
        return;
      }
      updateEnemyPatrol(enemy, dt);
    }

    // Moves an enemy through its patrol route while calm.
    function updateEnemyPatrol(enemy, dt) {
      if (!enemy.patrol || enemy.patrol.length < 2) return;
      const target = enemy.patrol[enemy.patrolIndex];
      const dist = deps.pointDistance(enemy, target);
      if (dist < 5) {
        enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
        return;
      }
      enemy.angle = deps.angleTo(enemy, target);
      moveEnemyToward(enemy, target, dt, 1);
    }

    // Moves one enemy toward a target point if the next step does not collide.
    function moveEnemyToward(enemy, target, dt, speedMultiplier) {
      const state = deps.getState();
      const direction = deps.angleTo(enemy, target);
      const next = {
        x: enemy.x + Math.cos(direction) * enemy.speed * speedMultiplier * dt,
        y: enemy.y + Math.sin(direction) * enemy.speed * speedMultiplier * dt,
        radius: enemy.radius
      };
      if (!deps.collidesWithMap(state.level, next)) {
        enemy.x = next.x;
        enemy.y = next.y;
        deps.audio.noteLoopActivity("enemy-walk");
      }
    }

    // Opens a nearby unlocked closed door if it blocks a Difficult-mode search route.
    function openBlockingDoor(enemy, target) {
      const state = deps.getState();
      if (!state || !target || !deps.beginDoorTransition) return false;
      for (const door of state.level.doors || []) {
        if (door.state !== "closed" || deps.isLockedDigitalDoor && deps.isLockedDigitalDoor(door)) continue;
        const distance = deps.pointRectDistance ? deps.pointRectDistance(enemy, door) : Infinity;
        if (distance > 46) continue;
        const center = deps.rectCenter(door);
        const targetDistance = deps.pointDistance(enemy, target);
        const doorDistance = deps.pointDistance(enemy, center);
        if (doorDistance > targetDistance + 12) continue;
        deps.beginDoorTransition(door, "open");
        deps.audio.play("door-open");
        return true;
      }
      return false;
    }

    // Shares a target point with nearby Difficult-mode allies so searches act like a team.
    function coordinateNearbyEnemies(enemy, target, now) {
      if (!isDifficultMode() || !target) return;
      if (enemy.teamCoordinationUntil && enemy.teamCoordinationUntil > now) return;
      enemy.teamCoordinationUntil = now + 1400;
      notifyNearby(enemy, difficultTeamRadius, (other) => {
        if (other.id === enemy.id || other.down) return;
        other.searchTarget = { x: target.x, y: target.y };
        other.lastKnownOperator = { x: target.x, y: target.y };
        other.supportBoostUntil = Math.max(other.supportBoostUntil || 0, now + 1800);
        if (other.status === calmStatus || other.status === returnStatus) {
          triggerEnemyAlert(other, suspiciousStatus, target, { combat: true });
        }
      });
    }

    // Moves an enemy by a coarse path when chase mode is enabled.
    function moveEnemyByPath(enemy, target, dt, speedMultiplier = 0.95) {
      const state = deps.getState();
      enemy.pathTimer = Math.max(0, (enemy.pathTimer || 0) - dt);
      if (!enemy.chasePath || enemy.pathTimer <= 0 || deps.pointDistance(enemy.chaseGoal || enemy, target) > 36) {
        enemy.chasePath = findPath(state.level, enemy, target) || [target];
        enemy.chaseGoal = { ...target };
        enemy.pathTimer = 0.65;
      }
      const nextPoint = enemy.chasePath[0] || target;
      if (deps.pointDistance(enemy, nextPoint) < 12) {
        enemy.chasePath.shift();
      }
      moveEnemyToward(enemy, enemy.chasePath[0] || target, dt, speedMultiplier);
    }

    // Finds a simple grid path across the current map.
    function findPath(level, start, goal) {
      const cell = 28;
      const cols = Math.ceil((level.width || 960) / cell);
      const rows = Math.ceil((level.height || 640) / cell);
      const key = (c, r) => `${c},${r}`;
      const toCell = (point) => ({
        c: deps.clamp(Math.round(point.x / cell), 0, cols - 1),
        r: deps.clamp(Math.round(point.y / cell), 0, rows - 1)
      });
      const toPoint = (c, r) => ({ x: c * cell, y: r * cell });
      const pass = (c, r) => !deps.collidesWithMap(level, { ...toPoint(c, r), radius: 11 });
      const startCell = toCell(start);
      const goalCell = toCell(goal);
      const queue = [startCell];
      const came = new Map([[key(startCell.c, startCell.r), null]]);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      while (queue.length) {
        const cur = queue.shift();
        if (cur.c === goalCell.c && cur.r === goalCell.r) {
          const points = [];
          let node = key(cur.c, cur.r);
          while (node) {
            const [c, r] = node.split(",").map(Number);
            points.push(toPoint(c, r));
            node = came.get(node);
          }
          return points.reverse().slice(1).concat([goal]);
        }
        for (const [dc, dr] of dirs) {
          const nc = cur.c + dc;
          const nr = cur.r + dr;
          const nextKey = key(nc, nr);
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || came.has(nextKey) || !pass(nc, nr)) continue;
          came.set(nextKey, key(cur.c, cur.r));
          queue.push({ c: nc, r: nr });
        }
      }
      return null;
    }

    // Alerts enemies near a newly opened or locked door interaction.
    function noticeDoor(door, op) {
      if (op && op.disguised) return;
      const point = op || deps.rectCenter(door);
      notifyNearby(point, 320, (enemy, distance) => {
        const personality = personalityOf(enemy);
        if ((personality === "aggressive" || personality === "violent") || distance < 180 && deps.hasLineOfSight(enemy, point, deps.getState().level)) {
          triggerEnemyAlert(enemy, alertStatus, point);
        } else {
          triggerEnemyAlert(enemy, suspiciousStatus, point);
        }
      });
    }

    // Alerts enemies that can hear or see a recent gunshot.
    function noticeShot(shooter, target) {
      if (shooter && shooter.disguised) return;
      const point = shooter || target;
      triggerLevelGunfireAlert(point, shooter);
    }

    // Starts a combat-wide alert if a non-silent shot is heard by nearby defenders.
    function triggerLevelGunfireAlert(point, shooter) {
      const state = deps.getState();
      if (!state || !point) return false;
      let heard = false;
      notifyNearby(point, gunfireHearingRadius, () => {
        heard = true;
      });
      if (!heard) return false;
      state.combatAlertActive = true;
      state.combatAlertPoint = { x: point.x, y: point.y };
      state.combatAlertTriggeredAt = Date.now();
      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        const distance = deps.pointDistance(enemy, point);
        const personality = personalityOf(enemy);
        if (distance <= gunfireHearingRadius && ((personality === "aggressive" || personality === "violent") || distance < 220 && deps.hasLineOfSight(enemy, point, state.level))) {
          triggerEnemyAlert(enemy, alertStatus, point, { combat: true });
        } else {
          triggerEnemyAlert(enemy, suspiciousStatus, point, { combat: true });
        }
      }
      return true;
    }

    // Pushes a damaged enemy into alert behavior toward the shooter if known.
    function noticeDamage(unit, source) {
      if (!unit || !source || unit.down) return;
      if (unit.kind === "operator") return;
      triggerEnemyAlert(unit, alertStatus, source);
    }

    // Alerts nearby enemies when another enemy goes down.
    function noticeEnemyDown(enemy, source) {
      const point = enemy || source;
      notifyNearby(point, 360, (other) => {
        if (other.id === enemy.id) return;
        const profile = personalityProfile(other);
        if (!profile.reactToDown) return;
        triggerEnemyAlert(other, personalityOf(other) === "aggressive" ? alertStatus : suspiciousStatus, source || point);
      });
    }

    // Iterates living enemies around a point and applies a callback.
    function notifyNearby(point, radius, callback) {
      const state = deps.getState();
      if (!state || !point) return;
      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        const distance = deps.pointDistance(enemy, point);
        if (distance <= radius) {
          callback(enemy, distance);
        }
      }
    }

    return {
      updateEnemy,
      findVisibleOperator,
      setStatus,
      updateSuspiciousEnemy,
      updateReturningEnemy,
      updateCalmEnemy,
      updateEnemyPatrol,
      moveEnemyToward,
      moveEnemyByPath,
      findPath,
      canTriggerEnemyAlert,
      triggerEnemyAlert,
      triggerLevelGunfireAlert,
      noticeDoor,
      noticeShot,
      noticeDamage,
      noticeEnemyDown
    };
  }

  window.EnemyBehaviorSystem = { create };
}());
