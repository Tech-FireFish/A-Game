"use strict";

(function () {
  // Builds laptop camera hacking overlay state and reveal helpers.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;

    // Opens the laptop overlay and pauses gameplay.
    function openLaptop(laptop) {
      if (!runtime.state || runtime.laptopOpen || runtime.settingsOpen || runtime.digitalLockOpen) return;
      runtime.activeLaptopId = laptop.id;
      runtime.laptopResumeRunning = Boolean(runtime.state.running);
      runtime.state.running = false;
      deps.keysDown.clear();
      runtime.laptopOpen = true;
      elements.laptopTitle.textContent = laptop.name || laptop.id || "Camera Access";
      elements.laptopOverlay.classList.remove("hidden");
      if (deps.audio) deps.audio.play("laptop-open");
      render();
      deps.updateHud();
    }

    // Closes the laptop overlay and restores execution if needed.
    function closeLaptop() {
      if (!runtime.laptopOpen) return;
      runtime.laptopOpen = false;
      elements.laptopOverlay.classList.add("hidden");
      if (runtime.state && !runtime.state.gameOver && runtime.laptopResumeRunning) {
        runtime.state.running = true;
      }
      runtime.laptopResumeRunning = false;
      deps.updateHud();
    }

    // Enables camera selection after the player starts the hack.
    function startHack() {
      const state = runtime.state;
      if (!state) return;
      state.cameraHack.started = true;
      state.message = "Camera labels online";
      if (deps.audio) deps.audio.play("hack-start");
      render();
      deps.updateHud();
    }

    // Toggles one camera's predefined reveal zone.
    function toggleCamera(cameraId) {
      const state = runtime.state;
      if (!state || !state.cameraHack.started) return;
      if (state.cameraHack.revealedCameras.has(cameraId)) {
        state.cameraHack.revealedCameras.delete(cameraId);
      } else {
        state.cameraHack.revealedCameras.add(cameraId);
      }
      if (deps.audio) deps.audio.play("camera-select");
      render();
      deps.updateHud();
    }

    // Reports whether a camera-hack zone has been revealed.
    function isZoneRevealed(zoneId) {
      const state = runtime.state;
      if (!state || !zoneId) return false;
      return state.cameraHack.revealedZones.has(zoneId) || state.cameraHack.discoveredZones.has(zoneId);
    }

    // Permanently remembers a hidden zone after it has been seen once.
    function discoverZone(zoneId) {
      const state = runtime.state;
      if (!state || !zoneId) return;
      state.cameraHack.discoveredZones.add(zoneId);
    }

    // Reports whether a map object should be shown by camera reveal state.
    function isRevealed(obj) {
      if (!obj || !obj.hiddenZone) return true;
      return isZoneRevealed(obj.hiddenZone);
    }

    // Rebuilds derived revealed zones from the selected cameras.
    function syncRevealedZones() {
      const state = runtime.state;
      if (!state) return;
      state.cameraHack.revealedZones.clear();
      for (const camera of state.level.cameras || []) {
        if (!state.cameraHack.revealedCameras.has(camera.id)) continue;
        for (const zone of camera.revealZones || []) {
          state.cameraHack.revealedZones.add(zone);
          state.cameraHack.discoveredZones.add(zone);
        }
      }
    }

    // Renders the laptop camera controls.
    function render() {
      const state = runtime.state;
      if (!state || !elements.cameraHackList) return;
      if (!state.cameraHack) initState(state);
      syncRevealedZones();
      elements.startHackButton.disabled = state.cameraHack.started;
      elements.startHackButton.textContent = state.cameraHack.started ? "Hack Running" : "Start Hacking";
      if (!state.cameraHack.started) {
        elements.cameraHackList.innerHTML = "<p class=\"empty-note\">Start the hack to locate cameras.</p>";
        return;
      }
      elements.cameraHackList.innerHTML = (state.level.cameras || []).map((camera) => {
        const active = state.cameraHack.revealedCameras.has(camera.id) ? " revealed" : "";
        return `<button type="button" class="${active}" data-camera-id="${camera.id}">${camera.label || camera.id}</button>`;
      }).join("") || "<p class=\"empty-note\">No cameras in this level.</p>";
    }

    // Adds camera-hack runtime state to a fresh game state.
    function initState(state) {
      state.cameraHack = {
        started: false,
        revealedCameras: new Set(),
        revealedZones: new Set(),
        discoveredZones: new Set()
      };
    }

    return {
      openLaptop,
      closeLaptop,
      startHack,
      toggleCamera,
      isZoneRevealed,
      isRevealed,
      discoverZone,
      syncRevealedZones,
      render,
      initState
    };
  }

  window.CameraHackSystem = { create };
}());
