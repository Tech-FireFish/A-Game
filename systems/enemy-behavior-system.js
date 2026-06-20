"use strict";

(function () {
  // Builds status-driven enemy awareness, search, and attack behavior.
  function create(deps) {
    const calmStatus = "calm";
    const suspiciousStatus = "suspicious";
    const alertStatus = "alert";
    const returnStatus = "return";
    const downStatus = "down";

    // Updates one enemy through calm, suspicious, alert, or down behavior.
    function updateEnemy(enemy, dt, combat) {
      const state = deps.getState();
      if (!state) return;
      if (enemy.down) {
        enemy.status = downStatus;
        return;
      }

      const weapon = deps.weaponById(enemy.weaponId);
      const seen = findVisibleOperator(enemy, weapon);
      if (seen) {
        setStatus(enemy, alertStatus, seen);
        enemy.angle = deps.angleTo(enemy, seen);
        combat.fireAtOperator(enemy, seen, weapon, dt);
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
      if (status === alertStatus && previousStatus !== alertStatus) {
        deps.audio.play("enemy-alert");
      } else if (status === suspiciousStatus && previousStatus !== suspiciousStatus) {
        deps.audio.play("enemy-suspicious");
      }
      if (status === alertStatus || status === suspiciousStatus) {
        const profile = personalityProfile(enemy);
        const point = target ? { x: target.x, y: target.y } : enemy.lastKnownOperator;
        enemy.lastKnownOperator = point ? { ...point } : null;
        enemy.searchTarget = point ? { ...point } : enemy.searchTarget;
        enemy.suspicionTimer = status === alertStatus
          ? profile.alertTimer
          : Math.max(enemy.suspicionTimer || 0, profile.suspicionTimer);
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
          setStatus(enemy, alertStatus, point);
        } else {
          setStatus(enemy, suspiciousStatus, point);
        }
      });
    }

    // Alerts enemies that can hear or see a recent gunshot.
    function noticeShot(shooter, target) {
      if (shooter && shooter.disguised) return;
      const point = shooter || target;
      notifyNearby(point, 420, (enemy, distance) => {
        const personality = personalityOf(enemy);
        if ((personality === "aggressive" || personality === "violent") || distance < 220 && deps.hasLineOfSight(enemy, point, deps.getState().level)) {
          setStatus(enemy, alertStatus, point);
        } else {
          setStatus(enemy, suspiciousStatus, point);
        }
      });
    }

    // Pushes a damaged enemy into alert behavior toward the shooter if known.
    function noticeDamage(unit, source) {
      if (!unit || !source || unit.down) return;
      if (unit.kind === "operator") return;
      setStatus(unit, alertStatus, source);
    }

    // Alerts nearby enemies when another enemy goes down.
    function noticeEnemyDown(enemy, source) {
      const point = enemy || source;
      notifyNearby(point, 360, (other) => {
        if (other.id === enemy.id) return;
        const profile = personalityProfile(other);
        if (!profile.reactToDown) return;
        setStatus(other, personalityOf(other) === "aggressive" ? alertStatus : suspiciousStatus, source || point);
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
      noticeDoor,
      noticeShot,
      noticeDamage,
      noticeEnemyDown
    };
  }

  window.EnemyBehaviorSystem = { create };
}());
