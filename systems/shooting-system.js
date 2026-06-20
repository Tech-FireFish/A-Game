"use strict";

(function () {
  // Builds ammo, reload, automatic fire, and manual shot helpers.
  function create(deps) {
    // Initializes or resets ammunition for a unit's current weapon and backpack.
    function resetAmmo(unit) {
      const weapon = deps.equipment.weaponById(unit.weaponId);
      const backpack = deps.equipment.backpackById(unit.backpackId || "no-backpack");
      if (weapon.canFire === false || weapon.attackType === "melee") {
        unit.ammo = {
          weaponId: weapon.id,
          magazine: 0,
          reserve: 0,
          maxReserve: 0,
          reloading: false,
          reloadTimer: 0
        };
        return;
      }
      const reserve = Math.round((weapon.reserveBullets || 90) * (backpack.ammoMultiplier || 1));
      unit.ammo = {
        weaponId: weapon.id,
        magazine: weapon.magSize || 20,
        reserve,
        maxReserve: reserve,
        reloading: false,
        reloadTimer: 0
      };
    }

    // Updates reload timers and moves reserve ammo into the magazine.
    function updateReload(unit, dt) {
      unit.emptyClickTimer = Math.max(0, (unit.emptyClickTimer || 0) - dt);
      unit.noAmmoWarningTimer = Math.max(0, (unit.noAmmoWarningTimer || 0) - dt);
      if (!unit.ammo || !unit.ammo.reloading) return;
      unit.ammo.reloadTimer = Math.max(0, unit.ammo.reloadTimer - dt);
      if (unit.ammo.reloadTimer > 0) return;
      const weapon = deps.equipment.weaponById(unit.weaponId);
      if (weapon.attackType === "melee") {
        unit.ammo.reloading = false;
        return;
      }
      const needed = (weapon.magSize || 20) - unit.ammo.magazine;
      const loaded = Math.min(needed, unit.ammo.reserve);
      unit.ammo.magazine += loaded;
      unit.ammo.reserve -= loaded;
      unit.ammo.reloading = false;
      if (loaded > 0) deps.audio.play("reload-complete");
    }

    // Starts a reload if spare ammunition exists.
    function beginReload(unit, weapon) {
      if (!unit.ammo || unit.ammo.reloading || unit.ammo.reserve <= 0) return false;
      if (weapon.attackType === "melee") return false;
      if (unit.ammo.magazine >= (weapon.magSize || 20)) return false;
      unit.ammo.reloading = true;
      unit.ammo.reloadTimer = weapon.reloadTime || 1.2;
      deps.audio.play("reload");
      return true;
    }

    // Plays an empty-magazine click with a small per-unit cooldown.
    function playEmptyClick(unit) {
      if (!unit || (unit.emptyClickTimer || 0) > 0) return;
      deps.audio.play("empty-magazine-click");
      unit.emptyClickTimer = 0.32;
      if (unit.ammo && unit.ammo.reserve <= 0 && (unit.noAmmoWarningTimer || 0) <= 0) {
        deps.audio.play("no-ammo-warning");
        unit.noAmmoWarningTimer = 1.5;
      }
    }

    // Actively reloads a selected unit before the magazine is empty.
    function activeReload(unit) {
      if (!unit || unit.down) return false;
      const weapon = deps.equipment.weaponById(unit.weaponId);
      if (weapon.canFire === false || weapon.attackType === "melee") return false;
      if (!unit.ammo || unit.ammo.weaponId !== weapon.id) resetAmmo(unit);
      const started = beginReload(unit, weapon);
      if (started) {
        const state = deps.getState();
        if (state) state.message = `${unit.id} reloading`;
        deps.updateHud();
      }
      return started;
    }

    // Consumes one round when the shooter can fire.
    function consumeRound(shooter, weapon) {
      if (!shooter.ammo || shooter.ammo.weaponId !== weapon.id) resetAmmo(shooter);
      if (weapon.canFire === false) return false;
      if (weapon.attackType === "melee") return true;
      if (shooter.ammo.reloading) return false;
      if (shooter.ammo.magazine <= 0) {
        if (!beginReload(shooter, weapon)) playEmptyClick(shooter);
        return false;
      }
      shooter.ammo.magazine -= 1;
      if (shooter.ammo.magazine <= 0) beginReload(shooter, weapon);
      return true;
    }

    // Adds a tracer to the shared shot list.
    function addShot(from, to, color, ttl = 0.09) {
      const state = deps.getState();
      if (!state) return;
      state.shots.push({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        color,
        ttl
      });
    }

    // Fires a manual shot from an operator toward a world point.
    function manualFire(op, point) {
      const state = deps.getState();
      if (!state || !op || op.down || state.gameOver) return false;
      const weapon = deps.equipment.weaponById(op.weaponId);
      if (weapon.canFire === false) return false;
      op.fireTimer = Math.max(0, op.fireTimer || 0);
      if (op.fireTimer > 0) return false;

      const angle = deps.geometry.angleTo(op, point);
      op.aim = angle;
      if (weapon.attackType === "melee") {
        const target = firstMeleeEnemy(op, weapon);
        if (!target) return false;
        deps.audio.play("melee-hit");
        deps.actions.damageEnemy(target, weapon.damage, op, { stealthMelee: true });
        if (state.tutorial) state.tutorial.manualShotFired = true;
        op.fireTimer = weapon.fireInterval;
        deps.updateHud();
        return true;
      }
      if (!consumeRound(op, weapon)) return false;
      const end = {
        x: op.x + Math.cos(angle) * weapon.range,
        y: op.y + Math.sin(angle) * weapon.range
      };
      breakWindowsOnSegment(op, end);
      const hit = firstEnemyHit(op, end);
      const blocker = firstSolidBlocker(op, end);
      let shotEnd = blocker ? blocker.point : end;
      if (hit && (!blocker || hit.t < blocker.t)) {
        shotEnd = hit.enemy;
        deps.actions.damageEnemy(hit.enemy, weapon.damage, op);
      }
      addShot(op, shotEnd, op.color, weapon.tracerTtl);
      if (state.tutorial) state.tutorial.manualShotFired = true;
      deps.audio.playWeapon(weapon.id);
      deps.enemyBehavior.noticeShot(op, hit ? hit.enemy : shotEnd);
      op.fireTimer = weapon.fireInterval;
      deps.updateHud();
      return true;
    }

    // Finds a nearby enemy valid for a melee strike.
    function firstMeleeEnemy(op, weapon) {
      const state = deps.getState();
      let best = null;
      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        const distance = deps.geometry.pointDistance(op, enemy);
        const enemyRadius = deps.geometry.scaledRadius ? deps.geometry.scaledRadius(enemy) : enemy.radius;
        if (distance > weapon.range + enemyRadius) continue;
        if (!deps.geometry.hasLineOfSight(op, enemy, state.level)) continue;
        if (!best || distance < best.distance) best = { enemy, distance };
      }
      return best ? best.enemy : null;
    }

    // Breaks every closed window crossed by a bullet segment.
    function breakWindowsOnSegment(a, b) {
      const state = deps.getState();
      for (const win of state.level.windows || []) {
        if (win.state !== "closed") continue;
        if (deps.geometry.segmentIntersectsRect(a, b, deps.geometry.scaledRect(win))) {
          win.state = "broken";
          deps.audio.play("window-break");
          state.message = `${win.id} broken`;
        }
      }
    }

    // Finds the nearest enemy whose body intersects the shot line.
    function firstEnemyHit(a, b) {
      const state = deps.getState();
      let best = null;
      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        const radius = deps.geometry.scaledRadius ? deps.geometry.scaledRadius(enemy) : enemy.radius;
        const hit = segmentCircleHit(a, b, enemy, radius + 2);
        if (hit && (!best || hit.t < best.t)) best = { enemy, t: hit.t };
      }
      return best;
    }

    // Finds the nearest wall or closed door blocking a shot.
    function firstSolidBlocker(a, b) {
      const state = deps.getState();
      let best = null;
      const blockers = [
        ...state.level.walls,
        ...state.level.doors.filter((door) => deps.geometry.doorBlocks(door)).map((door) => deps.geometry.scaledRect(door))
      ];
      for (const rect of blockers) {
        if (deps.geometry.segmentBlockedByRectThroughWindows && !deps.geometry.segmentBlockedByRectThroughWindows(a, b, rect, state.level)) continue;
        const hit = segmentRectHit(a, b, rect);
        if (hit && (!best || hit.t < best.t)) best = hit;
      }
      return best;
    }

    // Approximates the first point where a segment touches a rectangle.
    function segmentRectHit(a, b, rect) {
      if (!deps.geometry.segmentIntersectsRect(a, b, rect)) return null;
      let best = null;
      for (let i = 1; i <= 40; i += 1) {
        const t = i / 40;
        const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (deps.geometry.pointInRect(point, rect)) {
          best = { t, point };
          break;
        }
      }
      return best || { t: 1, point: b };
    }

    // Tests a segment against a circular unit body.
    function segmentCircleHit(a, b, circle, radius) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy || 1;
      const t = deps.geometry.clamp(((circle.x - a.x) * dx + (circle.y - a.y) * dy) / lengthSq, 0, 1);
      const closest = { x: a.x + dx * t, y: a.y + dy * t };
      return deps.geometry.pointDistance(closest, circle) <= radius ? { t } : null;
    }

    return {
      resetAmmo,
      updateReload,
      beginReload,
      activeReload,
      consumeRound,
      addShot,
      breakWindowsOnSegment,
      manualFire
    };
  }

  window.ShootingSystem = { create };
}());
