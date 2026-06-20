"use strict";

(function () {
  // Builds mouse, keyboard, and UI event bindings.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;

    // Handles selecting operators, clicking doors, and adding waypoints.
    function onCanvasClick(event) {
      deps.audio.unlock();
      const state = runtime.state;
      if (!state) return;
      if (state.gameOver) return;
      const pos = deps.geometry.getMouseWorld(event);
      if (state.shootingMode === "manual") {
        const clickedOp = state.level.operators.find((op) => !op.down && deps.geometry.pointDistance(op, pos) <= deps.geometry.scaledRadius(op) + 8);
        if (clickedOp) {
          state.selectedId = clickedOp.id;
          deps.updateHud();
        }
        return;
      }
      const clickedDoor = deps.geometry.doorAtPoint(pos);
      if (clickedDoor && deps.interaction.interactDoor(deps.selectedOperator(), clickedDoor)) return;

      const clickedOp = state.level.operators.find((op) => !op.down && deps.geometry.pointDistance(op, pos) <= deps.geometry.scaledRadius(op) + 8);
      if (clickedOp) {
        state.selectedId = clickedOp.id;
        deps.updateHud();
        return;
      }

      const op = deps.selectedOperator();
      if (!op || op.down) return;
      op.path.push({ x: pos.x, y: pos.y });
      if (op.path.length === 1) {
        op.aim = deps.geometry.angleTo(op, op.path[0]);
      }
      deps.updateHud();
    }

    // Starts held manual fire while the left mouse button remains down.
    function onCanvasMouseDown(event) {
      deps.audio.unlock();
      const state = runtime.state;
      if (!state || state.gameOver || state.shootingMode !== "manual" || event.button !== 0) return;
      const pos = deps.geometry.getMouseWorld(event);
      const clickedOp = state.level.operators.find((op) => !op.down && deps.geometry.pointDistance(op, pos) <= deps.geometry.scaledRadius(op) + 8);
      if (clickedOp) {
        state.selectedId = clickedOp.id;
        runtime.manualFireHeld = false;
        runtime.manualFirePoint = null;
        deps.updateHud();
        return;
      }
      event.preventDefault();
      runtime.manualFireHeld = true;
      runtime.manualFirePoint = pos;
      deps.shooting.manualFire(deps.selectedOperator(), pos);
    }

    // Aims the selected operator toward the cursor in manual shooting mode.
    function onCanvasMove(event) {
      const state = runtime.state;
      if (!state || state.shootingMode !== "manual") return;
      const op = deps.selectedOperator();
      if (!op || op.down) return;
      const pos = deps.geometry.getMouseWorld(event);
      runtime.manualFirePoint = pos;
      op.aim = deps.geometry.angleTo(op, pos);
    }

    // Stops held manual fire when the mouse is released or leaves the canvas.
    function stopManualFire() {
      runtime.manualFireHeld = false;
      runtime.manualFirePoint = null;
    }

    // Clears the selected operator route on right-click.
    function onCanvasContext(event) {
      event.preventDefault();
      const state = runtime.state;
      if (!state) return;
      if (state.gameOver) return;
      const op = deps.selectedOperator();
      if (!op) return;
      op.path = [];
      op.action = null;
      state.message = `${op.id} route cleared`;
      deps.updateHud();
    }

    // Handles keyboard controls for overlays, movement, run state, doors, and debug.
    function handleKey(event) {
      deps.audio.unlock();
      guardBrowserShortcut(event);
      if (runtime.capturingKeyAction) {
        event.preventDefault();
        deps.keybindings.capture(runtime.capturingKeyAction, event);
        runtime.capturingKeyAction = null;
        return;
      }
      if (deps.digitalLock.isOpen()) {
        handleDigitalLockKey(event);
        return;
      }
      if (deps.laptopIsOpen()) {
        if (deps.keybindings.matches(event, "settings")) {
          event.preventDefault();
          deps.cameraHack.closeLaptop();
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (deps.keybindings.matches(event, "settings")) {
        event.preventDefault();
        if (runtime.storeConfirmItemId && deps.closeStoreConfirmation) {
          deps.closeStoreConfirmation({ clearSelection: true });
        } else if (elements.onboardingQuestion && !elements.onboardingQuestion.classList.contains("hidden")) {
          if (deps.menu.closeOnboarding) deps.menu.closeOnboarding();
          else elements.onboardingQuestion.classList.add("hidden");
        } else if (deps.settings.isOpen()) deps.settings.closeSettings();
        else if (deps.inventoryIsOpen()) deps.inventory.closeInventory();
        else if (deps.equipmentTableIsOpen()) deps.inventory.closeEquipmentTable();
        else if (deps.laptopIsOpen()) deps.cameraHack.closeLaptop();
        else if (deps.menu.isStoreOpen && deps.menu.isStoreOpen()) {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          deps.menu.closeStore();
        }
        else if (deps.menu.isMainOpen && deps.menu.isMainOpen()) deps.menu.closeMainOverlay();
        else deps.menu.togglePause();
        return;
      }
      const state = runtime.state;
      if (!state) return;
      if (deps.keybindings.matches(event, "inventory")) {
        event.preventDefault();
        if (deps.inventoryIsOpen()) deps.inventory.closeInventory();
        else deps.inventory.openInventory();
        return;
      }
      if (deps.settings.gameplayPausedByOverlay()) return;
      const holdAction = holdActionForEvent(event);
      if (holdAction) {
        event.preventDefault();
        deps.keysDown.add(holdAction);
        deps.updateHud();
      } else if (deps.keybindings.matches(event, "pause")) {
        event.preventDefault();
        deps.toggleRun();
      } else if (deps.keybindings.matches(event, "restart")) {
        event.preventDefault();
        deps.level.restart();
      } else if (deps.keybindings.matches(event, "reload")) {
        event.preventDefault();
        deps.shooting.activeReload(deps.selectedOperator());
      } else if (deps.keybindings.matches(event, "switchOperator")) {
        event.preventDefault();
        deps.cycleOperator();
      } else if (deps.keybindings.matches(event, "interact")) {
        event.preventDefault();
        deps.interaction.interactNearest();
      } else if (deps.keybindings.matches(event, "debug")) {
        event.preventDefault();
        state.debug = !state.debug;
        elements.debugButton.classList.toggle("active", state.debug);
      }
    }

    // Releases manual movement keys when gameplay is not overlay-paused.
    function handleKeyUp(event) {
      guardBrowserShortcut(event);
      const key = event.key.toLowerCase();
      if (deps.settings.gameplayPausedByOverlay()) return;
      const holdAction = holdActionForEvent(event);
      if (holdAction) {
        event.preventDefault();
        deps.keysDown.delete(holdAction);
        deps.updateHud();
      }
    }

    // Maps a key event to a hold action such as movement or speed modifier.
    function holdActionForEvent(event) {
      const actions = ["moveUp", "moveDown", "moveLeft", "moveRight", "sneak", "sprint"];
      return actions.find((action) => deps.keybindings.matches(event, action)) || null;
    }

    // Prevents common browser shortcuts from interrupting play once the game page is active.
    function guardBrowserShortcut(event) {
      const code = event.code || "";
      const ctrlLike = event.ctrlKey || event.metaKey;
      const isolateAllCtrlLike = ctrlLike && (runtime.expandedGame || runtime.mobileMode);
      if (
        deps.keybindings.matches(event, "inventory")
        || deps.keybindings.matches(event, "reload")
        || isolateAllCtrlLike
        || (ctrlLike && ["KeyW", "KeyR", "KeyS", "KeyP"].includes(code))
        || event.altKey
        || code === "F5"
      ) {
        event.preventDefault();
      }
    }

    // Allows typed digits and submit/delete shortcuts inside the lock overlay.
    function handleDigitalLockKey(event) {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        deps.digitalLock.appendDigit(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deps.digitalLock.deleteDigit();
      } else if (event.key === "Enter") {
        event.preventDefault();
        deps.digitalLock.submitDigitalLock();
      } else if (deps.keybindings.matches(event, "settings")) {
        event.preventDefault();
        deps.digitalLock.closeDigitalLock();
      }
    }

    // Plays the shared guidance tone for real button clicks across the UI.
    function onDocumentButtonClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      const button = target.closest("button");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      if (button.closest("#digitalLockKeypad")) return;
      deps.audio.unlock();
      deps.audio.play("button-guidance");
    }

    // Connects DOM events to the game systems once during boot.
    function bindEvents() {
      document.addEventListener("click", onDocumentButtonClick);
      elements.canvas.addEventListener("click", onCanvasClick);
      elements.canvas.addEventListener("mousedown", onCanvasMouseDown);
      elements.canvas.addEventListener("mousemove", onCanvasMove);
      elements.canvas.addEventListener("mouseup", stopManualFire);
      elements.canvas.addEventListener("mouseleave", stopManualFire);
      elements.canvas.addEventListener("contextmenu", onCanvasContext);
      window.addEventListener("mouseup", stopManualFire);
      elements.operatorHealthBoard.addEventListener("click", (event) => {
        const card = event.target.closest("[data-operator-id]");
        if (!card) return;
        deps.selectOperator(card.dataset.operatorId);
      });
      elements.weaponSelect.addEventListener("change", () => {
        const op = deps.selectedOperator();
        if (!op) return;
        const opId = op.id;
        const value = elements.weaponSelect.value;
        deps.settings.requestSettingChange(() => {
          const target = runtime.state.level.operators.find((unit) => unit.id === opId);
          if (target) deps.equipment.applyOperatorWeapon(target, value);
        });
      });
      elements.armorSelect.addEventListener("change", () => {
        const op = deps.selectedOperator();
        if (!op) return;
        const opId = op.id;
        const value = elements.armorSelect.value;
        deps.settings.requestSettingChange(() => {
          const target = runtime.state.level.operators.find((unit) => unit.id === opId);
          if (target) deps.equipment.applyOperatorArmor(target, value);
        });
      });
      elements.backpackSelect.addEventListener("change", () => {
        const op = deps.selectedOperator();
        if (!op) return;
        const opId = op.id;
        const value = elements.backpackSelect.value;
        deps.settings.requestSettingChange(() => {
          const target = runtime.state.level.operators.find((unit) => unit.id === opId);
          if (target) deps.equipment.applyOperatorBackpack(target, value);
        });
      });
      window.addEventListener("keydown", handleKey);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("blur", () => {
        deps.keysDown.clear();
        stopManualFire();
        deps.updateHud();
      });
      elements.runButton.addEventListener("click", deps.toggleRun);
      elements.restartButton.addEventListener("click", deps.level.restart);
      elements.bannerRestartButton.addEventListener("click", deps.level.restart);
      elements.nextLevelButton.addEventListener("click", () => {
        if (runtime.activeMode === "tutorial" && runtime.state && runtime.state.result === "success") {
          deps.level.loadNextTutorial();
        } else if (runtime.activeMode === "temp") {
          deps.level.loadFirstLevel();
        } else if (deps.advanceToNextStoryOrEnd) {
          deps.advanceToNextStoryOrEnd();
        } else {
          deps.level.loadNextLevel();
        }
      });
      if (elements.exitTutorialButton) {
        elements.exitTutorialButton.addEventListener("click", deps.level.loadFirstLevel);
      }
      elements.settingsButton.addEventListener("click", deps.settings.openSettings);
      if (elements.playMenuButton) {
        elements.playMenuButton.addEventListener("click", async () => {
          if (deps.hasResumePoint && deps.hasResumePoint()) {
            await deps.resumeFromStartMenu();
            return;
          }
          if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
          if (deps.menu.showStore) deps.menu.showStore();
          else elements.onboardingQuestion.classList.remove("hidden");
        });
      }
      if (elements.startSettingButton) {
        elements.startSettingButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
          if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
          deps.settings.openSettings();
        });
      }
      if (elements.startInfoButton) {
        elements.startInfoButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
          if (elements.startInfoPanel) elements.startInfoPanel.classList.remove("hidden");
        });
      }
      if (elements.startCreditsButton) {
        elements.startCreditsButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
          if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
          if (deps.openCreditsPage) deps.openCreditsPage({ skipIntro: true });
        });
      }
      if (elements.closeStartInfoButton) {
        elements.closeStartInfoButton.addEventListener("click", () => elements.startInfoPanel.classList.add("hidden"));
      }
      if (elements.closeOnboardingButton) {
        elements.closeOnboardingButton.addEventListener("click", () => {
          if (deps.menu.closeOnboarding) deps.menu.closeOnboarding();
          else elements.onboardingQuestion.classList.add("hidden");
        });
      }
      if (elements.startExitButton) {
        elements.startExitButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
          if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
          deps.exitFromStartMenu();
        });
      }
      if (elements.storeExitButton) {
        elements.storeExitButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
          if (deps.clearStoreMissionReturn) deps.clearStoreMissionReturn();
          if (deps.menu.closeStore) deps.menu.closeStore();
        });
      }
      if (elements.storePlayButton) {
        elements.storePlayButton.addEventListener("click", async () => {
          if (deps.handleStorePlayButton) {
            await deps.handleStorePlayButton();
            return;
          }
          if (deps.menu.openOnboarding) deps.menu.openOnboarding({ returnToStore: true });
          else if (elements.onboardingQuestion) elements.onboardingQuestion.classList.remove("hidden");
        });
      }
      if (elements.storeEquipmentGrid) {
        elements.storeEquipmentGrid.addEventListener("click", (event) => {
          const card = event.target.closest("[data-store-item-id]");
          if (!card) return;
          deps.audio.unlock();
          if (deps.selectStoreItem) deps.selectStoreItem(card.dataset.storeItemId);
        });
      }
      if (elements.storeCancelPurchaseButton) {
        elements.storeCancelPurchaseButton.addEventListener("click", () => {
          if (deps.closeStoreConfirmation) deps.closeStoreConfirmation({ clearSelection: true });
        });
      }
      if (elements.storeConfirmPurchaseButton) {
        elements.storeConfirmPurchaseButton.addEventListener("click", () => {
          deps.audio.unlock();
          if (deps.confirmStorePurchase) deps.confirmStorePurchase();
        });
      }
      if (elements.playedNoButton) {
        elements.playedNoButton.addEventListener("click", async () => {
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          deps.menu.closePause();
          await deps.ensureGameDataReady();
          await deps.level.loadLevel("tutorial-basics-movement");
          deps.menu.enterGame();
        });
      }
      if (elements.playedYesButton) {
        elements.playedYesButton.addEventListener("click", async () => {
          if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
          deps.menu.closePause();
          await deps.ensureGameDataReady();
          deps.menu.showMain();
        });
      }
      if (elements.mainMenuCloseButton) {
        elements.mainMenuCloseButton.addEventListener("click", async () => {
          await deps.ensureGameDataReady();
          if (!runtime.state) await deps.level.loadFirstLevel();
          deps.menu.closePause();
          deps.menu.enterGame();
        });
      }
      if (elements.mainMenuBackButton) {
        elements.mainMenuBackButton.addEventListener("click", () => {
          deps.menu.showStore();
        });
      }
      if (elements.pauseResumeButton) elements.pauseResumeButton.addEventListener("click", deps.menu.closePause);
      if (elements.pauseRestartButton) {
        elements.pauseRestartButton.addEventListener("click", () => {
          deps.menu.closePause();
          deps.level.restart();
        });
      }
      if (elements.pauseLevelButton) elements.pauseLevelButton.addEventListener("click", deps.menu.showLevelMenu);
      if (elements.pauseTutorialButton) elements.pauseTutorialButton.addEventListener("click", deps.menu.showTutorialMenu);
      if (elements.pauseSettingButton) elements.pauseSettingButton.addEventListener("click", deps.menu.openSettingsFromPause);
      if (elements.expandGameButton) elements.expandGameButton.addEventListener("click", () => deps.menu.toggleExpanded());
      if (elements.expandedPauseButton) elements.expandedPauseButton.addEventListener("click", deps.menu.togglePause);
      if (elements.exitToMenuButton) elements.exitToMenuButton.addEventListener("click", deps.menu.showStart);
      if (elements.backToStoreButton) {
        elements.backToStoreButton.addEventListener("click", () => {
          if (deps.goToStoreFromMissionResult) deps.goToStoreFromMissionResult();
          else deps.menu.showStore();
        });
      }
      if (elements.endReturnMenuButton) {
        elements.endReturnMenuButton.addEventListener("click", () => {
          if (deps.returnToStartFromEnd) deps.returnToStartFromEnd();
          else deps.menu.showStart();
        });
      }
      if (elements.resultLevelSelect) {
        elements.resultLevelSelect.addEventListener("change", () => loadWithTutorialWarning(elements.resultLevelSelect.value));
      }
      if (elements.menuDifficultySelect) {
        elements.menuDifficultySelect.addEventListener("change", () => deps.setDifficulty(elements.menuDifficultySelect.value));
      }
      if (elements.menuShootingModeSelect) {
        elements.menuShootingModeSelect.addEventListener("change", () => {
          if (!runtime.state) return;
          runtime.state.shootingMode = elements.menuShootingModeSelect.value === "manual" ? "manual" : "automatic";
          deps.updateHud();
        });
      }
      // if (elements.startPngRenderingCheckbox) {
      //   elements.startPngRenderingCheckbox.addEventListener("change", () => {
      //     runtime.usePngRendering = elements.startPngRenderingCheckbox.checked;
      //     if (runtime.state) {
      //       runtime.state.message = runtime.usePngRendering ? "PNG art enabled" : "PNG art disabled";
      //     }
      //     deps.updateHud();
      //   });
      // }
      if (elements.menuLevelBlocks) {
        elements.menuLevelBlocks.addEventListener("click", async (event) => {
          const button = event.target.closest("[data-menu-level]");
          if (!button || button.disabled) return;
          await deps.ensureGameDataReady();
          await deps.level.loadLevel(button.dataset.menuLevel);
          deps.menu.enterGame();
        });
      }
      if (elements.menuTutorialBlocks) {
        elements.menuTutorialBlocks.addEventListener("click", async (event) => {
          const button = event.target.closest("[data-menu-tutorial]");
          if (!button) return;
          await deps.ensureGameDataReady();
          await deps.level.loadLevel(button.dataset.menuTutorial);
          deps.menu.enterGame();
        });
      }
      /*
      if (elements.expandedNav) {
        elements.expandedNav.addEventListener("click", (event) => {
          const button = event.target.closest("[data-expanded-action]");
          if (!button) return;
          const action = button.dataset.expandedAction;
          if (action === "inventory") deps.inventory.openInventory();
          else if (action === "settings" || action === "loadout") deps.settings.openSettings();
          else deps.menu.openPause();
        });
      }
      */
      elements.closeSettingsButton.addEventListener("click", deps.settings.closeSettings);
      if (elements.closeDevSettingsButton) {
        elements.closeDevSettingsButton.addEventListener("click", () => deps.settings.closeDevSettings());
      }
      if (elements.resetSettingsButton) {
        elements.resetSettingsButton.addEventListener("click", deps.settings.resetDefaults);
      }
      if (elements.confirmDevModeButton) {
        elements.confirmDevModeButton.addEventListener("click", deps.settings.confirmDevMode);
      }
      if (elements.devModeCodeInput) {
        elements.devModeCodeInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          deps.settings.confirmDevMode();
        });
      }
      if (elements.settingsExitToMenuButton) {
        elements.settingsExitToMenuButton.addEventListener("click", () => {
          deps.settings.closeAllSettingsToMenu();
          deps.menu.showStart();
        });
      }
      if (elements.devSettingsExitToMenuButton) {
        elements.devSettingsExitToMenuButton.addEventListener("click", () => {
          deps.settings.closeAllSettingsToMenu();
          deps.menu.showStart();
        });
      }
      if (elements.confirmSettingsChangeButton) {
        elements.confirmSettingsChangeButton.addEventListener("click", deps.settings.confirmPendingSettingChange);
      }
      if (elements.cancelSettingsChangeButton) {
        elements.cancelSettingsChangeButton.addEventListener("click", deps.settings.cancelPendingSettingChange);
      }
      elements.inventoryButton.addEventListener("click", deps.inventory.openInventory);
      elements.closeInventoryButton.addEventListener("click", deps.inventory.closeInventory);
      elements.inventoryOverlay.addEventListener("click", (event) => {
        if (event.target === elements.inventoryOverlay) deps.inventory.closeInventory();
      });
      elements.closeEquipmentTableButton.addEventListener("click", deps.inventory.closeEquipmentTable);
      elements.equipmentTableOverlay.addEventListener("click", (event) => {
        if (event.target === elements.equipmentTableOverlay) deps.inventory.closeEquipmentTable();
      });
      elements.equipmentTableOptions.addEventListener("click", (event) => {
        const button = event.target.closest("[data-table-equip]");
        if (!button) return;
        deps.inventory.equipFromTable(button.dataset.tableEquip, button.dataset.equipId);
      });
      elements.showAllHealthButton.addEventListener("click", () => {
        runtime.showAllHealth = !runtime.showAllHealth;
        deps.updateHud();
      });
      elements.settingsOverlay.addEventListener("click", (event) => {
        if (event.target === elements.settingsOverlay) deps.settings.closeSettings();
      });
      for (const tab of elements.settingsTabs || []) {
        tab.addEventListener("click", () => deps.settings.setActiveTab(tab.dataset.settingsTab));
      }
      for (const tab of elements.devSettingsTabs || []) {
        tab.addEventListener("click", () => deps.settings.setActiveDevTab(tab.dataset.devSettingsTab));
      }
      elements.debugButton.addEventListener("click", () => {
        const state = runtime.state;
        if (!state) return;
        if (deps.settings.gameplayPausedByOverlay()) return;
        state.debug = !state.debug;
        elements.debugButton.classList.toggle("active", state.debug);
      });
      elements.difficultySelect.addEventListener("change", () => {
        const value = elements.difficultySelect.value;
        deps.settings.requestSettingChange(() => deps.setDifficulty(value));
      });
      elements.shootingModeSelect.addEventListener("change", () => {
        const value = elements.shootingModeSelect.value;
        deps.settings.requestSettingChange(() => {
          runtime.state.shootingMode = value === "manual" ? "manual" : "automatic";
          stopManualFire();
          runtime.state.message = runtime.state.shootingMode === "manual" ? "Manual shooting enabled" : "Automatic shooting enabled";
        });
      });
      elements.enemyTraceSelect.addEventListener("change", () => {
        const value = elements.enemyTraceSelect.value;
        deps.settings.requestSettingChange(() => {
          runtime.enemyTraceMode = value === "chase" ? "chase" : "current";
          if (runtime.state) runtime.state.message = runtime.enemyTraceMode === "chase" ? "Enemies chase last known contacts" : "Enemies use current behavior";
        });
      });
      if (elements.hintOpacityRange) {
        const applyHintOpacity = () => {
          const value = Number(elements.hintOpacityRange.value) || 0.42;
          deps.settings.requestSettingChange(() => {
            runtime.hintOpacity = value;
            if (deps.syncSettingsRangeMarkers) deps.syncSettingsRangeMarkers();
          });
        };
        elements.hintOpacityRange.addEventListener("input", applyHintOpacity);
        elements.hintOpacityRange.addEventListener("change", applyHintOpacity);
      }
      if (elements.viewRange) {
        const applyView = () => {
          const next = Number(elements.viewRange.value);
          const value = Number.isFinite(next) ? next : 50;
          deps.settings.requestSettingChange(() => {
            runtime.viewValue = value;
            if (deps.camera && deps.camera.setViewValue) deps.camera.setViewValue(runtime.viewValue);
            if (deps.syncSettingsRangeMarkers) deps.syncSettingsRangeMarkers();
          });
        };
        elements.viewRange.addEventListener("input", applyView);
        elements.viewRange.addEventListener("change", applyView);
      }
      if (elements.backgroundMusicRange) {
        const applyBackgroundMusic = () => {
          const next = Number(elements.backgroundMusicRange.value);
          const value = Number.isFinite(next) ? next : 50;
          deps.settings.requestSettingChange(() => {
            runtime.backgroundMusicVolume = value;
            if (deps.setBackgroundMusicVolume) deps.setBackgroundMusicVolume(value);
            if (deps.syncSettingsRangeMarkers) deps.syncSettingsRangeMarkers();
          });
        };
        elements.backgroundMusicRange.addEventListener("input", applyBackgroundMusic);
        elements.backgroundMusicRange.addEventListener("change", applyBackgroundMusic);
      }
      if (elements.confirmStoreScoreButton && elements.storeScoreInput) {
        elements.confirmStoreScoreButton.addEventListener("click", () => {
          if (deps.setStoreScore) deps.setStoreScore(elements.storeScoreInput.value);
        });
        elements.storeScoreInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (deps.setStoreScore) deps.setStoreScore(elements.storeScoreInput.value);
        });
      }
      // if (elements.pixelArtStyleSelect) {
      //   elements.pixelArtStyleSelect.addEventListener("change", () => {
      //     const value = elements.pixelArtStyleSelect.value;
      //     runtime.pixelArtStyle = value === "geometry" || value === "v2" ? value : "v1";
      //     if (runtime.state) {
      //       runtime.state.message = runtime.pixelArtStyle === "geometry"
      //         ? "Geometry-only style enabled"
      //         : (runtime.pixelArtStyle === "v2" ? "Pixel Art V2 enabled" : "Pixel Art V1 enabled");
      //     }
      //     deps.updateHud();
      //   });
      // }
      // if (elements.pngRenderingCheckbox) {
      //   elements.pngRenderingCheckbox.addEventListener("change", () => {
      //     runtime.usePngRendering = elements.pngRenderingCheckbox.checked;
      //     if (runtime.state) {
      //       runtime.state.message = runtime.usePngRendering ? "PNG art enabled" : "PNG art disabled";
      //     }
      //     deps.updateHud();
      //   });
      // }
      elements.keyBindingList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-keybinding-action]");
        if (!button) return;
        runtime.capturingKeyAction = button.dataset.keybindingAction;
        button.textContent = "Press key...";
      });
      elements.enemyLoadoutList.addEventListener("change", (event) => {
        const weaponSelectEl = event.target.closest("[data-enemy-weapon-id]");
        const armorSelectEl = event.target.closest("[data-enemy-armor-id]");
        if (weaponSelectEl) {
          const id = weaponSelectEl.dataset.enemyWeaponId;
          const value = weaponSelectEl.value;
          deps.settings.requestSettingChange(() => deps.equipment.applyEnemyWeapon(id, value));
        } else if (armorSelectEl) {
          const id = armorSelectEl.dataset.enemyArmorId;
          const value = armorSelectEl.value;
          deps.settings.requestSettingChange(() => deps.equipment.applyEnemyArmor(id, value));
        }
      });
      if (elements.enemyPersonalityList) {
        elements.enemyPersonalityList.addEventListener("change", (event) => {
          const personalitySelectEl = event.target.closest("[data-enemy-personality-id]");
          if (!personalitySelectEl) return;
          const id = personalitySelectEl.dataset.enemyPersonalityId;
          const value = personalitySelectEl.value;
          deps.settings.requestSettingChange(() => deps.equipment.applyEnemyPersonality(id, value));
        });
      }
      elements.unlockDigitalDoorButton.addEventListener("click", deps.digitalLock.submitDigitalLock);
      elements.cancelDigitalLockButton.addEventListener("click", () => deps.digitalLock.closeDigitalLock());
      elements.digitalLockOverlay.addEventListener("click", (event) => {
        if (event.target === elements.digitalLockOverlay) deps.digitalLock.closeDigitalLock();
      });
      elements.digitalLockKeypad.addEventListener("click", (event) => {
        const digitButton = event.target.closest("[data-lock-digit]");
        const actionButton = event.target.closest("[data-lock-action]");
        if (digitButton) {
          deps.digitalLock.appendDigit(digitButton.dataset.lockDigit);
        } else if (actionButton && actionButton.dataset.lockAction === "clear") {
          deps.digitalLock.clearCode();
        } else if (actionButton && actionButton.dataset.lockAction === "delete") {
          deps.digitalLock.deleteDigit();
        }
      });
      elements.closeLaptopButton.addEventListener("click", deps.cameraHack.closeLaptop);
      elements.laptopOverlay.addEventListener("click", (event) => {
        if (event.target === elements.laptopOverlay) deps.cameraHack.closeLaptop();
      });
      elements.startHackButton.addEventListener("click", deps.cameraHack.startHack);
      elements.cameraHackList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-camera-id]");
        if (!button) return;
        deps.cameraHack.toggleCamera(button.dataset.cameraId);
      });
      elements.levelSelect.addEventListener("change", () => {
        deps.settings.setResumeRunning(false);
        const value = elements.levelSelect.value;
        deps.settings.requestSettingChange(() => loadWithTutorialWarning(value), { restartAfter: false });
      });
      if (elements.tutorialSelect) {
        elements.tutorialSelect.addEventListener("change", () => {
          if (!elements.tutorialSelect.value) return;
          deps.settings.setResumeRunning(false);
          const value = elements.tutorialSelect.value;
          deps.settings.requestSettingChange(() => loadWithTutorialWarning(value), { restartAfter: false });
        });
      }
      if (elements.tempLevelSelect) {
        elements.tempLevelSelect.addEventListener("change", () => {
          if (!elements.tempLevelSelect.value) return;
          deps.settings.setResumeRunning(false);
          const value = elements.tempLevelSelect.value;
          deps.settings.requestSettingChange(() => loadWithTutorialWarning(value), { restartAfter: false });
        });
      }
      elements.operatorCountSelect.addEventListener("change", () => {
        deps.settings.setResumeRunning(false);
        const value = Number(elements.operatorCountSelect.value);
        deps.settings.requestSettingChange(() => {
          runtime.activeOperatorCount = value;
        }, { restartWhenClean: true });
      });
      window.addEventListener("beforeunload", (event) => {
        if (!runtime.state || runtime.state.gameOver) return;
        event.preventDefault();
        event.returnValue = "";
      });
    }

    // Gives unfinished tutorials a visible warning before loading a selected destination.
    function loadWithTutorialWarning(levelId) {
      if (!levelId) return;
      const warned = deps.tutorial && deps.tutorial.warnExit && deps.tutorial.warnExit();
      if (warned) {
        deps.settings.setResumeRunning(false);
        deps.settings.closeSettings();
        window.setTimeout(() => deps.level.loadLevel(levelId), 850);
        return;
      }
      deps.level.loadLevel(levelId);
    }

    return {
      bindEvents
    };
  }

  window.InputSystem = { create };
}());
