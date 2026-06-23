"use strict";

(function () {
  // Builds digital lock overlay controls and password submission behavior.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;
    let enteredCode = "";

    // Opens the password overlay for a locked digital door.
    function openDigitalLock(door) {
      if (!runtime.state || !door || runtime.digitalLockOpen || runtime.settingsOpen) return;
      runtime.digitalLockResumeRunning = Boolean(runtime.state.running);
      runtime.state.running = false;
      deps.keysDown.clear();
      runtime.activeDigitalDoorId = door.id;
      enteredCode = "";
      elements.digitalLockTitle.textContent = `${door.id} Locked`;
      elements.digitalLockError.textContent = "";
      runtime.digitalLockOpen = true;
      elements.digitalLockOverlay.classList.remove("hidden");
      renderDisplay();
      deps.updateHud();
    }

    // Closes the password overlay and optionally resumes execution.
    function closeDigitalLock(restoreRunning = true) {
      if (!runtime.digitalLockOpen) return;
      runtime.digitalLockOpen = false;
      elements.digitalLockOverlay.classList.add("hidden");
      runtime.activeDigitalDoorId = null;
      if (restoreRunning && runtime.state && !runtime.state.gameOver && runtime.digitalLockResumeRunning) {
        runtime.state.running = true;
      }
      runtime.digitalLockResumeRunning = false;
      deps.updateHud();
    }

    // Adds a clicked keypad digit to the entered password.
    function appendDigit(digit) {
      if (!runtime.digitalLockOpen) return;
      if (!/^\d$/.test(digit)) return;
      const limit = currentPasswordLength();
      if (enteredCode.length >= limit) return;
      enteredCode += digit;
      deps.audio.play("digital-lock-keypad-press");
      elements.digitalLockError.textContent = "";
      renderDisplay();
    }

    // Removes the most recent keypad digit.
    function deleteDigit() {
      if (!runtime.digitalLockOpen) return;
      enteredCode = enteredCode.slice(0, -1);
      deps.audio.play("digital-lock-keypad-press");
      elements.digitalLockError.textContent = "";
      renderDisplay();
    }

    // Clears all clicked keypad digits.
    function clearCode() {
      if (!runtime.digitalLockOpen) return;
      enteredCode = "";
      deps.audio.play("digital-lock-keypad-press");
      elements.digitalLockError.textContent = "";
      renderDisplay();
    }

    // Renders masked password cells for the active code.
    function renderDisplay() {
      const length = currentPasswordLength();
      elements.digitalLockDisplay.innerHTML = Array.from({ length }, (_, index) => {
        const filled = index < enteredCode.length ? " filled" : "";
        return `<span class="lock-cell${filled}" aria-hidden="true"></span>`;
      }).join("");
      elements.digitalLockDisplay.setAttribute("aria-label", `${enteredCode.length} of ${length} digits entered`);
    }

    // Reads the active door password length, defaulting to four digits.
    function currentPasswordLength() {
      if (!runtime.state || !runtime.activeDigitalDoorId) return 4;
      const door = runtime.state.level.doors.find((item) => item.id === runtime.activeDigitalDoorId);
      return String(door ? (door.password || "0000") : "0000").length;
    }

    // Validates the entered password and unlocks the active door on success.
    function submitDigitalLock() {
      if (!runtime.state || !runtime.activeDigitalDoorId) return;
      const door = runtime.state.level.doors.find((item) => item.id === runtime.activeDigitalDoorId);
      if (!door) {
        closeDigitalLock(false);
        return;
      }
      if (enteredCode === (door.password || "0000")) {
        door.locked = false;
        door.state = "closed";
        runtime.state.message = `${door.id} unlocked`;
        deps.audio.play("digital-lock-correct");
        closeDigitalLock();
      } else {
        deps.audio.play("door-locked");
        elements.digitalLockError.textContent = "Incorrect password";
        enteredCode = "";
        renderDisplay();
      }
    }

    // Reports whether the digital lock overlay is currently open.
    function isOpen() {
      return runtime.digitalLockOpen;
    }

    return {
      openDigitalLock,
      closeDigitalLock,
      appendDigit,
      deleteDigit,
      clearCode,
      renderDisplay,
      submitDigitalLock,
      isOpen
    };
  }

  window.DigitalLockSystem = { create };
}());
