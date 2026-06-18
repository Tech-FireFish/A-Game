"use strict";

(function () {
  // Builds settings overlay controls and shared overlay pause behavior.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;
    const DEV_CODE = "Let me in";
    const SETTINGS_TABS = new Set(["keys", "general", "sound", "dev"]);
    const DEV_SETTINGS_TABS = new Set(["mission", "operator", "enemy"]);

    // Opens settings, pauses execution, and remembers whether to resume.
    function openSettings() {
      if (runtime.settingsOpen || runtime.digitalLockOpen || runtime.inventoryOpen || runtime.equipmentTableOpen || runtime.laptopOpen || runtime.settingChangeOpen) return;
      runtime.settingsResumeRunning = Boolean(runtime.state && runtime.state.running);
      if (runtime.state) runtime.state.running = false;
      deps.keysDown.clear();
      runtime.settingsOpen = true;
      if (elements.devSettingsOverlay) elements.devSettingsOverlay.classList.remove("dev-standalone");
      elements.settingsOverlay.classList.remove("hidden");
      if (!runtime.devSettingsUnlocked && elements.devModeCodeInput) elements.devModeCodeInput.value = "";
      if (!runtime.devSettingsUnlocked && elements.devModeMessage) elements.devModeMessage.textContent = "";
      setActiveTab(SETTINGS_TABS.has(runtime.activeSettingsTab) ? runtime.activeSettingsTab : "keys");
      if (runtime.devSettingsUnlocked) showDevSettingsVisual();
      deps.renderEnemyLoadouts();
      deps.updateHud();
    }

    // Closes settings and restores execution when it was previously running.
    function closeSettings() {
      if (!runtime.settingsOpen) return;
      cancelPendingSettingChange();
      runtime.settingsOpen = false;
      elements.settingsOverlay.classList.add("hidden");
      hideDevSettingsVisual();
      elements.settingsOverlay.classList.remove("dev-settings-open");
      if (runtime.state && !runtime.state.gameOver && runtime.settingsResumeRunning) {
        runtime.state.running = true;
      }
      runtime.settingsResumeRunning = false;
      deps.updateHud();
    }

    // Closes both Settings pages when leaving the workflow for the menu.
    function closeAllSettingsToMenu() {
      cancelPendingSettingChange();
      closeDevSettings({ keepSettingsOpen: true });
      if (runtime.settingsOpen) {
        runtime.settingsOpen = false;
        if (elements.settingsOverlay) elements.settingsOverlay.classList.add("hidden");
      }
      if (elements.settingsOverlay) elements.settingsOverlay.classList.remove("dev-settings-open");
      runtime.settingsResumeRunning = false;
      deps.updateHud();
    }

    // Switches the settings overlay between open and closed.
    function toggleSettings() {
      if (runtime.settingsOpen) {
        closeSettings();
      } else {
        openSettings();
      }
    }

    // Reports whether any modal overlay should freeze gameplay updates.
    function gameplayPausedByOverlay() {
      return runtime.settingsOpen || runtime.devSettingsOpen || runtime.digitalLockOpen || runtime.inventoryOpen || runtime.equipmentTableOpen || runtime.laptopOpen || runtime.pauseOpen || runtime.settingChangeOpen;
    }

    // Overrides the stored resume state for setup changes.
    function setResumeRunning(value) {
      runtime.settingsResumeRunning = value;
    }

    // Reports whether the settings overlay is currently open.
    function isOpen() {
      return runtime.settingsOpen;
    }

    // Shows one settings section and hides the other tab panels.
    function setActiveTab(tabId) {
      runtime.activeSettingsTab = SETTINGS_TABS.has(tabId) ? tabId : "keys";
      for (const tab of elements.settingsTabs || []) {
        tab.classList.toggle("active", tab.dataset.settingsTab === runtime.activeSettingsTab);
      }
      for (const panel of elements.settingsPanels || []) {
        panel.classList.toggle("hidden", panel.dataset.settingsPanel !== runtime.activeSettingsTab);
      }
    }

    // Shows one Dev Setting section and hides the other advanced panels.
    function setActiveDevTab(tabId) {
      runtime.activeDevSettingsTab = DEV_SETTINGS_TABS.has(tabId) ? tabId : "mission";
      for (const tab of elements.devSettingsTabs || []) {
        tab.classList.toggle("active", tab.dataset.devSettingsTab === runtime.activeDevSettingsTab);
      }
      for (const panel of elements.devSettingsPanels || []) {
        panel.classList.toggle("hidden", panel.dataset.devSettingsPanel !== runtime.activeDevSettingsTab);
      }
    }

    // Checks the Dev Mode phrase and opens the independent Dev Setting page.
    function confirmDevMode() {
      const value = elements.devModeCodeInput ? elements.devModeCodeInput.value : "";
      if (value !== DEV_CODE) {
        if (elements.devModeMessage) elements.devModeMessage.textContent = "Wrong code.";
        return false;
      }
      if (document.body.classList.contains("start-menu-active") || document.documentElement.classList.contains("start-menu-active")) {
        if (elements.devModeMessage) elements.devModeMessage.textContent = "Dev Setting is unavailable in Start menu.";
        return false;
      }
      openDevSettings();
      return true;
    }

    // Opens the separate Dev Setting page beside the normal Settings page.
    function openDevSettings() {
      if (!runtime.settingsOpen) openSettings();
      runtime.devSettingsUnlocked = true;
      setActiveDevTab("mission");
      if (elements.devModeMessage) elements.devModeMessage.textContent = "Dev Setting opened.";
      showDevSettingsVisual();
      deps.renderEnemyLoadouts();
      deps.updateHud();
    }

    // Shows Dev Setting visually without changing its unlock state.
    function showDevSettingsVisual() {
      runtime.devSettingsOpen = true;
      if (elements.devSettingsOverlay) elements.devSettingsOverlay.classList.remove("hidden");
      if (elements.devSettingsOverlay) elements.devSettingsOverlay.classList.remove("dev-standalone");
      if (elements.settingsOverlay && runtime.settingsOpen) elements.settingsOverlay.classList.add("dev-settings-open");
    }

    // Hides Dev Setting visually while preserving its unlock state.
    function hideDevSettingsVisual() {
      runtime.devSettingsOpen = false;
      if (elements.devSettingsOverlay) elements.devSettingsOverlay.classList.add("hidden");
      if (elements.devSettingsOverlay) elements.devSettingsOverlay.classList.remove("dev-standalone");
    }

    // Closes and locks Dev Setting.
    function closeDevSettings(options = {}) {
      runtime.devSettingsUnlocked = false;
      runtime.activeDevSettingsTab = "mission";
      hideDevSettingsVisual();
      if (elements.settingsOverlay) elements.settingsOverlay.classList.remove("dev-settings-open");
      if (elements.devModeCodeInput) elements.devModeCodeInput.value = "";
      if (elements.devModeMessage) elements.devModeMessage.textContent = "";
      if (!options.keepSettingsOpen) deps.updateHud();
    }

    // Applies a setup change immediately or asks for restart confirmation after units move.
    function requestSettingChange(applyChange, options = {}) {
      applyChange();
      if (options.restartWhenClean && deps.level && deps.level.restart) deps.level.restart();
      deps.updateHud();
      return true;
      /*
      Restart-warning flow disabled: settings now apply directly after the game has started.
      if (runtime.activeMode === "tutorial") {
        applyChange();
        deps.updateHud();
        return true;
      }
      if (!unitsMovedFromOrigin()) {
        applyChange();
        if (options.restartWhenClean && deps.level && deps.level.restart) deps.level.restart();
        deps.updateHud();
        return true;
      }
      runtime.settingChangeOpen = true;
      runtime.pendingSettingChange = {
        applyChange,
        restartAfter: options.restartAfter !== false
      };
      if (elements.settingsChangeOverlay) elements.settingsChangeOverlay.classList.remove("hidden");
      deps.keysDown.clear();
      return false;
      */
    }

    // Confirms the pending settings change and restarts the current mission when required.
    function confirmPendingSettingChange() {
      const pending = runtime.pendingSettingChange;
      hideSettingChangeOverlay();
      if (!pending || typeof pending.applyChange !== "function") {
        deps.updateHud();
        return;
      }
      pending.applyChange();
      if (pending.restartAfter && deps.level && deps.level.restart) deps.level.restart();
      deps.updateHud();
    }

    // Cancels the pending settings change and restores visible controls.
    function cancelPendingSettingChange() {
      hideSettingChangeOverlay();
      restoreSetupControls();
      if (deps.renderEnemyLoadouts) deps.renderEnemyLoadouts();
      deps.updateHud();
    }

    // Hides the settings-change warning overlay.
    function hideSettingChangeOverlay() {
      runtime.settingChangeOpen = false;
      runtime.pendingSettingChange = null;
      if (elements.settingsChangeOverlay) elements.settingsChangeOverlay.classList.add("hidden");
    }

    // Detects whether any operator or enemy has left its authored spawn position.
    function unitsMovedFromOrigin() {
      const state = runtime.state;
      if (!state || state.gameOver) return false;
      return [...state.level.operators, ...state.level.enemies].some((unit) => {
        const spawn = unit.spawn;
        if (!spawn) return false;
        return Math.hypot(unit.x - spawn.x, unit.y - spawn.y) > 1;
      });
    }

    // Restores selector values after a rejected settings change.
    function restoreSetupControls() {
      const meta = runtime.currentLevelMeta;
      if (elements.levelSelect) elements.levelSelect.value = runtime.activeMode === "level" && meta ? meta.id : "";
      if (elements.tutorialSelect) elements.tutorialSelect.value = runtime.activeMode === "tutorial" && meta ? meta.id : "";
      if (elements.tempLevelSelect) elements.tempLevelSelect.value = runtime.activeMode === "temp" && meta ? meta.id : "";
      if (elements.operatorCountSelect) elements.operatorCountSelect.value = String(runtime.activeOperatorCount || 2);
      if (elements.difficultySelect) elements.difficultySelect.value = runtime.currentDifficulty || "normal";
      if (elements.shootingModeSelect && runtime.state) elements.shootingModeSelect.value = runtime.state.shootingMode || "automatic";
      if (elements.enemyTraceSelect) elements.enemyTraceSelect.value = runtime.enemyTraceMode || "current";
      if (elements.hintOpacityRange) elements.hintOpacityRange.value = String(runtime.hintOpacity || 0.42);
      if (elements.viewRange) elements.viewRange.value = String(runtime.viewValue || 50);
      if (elements.backgroundMusicRange) elements.backgroundMusicRange.value = String(runtime.backgroundMusicVolume ?? 50);
      // if (elements.pixelArtStyleSelect) elements.pixelArtStyleSelect.value = runtime.pixelArtStyle || "geometry";
      // if (elements.pngRenderingCheckbox) elements.pngRenderingCheckbox.checked = runtime.usePngRendering !== false;
      // if (elements.startPngRenderingCheckbox) elements.startPngRenderingCheckbox.checked = runtime.usePngRendering !== false;
    }

    // Restores controls, setup options, and saved loadout selections to defaults.
    function resetDefaults() {
      deps.keysDown.clear();
      runtime.capturingKeyAction = null;
      runtime.currentDifficulty = "normal";
      runtime.enemyTraceMode = "current";
      runtime.activeOperatorCount = 2;
      runtime.showAllHealth = false;
      runtime.hintOpacity = 0.42;
      runtime.viewValue = 50;
      runtime.backgroundMusicVolume = 50;
      runtime.pixelArtStyle = "geometry";
      if (runtime.state) {
        runtime.state.shootingMode = "automatic";
        runtime.state.message = "Settings reset to defaults";
      }
      if (deps.keybindings && deps.keybindings.reset) deps.keybindings.reset();
      clearMap(deps.operatorLoadouts);
      clearMap(deps.operatorArmorLoadouts);
      clearMap(deps.operatorBackpackLoadouts);
      clearMap(deps.enemyLoadouts);
      clearMap(deps.enemyArmorLoadouts);
      if (elements.operatorCountSelect) elements.operatorCountSelect.value = "2";
      if (elements.difficultySelect) elements.difficultySelect.value = "normal";
      if (elements.shootingModeSelect) elements.shootingModeSelect.value = "automatic";
      if (elements.enemyTraceSelect) elements.enemyTraceSelect.value = "current";
      if (elements.hintOpacityRange) elements.hintOpacityRange.value = "0.42";
      if (elements.viewRange) elements.viewRange.value = "50";
      if (elements.backgroundMusicRange) elements.backgroundMusicRange.value = "50";
      if (deps.setBackgroundMusicVolume) deps.setBackgroundMusicVolume(50);
      // if (elements.pixelArtStyleSelect) elements.pixelArtStyleSelect.value = "geometry";
      // if (elements.pngRenderingCheckbox) elements.pngRenderingCheckbox.checked = true;
      // if (elements.startPngRenderingCheckbox) elements.startPngRenderingCheckbox.checked = true;
      if (deps.camera && deps.camera.setViewValue) deps.camera.setViewValue(50);
      if (runtime.activeMode !== "tutorial" && deps.level && deps.level.restart) deps.level.restart();
      deps.renderEnemyLoadouts();
      deps.updateHud();
    }

    // Removes all own properties from a plain loadout map.
    function clearMap(map) {
      if (!map) return;
      for (const key of Object.keys(map)) delete map[key];
    }

    return {
      openSettings,
      closeSettings,
      closeAllSettingsToMenu,
      toggleSettings,
      gameplayPausedByOverlay,
      setResumeRunning,
      setActiveTab,
      setActiveDevTab,
      confirmDevMode,
      openDevSettings,
      closeDevSettings,
      resetDefaults,
      requestSettingChange,
      confirmPendingSettingChange,
      cancelPendingSettingChange,
      isOpen
    };
  }

  window.SettingsSystem = { create };
}());
