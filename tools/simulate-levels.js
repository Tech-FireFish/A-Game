"use strict";

const fs = require("fs");
const path = require("path");

const UNIT_RADIUS = 12;
const TWO_PI = Math.PI * 2;
const DT = 1 / 30;
const CELL = 10;
const WEAPON_FILES = [
  "no-weapon.json",
  "rifle.json",
  "smg.json",
  "pistol.json"
];
const ARMOR_FILES = [
  "no-armor.json",
  "light-armor.json",
  "medium-armor.json",
  "heavy-armor.json"
];
const LEVEL_FILES = fs.existsSync("level")
  ? fs.readdirSync("level").filter((file) => file.endsWith(".json")).sort()
  : [];
const TUTORIAL_FILES = fs.existsSync("tutorials")
  ? fs.readdirSync("tutorials").filter((file) => file.endsWith(".json")).sort()
  : [];
const weapons = new Map(WEAPON_FILES.map((file) => {
  const weapon = JSON.parse(fs.readFileSync(path.join("equipment", file), "utf8"));
  return [weapon.id, weapon];
}));
const armors = new Map(ARMOR_FILES.map((file) => {
  const armor = JSON.parse(fs.readFileSync(path.join("equipment", file), "utf8"));
  return [armor.id, armor];
}));

function weaponById(id) {
  return weapons.get(id) || weapons.get("rifle");
}

function armorById(id) {
  return armors.get(id) || armors.get("light-armor");
}

function cloneLevel(level) {
  const generatedPasswords = {};
  const doors = level.doors.map((door) => {
    const password = door.lockType === "digital" ? randomPassword() : door.password;
    if (door.lockType === "digital") generatedPasswords[door.id] = password;
    return {
      ...door,
      password,
      locked: door.lockType === "digital" ? door.locked !== false : Boolean(door.locked)
    };
  });
  const items = (level.items || []).map((item) => ({ ...item, picked: false }));
  for (const door of doors.filter((item) => item.lockType === "digital")) {
    let paper = items.find((item) => item.type === "paper" && item.passwordFor === door.id);
    if (!paper) {
      paper = { id: `paper-${door.id}`, type: "paper", x: level.operators[0].x + 20, y: level.operators[0].y - 42, w: 22, h: 18, passwordFor: door.id, picked: false };
      items.push(paper);
    }
    paper.text = `${door.id} code: ${door.password}`;
  }
  return {
    id: level.id,
    title: level.title,
    requireObjective: Boolean(level.requireObjective),
    width: level.width || 960,
    height: level.height || 640,
    walls: level.walls.map((wall) => ({ ...wall })),
    windows: (level.windows || []).map((win) => ({ ...win, state: win.state || "closed" })),
    cameras: (level.cameras || []).map((camera) => ({ ...camera })),
    laptops: (level.laptops || []).map((laptop) => ({ ...laptop })),
    stairs: (level.stairs || []).map((stair) => ({ ...stair, target: stair.target ? { ...stair.target } : null })),
    items,
    equipmentTables: (level.equipmentTables || []).map((table) => ({ ...table })),
    doors,
    operators: level.operators.map((op) => {
      const armor = armorById(op.armorId || "light-armor");
      const baseSpeed = op.speed || 92;
      return {
        ...op,
        radius: UNIT_RADIUS,
        health: 100,
        armorId: armor.id,
        armor: armor.armor,
        maxArmor: armor.armor,
        baseSpeed,
        speed: baseSpeed * armor.speedMultiplier,
        weaponId: weaponById(op.weaponId || "rifle").id,
        fireTimer: 0,
        path: [],
        aim: 0,
        action: null,
        reaction: 0,
        targetId: null,
        down: false,
        inventory: { items: [] }
      };
    }),
    enemies: level.enemies.map((enemy) => {
      const armor = armorById(enemy.armorId || "light-armor");
      const baseSpeed = enemy.speed || 34;
      const weapon = weaponById(enemy.weaponId || "rifle");
      return {
        ...enemy,
        watch: enemy.watch ? { ...enemy.watch } : null,
        radius: 12,
        health: 100,
        armorId: armor.id,
        armor: armor.armor,
        maxArmor: armor.armor,
        baseSpeed,
        speed: baseSpeed * armor.speedMultiplier,
        weaponId: weapon.id,
        spawn: { x: enemy.x, y: enemy.y, angle: enemy.angle || 0 },
        fireTimer: 0,
        sightRange: enemy.sightRange || Math.max(190, weapon.range),
        fov: Math.PI * 0.78,
        reaction: 0,
        targetId: null,
        down: false,
        respawnDelay: enemy.respawnDelay || 0,
        respawnTimer: 0,
        patrolIndex: 0
      };
    }),
    objective: { ...level.objective },
    generatedPasswords
  };
}

function validateTutorial(levelRaw) {
  const level = cloneLevel(levelRaw);
  const op = level.operators[0];
  const route = op ? buildMissionRoute(level, op) : null;
  const guard = validateTutorialObjectiveGuard(levelRaw);
  const base = {
    valid: Boolean(op && route && guard.valid),
    route: Boolean(route),
    objectiveReachable: Boolean(route),
    objectiveGated: guard.valid,
    objectiveStepLast: guard.objectiveStepLast,
    checkpointsBeforeObjective: guard.checkpointsBeforeObjective
  };

  if (levelRaw.id === "tutorial-digital-lock") {
    const door = level.doors.find((item) => item.lockType === "digital");
    const paper = door ? level.items.find((item) => item.type === "paper" && item.passwordFor === door.id) : null;
    const paperReachable = Boolean(op && paper && findPath(level, op, rectCenter(paper)));
    const doorReachable = Boolean(op && door && findPath(level, op, rectCenter(door)));
    const paperMatches = paper && door && paper.text.includes(door.password);
    return {
      ...base,
      valid: Boolean(base.valid && door && paper && paperReachable && doorReachable && paperMatches),
      door: Boolean(door),
      paper: Boolean(paper),
      paperReachable,
      doorReachable,
      paperMatches
    };
  }

  if (levelRaw.id === "tutorial-shooting-modes") {
    const respawner = level.enemies.find((enemy) => enemy.respawnDelay === 3);
    if (respawner) {
      damageEnemy(respawner, 200);
      for (let t = 0; t < 3.2; t += DT) updateEnemy(level, respawner, DT);
    }
    return {
      ...base,
      valid: Boolean(base.valid && respawner && !respawner.down),
      respawnEnemy: Boolean(respawner),
      respawned: Boolean(respawner && !respawner.down)
    };
  }

  if (levelRaw.id === "tutorial-equipment-table") {
    const table = level.equipmentTables[0];
    return {
      ...base,
      valid: Boolean(base.valid && table && op.weaponId === "no-weapon" && op.armorId === "no-armor" && findPath(level, op, rectCenter(table))),
      startsUnarmed: op.weaponId === "no-weapon",
      startsUnarmored: op.armorId === "no-armor",
      tableReachable: Boolean(table && findPath(level, op, rectCenter(table)))
    };
  }

  if (levelRaw.id === "tutorial-windows") {
    return {
      ...base,
      valid: Boolean(base.valid && level.windows.length >= 2 && windowShotThroughTest(level)),
      windows: level.windows.length,
      windowShotThrough: windowShotThroughTest(level)
    };
  }

  if (levelRaw.id === "tutorial-operators-stairs") {
    const stair = level.stairs.find((item) => item.target);
    const secondOp = level.operators[1];
    return {
      ...base,
      valid: Boolean(base.valid && stair && secondOp && findPath(level, level.operators[0], rectCenter(stair)) && findPath(level, secondOp, level.objective)),
      stairReachable: Boolean(stair && findPath(level, level.operators[0], rectCenter(stair))),
      secondOperatorObjectiveReachable: Boolean(secondOp && findPath(level, secondOp, level.objective))
    };
  }

  return base;
}

function validateTutorialObjectiveGuard(levelRaw) {
  const steps = levelRaw.tutorialSteps || [];
  if (!steps.length) {
    return {
      valid: true,
      objectiveStepLast: true,
      checkpointsBeforeObjective: true
    };
  }
  const objectiveIndex = steps.findIndex((step) => step.completeWhen === "objectiveSecured");
  const objectiveStepLast = objectiveIndex === steps.length - 1;
  const checkpointsBeforeObjective = objectiveIndex > 0;
  const earlyVipBlocked = checkpointsBeforeObjective
    && steps.slice(0, objectiveIndex).every((step) => step.completeWhen !== "objectiveSecured");
  return {
    valid: objectiveStepLast && checkpointsBeforeObjective && earlyVipBlocked,
    objectiveStepLast,
    checkpointsBeforeObjective
  };
}

function firstSolidBulletBlocker(level, a, b) {
  return [
    ...level.walls,
    ...level.doors.filter(doorBlocks)
  ].some((rect) => segmentBlockedByRectThroughWindows(level, a, b, rect));
}

function windowShotThroughTest(level) {
  const windows = level.windows || [];
  if (!windows.length || !level.enemies.length || !level.operators.length) return true;
  const win = windows[0];
  const center = rectCenter(win);
  const a = win.orientation === "vertical"
    ? { x: center.x - 40, y: center.y }
    : { x: center.x, y: center.y - 40 };
  const enemy = win.orientation === "vertical"
    ? { ...level.enemies[0], x: center.x + 40, y: center.y, radius: 12 }
    : { ...level.enemies[0], x: center.x, y: center.y + 40, radius: 12 };
  const crossesWindow = segmentIntersectsRect(a, enemy, win);
  const wallBlocked = firstSolidBulletBlocker(level, a, enemy);
  return crossesWindow && !wallBlocked && Boolean(segmentCircleHit(a, enemy, enemy, enemy.radius + 2));
}

function segmentCircleHit(a, b, circle, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((circle.x - a.x) * dx + (circle.y - a.y) * dy) / lengthSq, 0, 1);
  const closest = { x: a.x + dx * t, y: a.y + dy * t };
  return pointDistance(closest, circle) <= radius;
}

function randomPassword() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  let out = angle;
  while (out <= -Math.PI) out += TWO_PI;
  while (out > Math.PI) out -= TWO_PI;
  return out;
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function circleRectCollides(circle, rect, padding = 0) {
  const closestX = clamp(circle.x, rect.x - padding, rect.x + rect.w + padding);
  const closestY = clamp(circle.y, rect.y - padding, rect.y + rect.h + padding);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function pointRectDistance(point, rect) {
  const closestX = clamp(point.x, rect.x, rect.x + rect.w);
  const closestY = clamp(point.y, rect.y, rect.y + rect.h);
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function rectCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function normalizedVector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
}

function lineSegmentsIntersect(a, b, c, d) {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(det) < 0.0001) return false;
  const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
  const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
  return lambda >= 0 && lambda <= 1 && gamma >= 0 && gamma <= 1;
}

function segmentIntersectsRect(a, b, rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const r1 = { x: rect.x, y: rect.y };
  const r2 = { x: rect.x + rect.w, y: rect.y };
  const r3 = { x: rect.x + rect.w, y: rect.y + rect.h };
  const r4 = { x: rect.x, y: rect.y + rect.h };
  return lineSegmentsIntersect(a, b, r1, r2)
    || lineSegmentsIntersect(a, b, r2, r3)
    || lineSegmentsIntersect(a, b, r3, r4)
    || lineSegmentsIntersect(a, b, r4, r1);
}

function doorBlocks(door) {
  return door.state === "closed";
}

function blockingRects(level) {
  return [
    ...level.walls,
    ...level.doors.filter(doorBlocks),
    ...(level.windows || []).filter((win) => win.state === "closed")
  ];
}

function collidesWithMap(level, circle) {
  return blockingRects(level).some((rect) => circleRectCollides(circle, rect));
}

function collidesWithWalls(level, circle) {
  return level.walls.some((rect) => circleRectCollides(circle, rect));
}

function hasLineOfSight(a, b, level) {
  const blockers = [
    ...level.walls,
    ...level.doors.filter(doorBlocks)
  ];
  return !blockers.some((rect) => segmentBlockedByRectThroughWindows(level, a, b, rect));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function segmentBlockedByRectThroughWindows(level, a, b, rect) {
  if (!segmentIntersectsRect(a, b, rect)) return false;
  const windowOpening = (level.windows || []).some((win) => segmentIntersectsRect(a, b, win) && rectsOverlap(rect, win));
  return !windowOpening;
}

function inFieldOfView(observer, target) {
  if (pointDistance(observer, target) > observer.sightRange) return false;
  const delta = Math.abs(normalizeAngle(angleTo(observer, target) - observer.angle));
  return delta <= observer.fov / 2;
}

function inflateRect(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    w: rect.w + amount * 2,
    h: rect.h + amount * 2
  };
}

function nearestClosedDoorOnRoute(level, op, next) {
  let best = null;
  let bestDist = Infinity;
  for (const door of level.doors) {
    if (!doorBlocks(door)) continue;
    const crossing = segmentIntersectsRect({ x: op.x, y: op.y }, next, inflateRect(door, 8));
    const distance = pointRectDistance(op, door);
    const close = distance < 38;
    if ((crossing || close) && close && distance < bestDist) {
      best = door;
      bestDist = distance;
    }
  }
  return best;
}

function hasPaperFor(level, door) {
  return level.operators.some((op) => op.inventory.items.some((item) => item.type === "paper" && item.passwordFor === door.id && item.text.includes(door.password)));
}

function tryOpenDoor(level, op, door) {
  if (!door || !doorBlocks(door)) return false;
  if (door.lockType === "digital" && door.locked !== false) {
    if (!hasPaperFor(level, door)) return true;
    door.locked = false;
    return true;
  }
  if (!op.action) {
    op.action = { type: "breach", doorId: door.id, timer: 0.34 };
  }
  return true;
}

function tryPickupItems(level, op) {
  for (const item of level.items || []) {
    if (item.picked) continue;
    const rect = { x: item.x, y: item.y, w: item.w || 22, h: item.h || 18 };
    if (pointRectDistance(op, rect) < 32) {
      item.picked = true;
      op.inventory.items.push({ ...item });
    }
  }
}

function tryUseStairs(level, op) {
  const next = op.path[0];
  if (!next) return false;
  for (const stair of level.stairs || []) {
    if (!stair.target) continue;
    if (!pointInRect(next, inflateRect(stair, 6))) continue;
    if (pointRectDistance(op, stair) < 18) {
      op.x = stair.target.x;
      op.y = stair.target.y;
      op.path.shift();
      op.path = op.path.filter((point) => point.x > level.width / 2);
      return true;
    }
  }
  return false;
}

function tryUseWindows(level, op) {
  const next = op.path[0];
  if (!next) return false;
  for (const win of level.windows || []) {
    const center = rectCenter(win);
    const near = pointRectDistance(op, win) < 28;
    const crossing = win.orientation === "vertical"
      ? (op.x < center.x && next.x > center.x) || (op.x > center.x && next.x < center.x)
      : (op.y < center.y && next.y > center.y) || (op.y > center.y && next.y < center.y);
    if (near && crossing) {
      win.state = win.state === "closed" ? "open" : win.state;
      op.x = win.orientation === "vertical" ? (op.x < center.x ? center.x + 34 : center.x - 34) : center.x;
      op.y = win.orientation === "vertical" ? center.y : (op.y < center.y ? center.y + 34 : center.y - 34);
      return true;
    }
  }
  return false;
}

function applyDamage(unit, amount) {
  let remaining = amount;
  if (unit.armor > 0) {
    const absorbed = Math.min(unit.armor, remaining);
    unit.armor -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    unit.health -= remaining;
  }
}

function damageEnemy(enemy, amount) {
  applyDamage(enemy, amount);
  if (enemy.health <= 0) {
    enemy.health = 0;
    enemy.down = true;
    enemy.respawnTimer = enemy.respawnDelay || 0;
    enemy.targetId = null;
    enemy.fireTimer = 0;
  }
}

function damageOperator(op, amount) {
  applyDamage(op, amount);
  if (op.health <= 0) {
    op.health = 0;
    op.down = true;
    op.path = [];
    op.action = null;
    op.fireTimer = 0;
  }
}

function fireAutomatic(shooter, target, weapon, dt, damageTarget) {
  if (weapon.canFire === false) return;
  if (shooter.targetId !== target.id) {
    shooter.targetId = target.id;
    shooter.reaction = 0;
    shooter.fireTimer = 0;
  }

  shooter.reaction += dt;
  shooter.fireTimer = Math.max(0, shooter.fireTimer - dt);
  if (shooter.reaction < weapon.reactionDelay || shooter.fireTimer > 0) return;

  damageTarget(target, weapon.damage);
  shooter.fireTimer = weapon.fireInterval;
}

function updateOperator(level, op, dt) {
  if (op.down) return;
  tryPickupItems(level, op);
  if (tryUseStairs(level, op)) return;
  if (tryUseWindows(level, op)) return;
  if (op.action) {
    op.action.timer -= dt;
    if (op.action.timer <= 0) {
      const door = level.doors.find((item) => item.id === op.action.doorId);
      if (door) door.state = "breached";
      op.action = null;
    }
    return;
  }

  const target = op.path[0];
  if (!target) return;

  const door = nearestClosedDoorOnRoute(level, op, target);
  if (door && tryOpenDoor(level, op, door)) return;

  const dist = pointDistance(op, target);
  if (dist < 4) {
    op.path.shift();
    return;
  }

  const direction = angleTo(op, target);
  op.aim = direction;
  const step = Math.min(dist, op.speed * dt);
  const next = {
    x: op.x + Math.cos(direction) * step,
    y: op.y + Math.sin(direction) * step,
    radius: op.radius
  };

  if (!collidesWithMap(level, next)) {
    op.x = next.x;
    op.y = next.y;
  }
}

function updateOperatorCombat(level, op, dt) {
  if (op.down) return;
  const weapon = weaponById(op.weaponId);
  if (weapon.canFire === false) return;
  const visible = level.enemies
    .filter((enemy) => !enemy.down)
    .filter((enemy) => pointDistance(op, enemy) <= weapon.range)
    .filter((enemy) => hasLineOfSight(op, enemy, level))
    .sort((a, b) => pointDistance(op, a) - pointDistance(op, b));

  const target = visible[0];
  if (!target) {
    op.targetId = null;
    op.reaction = Math.max(0, op.reaction - dt * 0.9);
    op.fireTimer = Math.max(0, op.fireTimer - dt);
    return;
  }

  op.aim = angleTo(op, target);
  fireAutomatic(op, target, weapon, dt, damageEnemy);
}

function updateEnemy(level, enemy, dt) {
  if (enemy.down) {
    if (!enemy.respawnDelay) return;
    enemy.respawnTimer = Math.max(0, (enemy.respawnTimer || enemy.respawnDelay) - dt);
    if (enemy.respawnTimer <= 0) {
      enemy.x = enemy.spawn.x;
      enemy.y = enemy.spawn.y;
      enemy.angle = enemy.spawn.angle;
      enemy.health = 100;
      enemy.armor = enemy.maxArmor;
      enemy.down = false;
      enemy.targetId = null;
      enemy.fireTimer = 0;
      enemy.reaction = 0;
    }
    return;
  }
  const weapon = weaponById(enemy.weaponId);
  const liveOps = level.operators.filter((op) => !op.down);
  const seen = liveOps
    .filter((op) => pointDistance(enemy, op) <= weapon.range)
    .find((op) => inFieldOfView(enemy, op) && hasLineOfSight(enemy, op, level));
  if (seen) {
    enemy.angle = angleTo(enemy, seen);
    fireAutomatic(enemy, seen, weapon, dt, damageOperator);
    return;
  }

  enemy.targetId = null;
  enemy.reaction = Math.max(0, enemy.reaction - dt * 0.8);
  enemy.fireTimer = Math.max(0, enemy.fireTimer - dt);
  if (enemy.watch) {
    enemy.angle = angleTo(enemy, enemy.watch);
    return;
  }
  updateEnemyPatrol(level, enemy, dt);
}

function updateEnemyPatrol(level, enemy, dt) {
  if (!enemy.patrol || enemy.patrol.length < 2) return;
  const target = enemy.patrol[enemy.patrolIndex];
  const dist = pointDistance(enemy, target);
  if (dist < 5) {
    enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
    return;
  }
  const direction = angleTo(enemy, target);
  enemy.angle = direction;
  const next = {
    x: enemy.x + Math.cos(direction) * enemy.speed * dt,
    y: enemy.y + Math.sin(direction) * enemy.speed * dt,
    radius: enemy.radius
  };
  if (!collidesWithMap(level, next)) {
    enemy.x = next.x;
    enemy.y = next.y;
  }
}

function updateObjective(level) {
  if (level.objective.secured || level.objective.harmed) return;
  if (level.operators.some((op) => !op.down && pointDistance(op, level.objective) < 34)) {
    level.objective.secured = true;
  }
}

function simplifyPath(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 0.001) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

function findPath(level, start, goal) {
  const cols = Math.floor((level.width || 960) / CELL);
  const rows = Math.floor((level.height || 640) / CELL);
  const key = (c, r) => `${c},${r}`;
  const toCell = (p) => ({
    c: clamp(Math.round(p.x / CELL), 0, cols - 1),
    r: clamp(Math.round(p.y / CELL), 0, rows - 1)
  });
  const toPoint = (c, r) => ({ x: c * CELL, y: r * CELL });
  const pass = (c, r) => {
    const point = toPoint(c, r);
    return !collidesWithWalls(level, { x: point.x, y: point.y, radius: UNIT_RADIUS });
  };

  const startCell = toCell(start);
  const goalCell = toCell(goal);
  const open = [startCell];
  const came = new Map();
  const g = new Map([[key(startCell.c, startCell.r), 0]]);
  const f = new Map([[
    key(startCell.c, startCell.r),
    pointDistance(toPoint(startCell.c, startCell.r), toPoint(goalCell.c, goalCell.r))
  ]]);
  const closed = new Set();
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  while (open.length) {
    open.sort((a, b) => (f.get(key(a.c, a.r)) ?? Infinity) - (f.get(key(b.c, b.r)) ?? Infinity));
    const cur = open.shift();
    const curKey = key(cur.c, cur.r);
    if (cur.c === goalCell.c && cur.r === goalCell.r) {
      const cells = [];
      let nodeKey = curKey;
      while (nodeKey) {
        const [c, r] = nodeKey.split(",").map(Number);
        cells.push(toPoint(c, r));
        nodeKey = came.get(nodeKey);
      }
      return simplifyPath(cells.reverse().concat([goal]));
    }

    closed.add(curKey);
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      const nextKey = key(nc, nr);
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || closed.has(nextKey) || !pass(nc, nr)) {
        continue;
      }

      const tentative = (g.get(curKey) ?? Infinity) + Math.hypot(dc, dr);
      if (tentative < (g.get(nextKey) ?? Infinity)) {
        came.set(nextKey, curKey);
        g.set(nextKey, tentative);
        f.set(nextKey, tentative + pointDistance(toPoint(nc, nr), goal));
        if (!open.some((node) => node.c === nc && node.r === nr)) {
          open.push({ c: nc, r: nr });
        }
      }
    }
  }

  return null;
}

function appendPath(level, out, from, to) {
  const route = findPath(level, from, to);
  if (!route) return false;
  out.push(...route.slice(1));
  return true;
}

function buildMissionRoute(level, op) {
  return buildRouteToTarget(level, op, level.objective, true);
}

function buildRouteToTarget(level, op, target, includePaper = false) {
  const out = [];
  let cursor = { x: op.x, y: op.y };
  const paper = includePaper ? (level.items || []).find((item) => item.type === "paper" && !item.picked) : null;
  if (paper) {
    const paperPoint = { x: paper.x + (paper.w || 22) / 2, y: paper.y + (paper.h || 18) / 2 };
    if (!appendPath(level, out, cursor, paperPoint)) return null;
    cursor = paperPoint;
  }
  if (!findPath(level, cursor, target) && (level.stairs || []).length) {
    const startStair = level.stairs.find((stair) => stair.target && stair.x < level.width / 2);
    if (startStair) {
      const stairPoint = rectCenter(startStair);
      if (!appendPath(level, out, cursor, stairPoint)) return null;
      cursor = { x: startStair.target.x, y: startStair.target.y };
      if (includePaper && level.id === "house-blueprint") {
        out.push({ x: 1160, y: 540 }, { x: 1160, y: 392 }, { x: 1160, y: 318 }, target);
        return out;
      }
    }
  }
  if (!findPath(level, cursor, target) && (level.windows || []).length) {
    const win = level.windows[0];
    const center = rectCenter(win);
    const near = win.orientation === "vertical"
      ? { x: cursor.x < center.x ? center.x - 34 : center.x + 34, y: center.y }
      : { x: center.x, y: cursor.y < center.y ? center.y - 34 : center.y + 34 };
    const far = win.orientation === "vertical"
      ? { x: cursor.x < center.x ? center.x + 34 : center.x - 34, y: center.y }
      : { x: center.x, y: cursor.y < center.y ? center.y + 34 : center.y - 34 };
    if (appendPath(level, out, cursor, near)) {
      cursor = far;
    }
  }
  if (!appendPath(level, out, cursor, target)) return null;
  return out;
}

function assessDoorFacing(level) {
  const openLevel = cloneLevel(level);
  for (const door of openLevel.doors) door.state = "open";
  if (!openLevel.doors.length) return [];

  return openLevel.enemies.map((enemy) => {
    const best = openLevel.doors
      .map((door) => {
        const center = rectCenter(door);
        const operatorScore = openLevel.operators.reduce((score, op) => {
          const missionVector = normalizedVector(op, openLevel.objective);
          const doorVector = normalizedVector(op, center);
          return Math.max(score, dot(missionVector, doorVector));
        }, -Infinity);
        const enemyDistance = pointDistance(enemy, center);
        return {
          door,
          center,
          score: operatorScore * 280 - enemyDistance
        };
      })
      .sort((a, b) => b.score - a.score)[0];

    const expectedAngle = angleTo(enemy, best.center);
    const watch = enemy.watch || { x: enemy.x + Math.cos(enemy.angle) * 80, y: enemy.y + Math.sin(enemy.angle) * 80 };
    const watchAngle = angleTo(enemy, watch);
    const angleDelta = Math.abs(normalizeAngle(watchAngle - expectedAngle));
    const closeEquivalent = pointDistance(watch, best.center) <= 95;
    const facing = angleDelta <= 0.45 || closeEquivalent;

    return {
      id: enemy.id,
      expectedDoor: best.door.id,
      watch,
      angleDelta: Number(angleDelta.toFixed(3)),
      facing
    };
  });
}

function simulate(levelRaw) {
  const level = cloneLevel(levelRaw);
  const watchLevel = cloneLevel(levelRaw);
  for (const door of watchLevel.doors) door.state = "open";
  const watchCoverage = watchLevel.enemies
    .filter((enemy) => enemy.watch)
    .map((enemy) => {
      enemy.angle = angleTo(enemy, enemy.watch);
      return {
        id: enemy.id,
        watch: enemy.watch,
        covered: inFieldOfView(enemy, enemy.watch) && hasLineOfSight(enemy, enemy.watch, watchLevel)
      };
    });
  const enemyReachability = level.enemies.map((enemy) => ({
    id: enemy.id,
    reachable: level.operators.some((op) => Boolean(buildRouteToTarget(level, op, enemy)))
  }));
  const laptopReachable = (level.laptops || []).length
    ? level.laptops.some((laptop) => level.operators.some((op) => Boolean(findPath(level, op, rectCenter(laptop)))))
    : true;
  const doorFacing = assessDoorFacing(levelRaw);
  const tutorial = validateTutorial(levelRaw);

  for (const op of level.operators) {
    const route = buildMissionRoute(level, op);
    if (!route) return { result: "no-path", title: level.title, op: op.id };
    op.path = route;
  }

  let result = "timeout";
  let t = 0;
  for (let step = 0; step < 45 / DT; step += 1) {
    t += DT;
    for (const op of level.operators) updateOperator(level, op, DT);
    for (const op of level.operators) updateOperatorCombat(level, op, DT);
    for (const enemy of level.enemies) updateEnemy(level, enemy, DT);
    updateObjective(level);

    const liveOps = level.operators.some((op) => !op.down);
    const allEnemiesDown = level.enemies.length > 0
      && !level.requireObjective
      && level.enemies.every((enemy) => !enemy.respawnDelay)
      && level.enemies.every((enemy) => enemy.down);
    if (level.objective.secured || allEnemiesDown) {
      result = "success";
      break;
    }
    if (!liveOps || level.objective.harmed) {
      result = "failure";
      break;
    }
  }

  return {
    result,
    title: level.title,
    t: Number(t.toFixed(2)),
    objective: level.objective.secured,
    passwordPuzzle: {
      generated: Object.keys(level.generatedPasswords || {}).length,
      papersFound: level.operators.reduce((count, op) => count + op.inventory.items.filter((item) => item.type === "paper").length, 0),
      digitalDoorsOpen: level.doors.filter((door) => door.lockType === "digital").every((door) => door.locked === false || door.state !== "closed")
    },
    enemiesDown: `${level.enemies.filter((enemy) => enemy.down).length}/${level.enemies.length}`,
    watchCoverage,
    doorFacing,
    enemyReachability,
    laptopReachable,
    windowShotThrough: windowShotThroughTest(level),
    tutorial,
    operators: level.operators.map((op) => ({
      id: op.id,
      hp: Number(op.health.toFixed(1)),
      armor: Number(op.armor.toFixed(1)),
      down: op.down,
      x: Number(op.x.toFixed(1)),
      y: Number(op.y.toFixed(1)),
      remainingWaypoints: op.path.length
    })),
    doors: level.doors.map((door) => ({ id: door.id, state: door.state }))
  };
}

let failed = false;
for (const entry of [
  ...LEVEL_FILES.map((file) => ({ file, dir: "level" })),
  ...TUTORIAL_FILES.map((file) => ({ file, dir: "tutorials" }))
]) {
  const level = JSON.parse(fs.readFileSync(path.join(entry.dir, entry.file), "utf8"));
  const result = simulate(level);
  console.log(JSON.stringify(result, null, 2));
  const isTutorial = entry.dir === "tutorials";
  if (
    result.result !== "success"
    || (!isTutorial && result.watchCoverage.some((watch) => !watch.covered))
    || (!isTutorial && result.doorFacing.some((door) => !door.facing))
    || result.enemyReachability.some((enemy) => !enemy.reachable)
    || !result.laptopReachable
    || !result.windowShotThrough
    || !result.tutorial.valid
  ) {
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;
