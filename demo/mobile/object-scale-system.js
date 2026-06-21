"use strict";

(function () {
  // Builds mobile text density scaling while leaving gameplay geometry authored.
  function create(deps) {
    const config = deps.config || {};
    const baseWidth = Number(config.baseWidth) || 1920;
    const baseHeight = Number(config.baseHeight) || 1080;
    const minObjectScale = Number(config.minObjectScale) || 0.65;
    let scale = 1;

    // Recomputes text/UI scale from the current viewport.
    function update() {
      const viewport = deps.camera && deps.camera.getViewport
        ? deps.camera.getViewport()
        : { w: window.innerWidth || baseWidth, h: window.innerHeight || baseHeight };
      const next = Math.min(viewport.w / baseWidth, viewport.h / baseHeight);
      scale = Math.max(minObjectScale, Math.min(1, next || 1));
      document.documentElement.style.setProperty("--mobile-ui-scale", scale.toFixed(3));
      return scale;
    }

    // Returns the current mobile text/UI scale.
    function objectScale() {
      return scale;
    }

    // Keeps gameplay radii at authored size.
    function scaledRadius(obj) {
      return Number(obj && obj.radius) || 0;
    }

    // Keeps gameplay rectangles at authored size.
    function scaledRect(rect) {
      return rect;
    }

    // Keeps gameplay rectangles visually at authored size.
    function scaledRectVisual(rect) {
      return rect;
    }

    // Keeps gameplay circles at authored size.
    function scaledCircle(circle) {
      return circle;
    }

    // Measures point-to-authored-rectangle distance.
    function scaledPointRectDistance(point, rect) {
      return deps.pointRectDistance(point, scaledRect(rect));
    }

    update();

    return {
      update,
      objectScale,
      scaledRadius,
      scaledRect,
      scaledRectVisual,
      scaledCircle,
      scaledPointRectDistance,
      scaleHitboxes: () => false
    };
  }

  window.ObjectScaleSystem = { create };
}());
