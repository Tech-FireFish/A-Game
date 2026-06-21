"use strict";

(function () {
  // Builds coarse-pointer mobile movement, interaction, and shortcut isolation controls.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;
    const moveActions = new Set(["moveUp", "moveDown", "moveLeft", "moveRight"]);
    let joystickPointer = null;

    // Initializes mobile control listeners.
    function bindEvents() {
      if (!elements.mobileControls) return;
      updateLayoutMode();
      window.addEventListener("resize", updateLayoutMode);
      window.addEventListener("orientationchange", updateLayoutMode);
      document.addEventListener("contextmenu", isolateMobileEvent);
      document.addEventListener("selectstart", isolateMobileEvent);
      document.addEventListener("touchmove", isolateMobileEvent, { passive: false });
      elements.mobileControls.addEventListener("contextmenu", preventDefault);
      elements.mobileControls.addEventListener("selectstart", preventDefault);
      elements.mobileControls.addEventListener("touchstart", preventDefault, { passive: false });
      elements.mobileControls.addEventListener("touchmove", preventDefault, { passive: false });
      if (elements.mobileMoveJoystick) {
        elements.mobileMoveJoystick.addEventListener("pointerdown", startJoystick);
        elements.mobileMoveJoystick.addEventListener("pointermove", moveJoystick);
        elements.mobileMoveJoystick.addEventListener("pointerup", stopJoystick);
        elements.mobileMoveJoystick.addEventListener("pointercancel", stopJoystick);
        elements.mobileMoveJoystick.addEventListener("pointerleave", stopJoystick);
      }
      if (elements.mobilePauseButton) elements.mobilePauseButton.addEventListener("click", deps.menu.togglePause);
      if (elements.mobileInteractButton) {
        elements.mobileInteractButton.addEventListener("pointerdown", handleMobileInteract);
        elements.mobileInteractButton.addEventListener("click", () => deps.interaction.interactNearest());
      }
      if (elements.mobileSwitchButton) {
        elements.mobileSwitchButton.addEventListener("pointerdown", handleMobileSwitch);
      }

      /*
      The old right-side mobile shooting buttons were disabled for this pass:
      elements.mobileControls.addEventListener("pointerdown", handlePointerDown);
      elements.mobileControls.addEventListener("pointerup", handlePointerUp);
      */
    }

    // Auto-expands on mobile or low-resolution layouts.
    function updateLayoutMode() {
      const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 860;
      runtime.mobileMode = mobile;
      document.body.classList.toggle("mobile-isolated", mobile);
      if (elements.mobileControls) elements.mobileControls.classList.toggle("hidden", !mobile);
      if (mobile) deps.menu.toggleExpanded(true);
      if (!mobile) clearMovement();
      if (deps.objectScale && deps.objectScale.update) deps.objectScale.update();
    }

    // Starts joystick movement from a touch/pointer gesture.
    function startJoystick(event) {
      event.preventDefault();
      joystickPointer = event.pointerId;
      if (elements.mobileMoveJoystick.setPointerCapture) {
        elements.mobileMoveJoystick.setPointerCapture(event.pointerId);
      }
      applyJoystick(event);
    }

    // Updates joystick direction while held.
    function moveJoystick(event) {
      if (joystickPointer !== event.pointerId) return;
      event.preventDefault();
      applyJoystick(event);
    }

    // Releases joystick movement.
    function stopJoystick(event) {
      if (joystickPointer !== null && event.pointerId !== joystickPointer) return;
      event.preventDefault();
      joystickPointer = null;
      if (elements.mobileMoveJoystick && elements.mobileMoveJoystick.releasePointerCapture) {
        try {
          elements.mobileMoveJoystick.releasePointerCapture(event.pointerId);
        } catch (error) {
          joystickPointer = null;
        }
      }
      clearMovement();
      setThumb(0, 0);
    }

    // Converts joystick pointer position into movement actions.
    function applyJoystick(event) {
      if (!elements.mobileMoveJoystick) return;
      const rect = elements.mobileMoveJoystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const length = Math.hypot(dx, dy) || 1;
      const limited = Math.min(radius * 0.62, length);
      const nx = dx / length;
      const ny = dy / length;
      setThumb(nx * limited, ny * limited);
      setMovement({
        moveRight: nx > 0.32,
        moveLeft: nx < -0.32,
        moveDown: ny > 0.32,
        moveUp: ny < -0.32
      });
    }

    // Applies current joystick movement flags.
    function setMovement(flags) {
      for (const action of moveActions) {
        if (flags[action]) deps.keysDown.add(action);
        else deps.keysDown.delete(action);
      }
      deps.updateHud();
    }

    // Clears all mobile movement flags.
    function clearMovement() {
      for (const action of moveActions) deps.keysDown.delete(action);
      deps.updateHud();
    }

    // Moves the joystick thumb inside the control ring.
    function setThumb(x, y) {
      if (!elements.mobileJoystickThumb) return;
      elements.mobileJoystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    // Blocks mobile browser gestures inside game controls where browsers permit it.
    function preventDefault(event) {
      event.preventDefault();
    }

    // Runs the E interaction from touch/pointer input without waiting for a synthetic click.
    function handleMobileInteract(event) {
      event.preventDefault();
      deps.interaction.interactNearest();
    }

    // Cycles the selected operator from touch/pointer input.
    function handleMobileSwitch(event) {
      event.preventDefault();
      deps.cycleOperator();
    }

    // Prevents accidental long-press and page gestures during mobile play.
    function isolateMobileEvent(event) {
      if (!runtime.mobileMode) return;
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tag === "select" || tag === "input" || tag === "textarea") return;
      if (event.target && event.target.closest && event.target.closest(".settings-overlay")) return;
      event.preventDefault();
    }

    return {
      bindEvents,
      updateLayoutMode
    };
  }

  window.MobileControlSystem = { create };
}());
