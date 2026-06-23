"use strict";

(function () {
  // Builds start, main, pause, expanded, and overlay navigation behavior.
  function create(deps) {
    const runtime = deps.runtime;
    const elements = deps.elements;

    // Shows the start screen at boot.
    function showStart() {
      if (deps.hideMissionBriefing) deps.hideMissionBriefing();
      document.documentElement.classList.add("start-menu-active");
      document.body.classList.add("start-menu-active");
      if (elements.startMenuOverlay) elements.startMenuOverlay.classList.remove("hidden");
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
      if (elements.mainMenuOverlay) elements.mainMenuOverlay.classList.add("hidden");
      if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
      if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
      runtime.onboardingReturnToStore = false;
      if (deps.refreshStartMenu) deps.refreshStartMenu();
      closePause();
      if (runtime.state) runtime.state.running = false;
    }

    // Shows the display-only Store page between Start and onboarding.
    function showStore() {
      if (deps.hideMissionBriefing) deps.hideMissionBriefing();
      document.documentElement.classList.add("start-menu-active");
      document.body.classList.add("start-menu-active");
      if (deps.renderStorePage) deps.renderStorePage();
      if (elements.startMenuOverlay) elements.startMenuOverlay.classList.add("hidden");
      if (elements.mainMenuOverlay) elements.mainMenuOverlay.classList.add("hidden");
      if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
      if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.remove("hidden");
      runtime.onboardingReturnToStore = true;
      closePause();
      if (runtime.state) runtime.state.running = false;
    }

    // Closes the Store page and returns to the start menu.
    function closeStore() {
      if (!isStoreOpen()) return false;
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
      showStart();
      return true;
    }

    // Reports whether the Store page is visible.
    function isStoreOpen() {
      return Boolean(elements.storeMenuOverlay && !elements.storeMenuOverlay.classList.contains("hidden"));
    }

    // Opens onboarding from the Store or Start flow.
    function openOnboarding(options = {}) {
      runtime.onboardingReturnToStore = Boolean(options.returnToStore);
      if (elements.startInfoPanel) elements.startInfoPanel.classList.add("hidden");
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
      if (elements.startMenuOverlay) elements.startMenuOverlay.classList.remove("hidden");
      if (elements.onboardingQuestion) elements.onboardingQuestion.classList.remove("hidden");
    }

    // Closes onboarding and returns to the appropriate previous menu.
    function closeOnboarding() {
      if (!elements.onboardingQuestion || elements.onboardingQuestion.classList.contains("hidden")) return false;
      elements.onboardingQuestion.classList.add("hidden");
      if (runtime.onboardingReturnToStore) showStore();
      else showStart();
      return true;
    }

    // Shows the main navigation page.
    function showMain(options = {}) {
      if (deps.hideMissionBriefing) deps.hideMissionBriefing();
      const returnToPause = Boolean(options.returnToPause);
      const returnResumeRunning = Boolean(options.resumeRunning);
      document.documentElement.classList.remove("start-menu-active");
      document.body.classList.remove("start-menu-active");
      if (elements.startMenuOverlay) elements.startMenuOverlay.classList.add("hidden");
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
      if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
      if (elements.mainMenuOverlay) elements.mainMenuOverlay.classList.remove("hidden");
      runtime.onboardingReturnToStore = false;
      closePause({ resume: false });
      runtime.menuReturnToPause = returnToPause;
      runtime.menuReturnResumeRunning = returnResumeRunning;
      if (runtime.state) runtime.state.running = false;
      render();
    }

    // Enters active gameplay from menus.
    function enterGame() {
      if (deps.settings && deps.settings.isOpen && deps.settings.isOpen()) deps.settings.closeSettings();
      document.documentElement.classList.remove("start-menu-active");
      document.body.classList.remove("start-menu-active");
      if (elements.startMenuOverlay) elements.startMenuOverlay.classList.add("hidden");
      if (elements.storeMenuOverlay) elements.storeMenuOverlay.classList.add("hidden");
      if (elements.onboardingQuestion) elements.onboardingQuestion.classList.add("hidden");
      if (elements.mainMenuOverlay) elements.mainMenuOverlay.classList.add("hidden");
      runtime.onboardingReturnToStore = false;
      runtime.menuReturnToPause = false;
      runtime.menuReturnResumeRunning = false;
      closePause();
      deps.updateHud();
    }

    // Opens pause navigation and freezes gameplay.
    function openPause(options = {}) {
      if (runtime.pauseOpen) return;
      runtime.pauseResumeRunning = typeof options.resumeRunning === "boolean"
        ? options.resumeRunning
        : Boolean(runtime.state && runtime.state.running);
      if (runtime.state) runtime.state.running = false;
      runtime.pauseOpen = true;
      runtime.expandedPaused = Boolean(runtime.expandedGame);
      document.body.classList.toggle("expanded-paused", runtime.expandedPaused);
      deps.keysDown.clear();
      elements.pauseOverlay.classList.remove("hidden");
      deps.updateHud();
    }

    // Closes pause navigation and optionally resumes gameplay.
    function closePause(options = {}) {
      if (!runtime.pauseOpen) return;
      const shouldResume = options.resume !== false;
      runtime.pauseOpen = false;
      runtime.expandedPaused = false;
      document.body.classList.remove("expanded-paused");
      elements.pauseOverlay.classList.add("hidden");
      if (shouldResume && runtime.state && !runtime.state.gameOver && runtime.pauseResumeRunning) runtime.state.running = true;
      runtime.pauseResumeRunning = false;
      deps.updateHud();
    }

    // Toggles pause navigation from Esc or the expanded PAUSE button.
    function togglePause() {
      if (runtime.pauseOpen) closePause();
      else openPause();
    }

    // Opens main page focused on levels.
    function showLevelMenu() {
      showMain({
        returnToPause: runtime.pauseOpen,
        resumeRunning: runtime.pauseResumeRunning
      });
    }

    // Opens main page focused on tutorials.
    function showTutorialMenu() {
      showMain({
        returnToPause: runtime.pauseOpen,
        resumeRunning: runtime.pauseResumeRunning
      });
    }

    // Opens Settings from pause.
    function openSettingsFromPause() {
      closePause();
      deps.settings.openSettings();
    }

    // Toggles expanded gameplay layout.
    function toggleExpanded(force) {
      const next = typeof force === "boolean" ? force : !runtime.expandedGame;
      runtime.expandedGame = next;
      if (!next) {
        runtime.expandedPaused = false;
        document.body.classList.remove("expanded-paused");
      }
      document.body.classList.toggle("game-expanded", next);
      if (elements.expandedNav) elements.expandedNav.classList.toggle("hidden", !next);
      if (elements.expandGameButton) elements.expandGameButton.textContent = "Expand";
      if (deps.resizeCanvas) requestAnimationFrame(deps.resizeCanvas);
      deps.updateHud();
    }

    // Reports whether the main navigation page is currently visible.
    function isMainOpen() {
      return Boolean(elements.mainMenuOverlay && !elements.mainMenuOverlay.classList.contains("hidden"));
    }

    // Closes main navigation, returning to pause when it was opened from pause.
    function closeMainOverlay() {
      if (!isMainOpen()) return false;
      if (elements.mainMenuOverlay) elements.mainMenuOverlay.classList.add("hidden");
      if (runtime.menuReturnToPause) {
        const resumeRunning = Boolean(runtime.menuReturnResumeRunning);
        runtime.menuReturnToPause = false;
        runtime.menuReturnResumeRunning = false;
        openPause({ resumeRunning });
      } else {
        runtime.menuReturnToPause = false;
        runtime.menuReturnResumeRunning = false;
        if (runtime.state) runtime.state.running = false;
        deps.updateHud();
      }
      return true;
    }

    // Renders level/tutorial number blocks and privilege state.
    function render() {
      if (!runtime.gameDataReady) {
        if (elements.menuLevelBlocks) elements.menuLevelBlocks.innerHTML = "";
        if (elements.menuTutorialBlocks) elements.menuTutorialBlocks.innerHTML = "";
        if (elements.privilegeBoard) elements.privilegeBoard.innerHTML = "";
        return;
      }
      // Privilege/access card disabled while progression/access locks are disabled.
      // deps.progression.renderPrivilegeBoard();
      renderLevelBlocks();
      renderTutorialBlocks();
      if (elements.menuDifficultySelect) elements.menuDifficultySelect.value = runtime.currentDifficulty;
      if (elements.menuShootingModeSelect && runtime.state) elements.menuShootingModeSelect.value = runtime.state.shootingMode || "automatic";
    }

    // Renders story level number blocks.
    function renderLevelBlocks() {
      if (!elements.menuLevelBlocks) return;
      const progress = deps.progression.snapshot();
      elements.menuLevelBlocks.innerHTML = deps.levelOptions.map((level, index) => {
        const unlocked = deps.progression.isLevelUnlocked(index);
        const completed = progress.completedLevels.includes(level.id);
        const className = [unlocked ? "" : "locked", completed ? "completed" : ""].filter(Boolean).join(" ");
        return `<button type="button" data-menu-level="${level.id}" class="${className}" ${unlocked ? "" : "disabled"} title="${level.title}">${index + 1}</button>`;
      }).join("");
    }

    // Renders tutorial number blocks.
    function renderTutorialBlocks() {
      if (!elements.menuTutorialBlocks) return;
      const progress = deps.progression.snapshot();
      elements.menuTutorialBlocks.innerHTML = deps.tutorialOptions.map((tutorial, index) => (
        `<button type="button" data-menu-tutorial="${tutorial.id}" class="${progress.completedTutorials.includes(tutorial.id) ? "completed" : ""}" title="${tutorial.title}">${index + 1}</button>`
      )).join("");
    }

    return {
      showStart,
      showStore,
      closeStore,
      isStoreOpen,
      openOnboarding,
      closeOnboarding,
      showMain,
      enterGame,
      openPause,
      closePause,
      showLevelMenu,
      showTutorialMenu,
      openSettingsFromPause,
      togglePause,
      toggleExpanded,
      isMainOpen,
      closeMainOverlay,
      render
    };
  }

  window.MenuSystem = { create };
}());
