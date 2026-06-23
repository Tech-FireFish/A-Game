"use strict";

(function () {
  // Builds a focused camera that follows the selected operator.
  function create(deps) {
    const camera = {
      x: deps.defaultWorld.w / 2,
      y: deps.defaultWorld.h / 2,
      zoom: 1.38,
      targetZoom: 1.38,
      defaultZoom: 1.38,
      viewValue: 60,
      shakeTime: 0,
      shakeDuration: 0,
      shakeIntensity: 0
    };
    const viewport = {
      w: deps.defaultWorld.w,
      h: deps.defaultWorld.h,
      pixelRatio: 1
    };
    const padding = {
      x: 180,
      y: 140
    };

    // Matches the canvas backing buffer to its CSS size and device pixel ratio.
    function resizeCanvas() {
      const rect = deps.canvas.getBoundingClientRect();
      const cssW = Math.max(1, rect.width || deps.defaultWorld.w);
      const cssH = Math.max(1, rect.height || deps.defaultWorld.h);
      const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const nextW = Math.round(cssW * ratio);
      const nextH = Math.round(cssH * ratio);
      viewport.w = cssW;
      viewport.h = cssH;
      viewport.pixelRatio = ratio;
      if (deps.canvas.width !== nextW) deps.canvas.width = nextW;
      if (deps.canvas.height !== nextH) deps.canvas.height = nextH;
      updateTargetZoom();
      clampToWorld();
    }

    // Moves the camera toward the selected operator and clamps to world bounds.
    function update(dt) {
      const op = deps.selectedOperator();
      if (!op) return;
      const follow = 1 - Math.pow(0.001, dt);
      camera.x += (op.x - camera.x) * follow;
      camera.y += (op.y - camera.y) * follow;
      camera.zoom += (camera.targetZoom - camera.zoom) * follow;
      camera.shakeTime = Math.max(0, camera.shakeTime - dt);
      if (camera.shakeTime <= 0) camera.shakeIntensity = 0;
      clampToWorld();
    }

    // Keeps the camera inside the current world rectangle.
    function clampToWorld() {
      const viewW = viewport.w / camera.zoom;
      const viewH = viewport.h / camera.zoom;
      camera.x = deps.clamp(camera.x, -padding.x + viewW / 2, Math.max(-padding.x + viewW / 2, deps.world.w + padding.x - viewW / 2));
      camera.y = deps.clamp(camera.y, -padding.y + viewH / 2, Math.max(-padding.y + viewH / 2, deps.world.h + padding.y - viewH / 2));
    }

    // Sets the player-facing view slider and recalculates the camera zoom target.
    function setViewValue(value) {
      const next = Number(value);
      camera.viewValue = deps.clamp(Number.isFinite(next) ? next : 60, 0, 100);
      updateTargetZoom();
      clampToWorld();
    }

    // Recomputes the target zoom from the current viewport, world, and slider value.
    function updateTargetZoom() {
      const defaultZoom = camera.defaultZoom;
      const fitZoom = Math.min(
        defaultZoom,
        viewport.w / Math.max(1, deps.world.w),
        viewport.h / Math.max(1, deps.world.h)
      );
      const maxZoom = defaultZoom * 4;
      if (camera.viewValue <= 50) {
        camera.targetZoom = lerp(fitZoom, defaultZoom, camera.viewValue / 50);
      } else {
        camera.targetZoom = lerp(defaultZoom, maxZoom, (camera.viewValue - 50) / 50);
      }
      if (!Number.isFinite(camera.zoom) || camera.zoom <= 0) camera.zoom = camera.targetZoom;
    }

    // Blends between two zoom endpoints.
    function lerp(start, end, t) {
      return start + (end - start) * deps.clamp(t, 0, 1);
    }

    // Applies the world transform before map rendering.
    function apply(ctx) {
      const scale = camera.zoom * viewport.pixelRatio;
      const shake = shakeOffset();
      ctx.setTransform(scale, 0, 0, scale, ((-camera.x + shake.x) * camera.zoom + viewport.w / 2) * viewport.pixelRatio, ((-camera.y + shake.y) * camera.zoom + viewport.h / 2) * viewport.pixelRatio);
    }

    // Restores identity transform for screen-space clearing or overlays.
    function reset(ctx) {
      ctx.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
    }

    // Converts a screen/canvas coordinate into world space.
    function screenToWorld(point) {
      return {
        x: (point.x - viewport.w / 2) / camera.zoom + camera.x,
        y: (point.y - viewport.h / 2) / camera.zoom + camera.y
      };
    }

    // Returns camera state for debug or status systems.
    function getCamera() {
      return camera;
    }

    // Returns logical CSS-pixel viewport dimensions for rendering helpers.
    function getViewport() {
      return viewport;
    }

    // Returns the non-playable camera padding around authored maps.
    function getPadding() {
      return padding;
    }

    // Starts a short camera shake for weapon feedback.
    function triggerShake(intensity = 1.5, duration = 0.12) {
      camera.shakeIntensity = Math.max(camera.shakeIntensity, Math.max(0, intensity));
      camera.shakeDuration = Math.max(camera.shakeDuration, Math.max(0.01, duration));
      camera.shakeTime = Math.max(camera.shakeTime, Math.max(0.01, duration));
    }

    // Computes a deterministic shake offset for the current frame.
    function shakeOffset() {
      if (camera.shakeTime <= 0 || camera.shakeIntensity <= 0) return { x: 0, y: 0 };
      const progress = camera.shakeDuration > 0 ? camera.shakeTime / camera.shakeDuration : 0;
      const amount = camera.shakeIntensity * progress;
      const phase = camera.shakeTime * 72;
      return {
        x: Math.sin(phase) * amount,
        y: Math.cos(phase * 1.37) * amount * 0.68
      };
    }

    return {
      resizeCanvas,
      update,
      setViewValue,
      apply,
      reset,
      screenToWorld,
      getCamera,
      getViewport,
      getPadding,
      triggerShake
    };
  }

  window.CameraSystem = { create };
}());
