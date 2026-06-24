"use strict";

(function () {
  // Builds map math, collision, line-of-sight, and door helper functions.
  function create(deps) {
    const runtime = deps.runtime;
    const canvas = deps.canvas;
    const twoPi = deps.twoPi;

    // Converts a browser mouse event into canvas world coordinates.
    function getMouseWorld(event) {
      const rect = canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      return deps.camera ? deps.camera.screenToWorld(point) : point;
    }

    // Measures straight-line distance between two world points.
    function pointDistance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    // Restricts a number to an inclusive min/max interval.
    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    // Wraps an angle into the -PI to PI range.
    function normalizeAngle(angle) {
      let out = angle;
      while (out <= -Math.PI) out += twoPi;
      while (out > Math.PI) out -= twoPi;
      return out;
    }

    // Computes the facing angle from one point to another.
    function angleTo(a, b) {
      return Math.atan2(b.y - a.y, b.x - a.x);
    }

    // Tests a circular unit body against a rectangular blocker.
    function circleRectCollides(circle, rect, padding = 0) {
      const closestX = clamp(circle.x, rect.x - padding, rect.x + rect.w + padding);
      const closestY = clamp(circle.y, rect.y - padding, rect.y + rect.h + padding);
      const dx = circle.x - closestX;
      const dy = circle.y - closestY;
      return dx * dx + dy * dy <= circle.radius * circle.radius;
    }

    // Finds the shortest distance from a point to a rectangle.
    function pointRectDistance(point, rect) {
      const closestX = clamp(point.x, rect.x, rect.x + rect.w);
      const closestY = clamp(point.y, rect.y, rect.y + rect.h);
      return Math.hypot(point.x - closestX, point.y - closestY);
    }

    // Returns the center point of a rectangle.
    function rectCenter(rect) {
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }

    // Keeps the compatibility geometry API at authored rectangle dimensions.
    function scaledRect(rect) {
      return rect;
    }

    // Keeps the compatibility geometry API at authored circle dimensions.
    function scaledRadius(obj) {
      return obj.radius;
    }

    // Measures from a point to an authored non-wall rectangle.
    function scaledPointRectDistance(point, rect) {
      return pointRectDistance(point, scaledRect(rect));
    }

    // Treats closed doors as blocking movement and sight.
    function doorBlocks(door) {
      return door.state === "closed";
    }

    // Treats stable open/closed doors as interactable; moving doors are ignored.
    function doorCanInteract(door) {
      return door && (door.state === "closed" || door.state === "open" || !door.state);
    }

    // Combines walls and closed doors into the active blocker list.
    function blockingRects(level) {
      return [
        ...level.walls,
        ...level.doors.filter(doorBlocks).map(scaledRect),
        ...(level.windows || []).filter(windowBlocks).map(scaledRect)
      ];
    }

    // Checks whether a circular unit would collide with any map blocker.
    function collidesWithMap(level, circle) {
      return blockingRects(level).some((rect) => circleRectCollides(circle, rect));
    }

    // Tests whether a point lies inside a rectangle.
    function pointInRect(point, rect) {
      return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    }

    // Checks whether a line segment crosses or touches a rectangle.
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

    // Tests two finite line segments for intersection.
    function lineSegmentsIntersect(a, b, c, d) {
      const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(det) < 0.0001) return false;
      const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
      const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
      return lambda >= 0 && lambda <= 1 && gamma >= 0 && gamma <= 1;
    }

    // Verifies that walls and closed doors do not block a sight line.
    function hasLineOfSight(a, b, level) {
      const blockers = [
        ...level.walls,
        ...level.doors.filter(doorBlocks).map(scaledRect)
      ];
      return !blockers.some((rect) => segmentBlockedByRectThroughWindows(a, b, rect, level));
    }

    // Verifies sight while allowing the target structure to reveal itself.
    function hasLineOfSightIgnoring(a, b, level, ignoredRect) {
      const blockers = [
        ...level.walls,
        ...level.doors.filter(doorBlocks)
      ].filter((rect) => rect !== ignoredRect).map((rect) => level.walls.includes(rect) ? rect : scaledRect(rect));
      return !blockers.some((rect) => segmentBlockedByRectThroughWindows(a, b, rect, level));
    }

    // Lets sight and bullets pass through wall sections occupied by windows.
    function segmentBlockedByRectThroughWindows(a, b, rect, level) {
      if (!segmentIntersectsRect(a, b, rect)) return false;
      const windowOpening = (level.windows || []).some((win) => {
        const scaledWindow = scaledRect(win);
        return segmentIntersectsRect(a, b, scaledWindow) && rectsOverlap(rect, scaledWindow);
      });
      return !windowOpening;
    }

    // Tests rough rectangle overlap for wall-window openings.
    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // Treats closed windows as movement blockers that bullets can still cross.
    function windowBlocks(win) {
      return win.state === "closed";
    }

    // Checks target distance and angle against an observer vision cone.
    function inFieldOfView(observer, target) {
      const distance = pointDistance(observer, target);
      if (distance > observer.sightRange) return false;
      const delta = Math.abs(normalizeAngle(angleTo(observer, target) - observer.angle));
      return delta <= observer.fov / 2;
    }

    // Finds the closest closed door crossed by a planned movement step.
    function nearestClosedDoorOnRoute(op, next) {
      let best = null;
      let bestDist = Infinity;
      for (const door of runtime.state.level.doors) {
        if (!doorBlocks(door)) continue;
        const scaledDoor = scaledRect(door);
        const crossing = segmentIntersectsRect({ x: op.x, y: op.y }, next, inflateRect(scaledDoor, 8));
        const distance = pointRectDistance(op, scaledDoor);
        const close = distance < 38;
        if ((crossing || close) && close && distance < bestDist) {
          best = door;
          bestDist = distance;
        }
      }
      return best;
    }

    // Finds the nearest reachable closed door around an operator.
    function nearestClosedDoorToOperator(op, maxDistance = 52) {
      let best = null;
      let bestDist = Infinity;
      for (const door of runtime.state.level.doors) {
        if (!doorBlocks(door)) continue;
        const distance = scaledPointRectDistance(op, door);
        if (distance < maxDistance && distance < bestDist) {
          best = door;
          bestDist = distance;
        }
      }
      return best;
    }

    // Finds a stable door under a click/touch point.
    function doorAtPoint(point) {
      return runtime.state.level.doors.find((door) => doorCanInteract(door) && pointInRect(point, inflateRect(scaledRect(door), 6)));
    }

    // Finds a window under a click/touch point.
    function windowAtPoint(point) {
      return (runtime.state.level.windows || []).find((win) => pointInRect(point, inflateRect(scaledRect(win), 6)));
    }

    // Expands a rectangle outward for forgiving interaction checks.
    function inflateRect(rect, amount) {
      return {
        x: rect.x - amount,
        y: rect.y - amount,
        w: rect.w + amount * 2,
        h: rect.h + amount * 2
      };
    }

    // Identifies doors that use the digital lock interaction flow.
    function isDigitalLockDoor(door) {
      return door && door.lockType === "digital";
    }

    // Identifies digital doors that still require a password unlock.
    function isLockedDigitalDoor(door) {
      return isDigitalLockDoor(door) && door.locked !== false;
    }

    return {
      getMouseWorld,
      pointDistance,
      clamp,
      normalizeAngle,
      angleTo,
      circleRectCollides,
      pointRectDistance,
      scaledRect,
      scaledRadius,
      scaledPointRectDistance,
      rectCenter,
      doorBlocks,
      doorCanInteract,
      blockingRects,
      collidesWithMap,
      pointInRect,
      segmentIntersectsRect,
      lineSegmentsIntersect,
      hasLineOfSight,
      hasLineOfSightIgnoring,
      segmentBlockedByRectThroughWindows,
      rectsOverlap,
      windowBlocks,
      inFieldOfView,
      nearestClosedDoorOnRoute,
      nearestClosedDoorToOperator,
      doorAtPoint,
      windowAtPoint,
      inflateRect,
      isDigitalLockDoor,
      isLockedDigitalDoor
    };
  }

  window.GeometrySystem = { create };
}());
