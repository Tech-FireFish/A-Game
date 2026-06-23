"use strict";

(function () {
  const LOOP_SOUND_IDS = new Set(["operator-walk", "enemy-walk"]);

  // Builds browser unlock, procedural music, and procedural sound effect helpers.
  function create(deps) {
    const soundIds = new Set((deps.soundOptions || []).map((sound) => sound.id));
    let unlocked = false;
    let musicId = null;
    let audioContext = null;
    let soundtrack = null;
    let proceduralEffects = null;
    let sfxMasterGain = null;
    let sfxCompressor = null;
    let musicGameplayState = "menu";
    let musicVolume = volumeToUnit(deps.musicVolume);
    const loopActivity = new Map();

    // Converts the Settings slider range into an audio volume scalar.
    function volumeToUnit(value) {
      const next = Number(value);
      if (!Number.isFinite(next)) return 0.5;
      return Math.max(0, Math.min(1, next / 100));
    }

    // Creates the shared Web Audio context used by procedural audio after user unlock.
    function ensureAudioContext() {
      if (audioContext) return audioContext;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      try {
        audioContext = new AudioContextCtor();
      } catch (error) {
        audioContext = null;
      }
      return audioContext;
    }

    // Builds a separate SFX master path so generated effects stay independent from music volume.
    function ensureSfxGraph() {
      const context = ensureAudioContext();
      if (!context || sfxMasterGain) return sfxMasterGain;
      sfxMasterGain = context.createGain();
      sfxCompressor = context.createDynamicsCompressor();
      sfxMasterGain.gain.value = Number.isFinite(deps.volume) ? Math.max(0, deps.volume) : 0.605;
      sfxCompressor.threshold.value = -10;
      sfxCompressor.knee.value = 10;
      sfxCompressor.ratio.value = 8;
      sfxCompressor.attack.value = 0.002;
      sfxCompressor.release.value = 0.12;
      sfxMasterGain.connect(sfxCompressor);
      sfxCompressor.connect(context.destination);
      return sfxMasterGain;
    }

    // Builds the layered procedural soundtrack once the Web Audio context exists.
    function ensureSoundtrack() {
      if (soundtrack) return soundtrack;
      const context = ensureAudioContext();
      if (!context || !window.ProceduralSoundtrack) return null;
      soundtrack = window.ProceduralSoundtrack.create({ audioContext: context });
      soundtrack.setVolume(musicVolume);
      soundtrack.setGameplayState(musicGameplayState);
      return soundtrack;
    }

    // Builds the procedural SFX generator once the SFX output path exists.
    function ensureEffects() {
      if (proceduralEffects) return proceduralEffects;
      const context = ensureAudioContext();
      const outputNode = ensureSfxGraph();
      if (!context || !outputNode || !window.ProceduralEffects) return null;
      proceduralEffects = window.ProceduralEffects.create({
        audioContext: context,
        outputNode
      });
      return proceduralEffects;
    }

    // Keeps the public preload call for diagnostics; procedural sounds need no fetch/decode pass.
    function preloadAll() {
      return true;
    }

    // Allows playback after the first user gesture, as required by browsers.
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      const context = ensureAudioContext();
      ensureSfxGraph();
      ensureEffects();
      if (context && context.state === "suspended") {
        const result = context.resume();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
      if (musicId && musicVolume > 0) playMusic(musicId);
    }

    // Plays one generated sound effect by ID when audio is available.
    function play(id) {
      if (!unlocked || !soundIds.has(id)) return;
      const effects = ensureEffects();
      if (!effects || !effects.has(id)) return;
      effects.play(id);
    }

    // Maps weapon IDs to their matching weapon-fire sound.
    function playWeapon(weaponId, weapon = null) {
      if (weaponId === "no-weapon") return;
      if (weapon && weapon.shotSound) {
        play(weapon.shotSound);
      } else if (weaponId === "smg") {
        play("smg-shot");
      } else if (weaponId === "silenced-pistol") {
        play("silenced-shot");
      } else if (weaponId === "pistol") {
        play("pistol-shot");
      } else {
        play("rifle-shot");
      }
    }

    // Marks a looping movement sound as active for the current frame.
    function noteLoopActivity(id) {
      loopActivity.set(id, 0.18);
      if (unlocked) startLoop(id);
    }

    // Starts a generated movement loop if it is not already running.
    function startLoop(id) {
      if (!unlocked || !LOOP_SOUND_IDS.has(id) || !soundIds.has(id)) return;
      const effects = ensureEffects();
      if (!effects || !effects.has(id)) return;
      const baseVolume = Number.isFinite(deps.volume) && deps.volume > 0 ? deps.volume : 0.605;
      const loopVolume = Number.isFinite(deps.loopVolume) ? deps.loopVolume : 0.374;
      effects.startLoop(id, { volume: Math.max(0, Math.min(1, loopVolume / baseVolume)) });
    }

    // Stops and clears a generated movement loop.
    function stopLoop(id) {
      const effects = ensureEffects();
      if (effects) effects.stopLoop(id);
    }

    // Starts or resumes the persistent background music loop after browser unlock.
    function playMusic(id) {
      musicId = id;
      if (!unlocked || musicVolume <= 0) return;
      if (id !== "background-music") return;
      const activeSoundtrack = ensureSoundtrack();
      if (!activeSoundtrack) return;
      activeSoundtrack.setVolume(musicVolume);
      activeSoundtrack.setGameplayState(musicGameplayState);
      activeSoundtrack.start();
    }

    // Stops the persistent background music loop without affecting sound effects.
    function stopMusic() {
      if (soundtrack) soundtrack.stop();
    }

    // Applies the Settings slider volume and starts/stops music as needed.
    function setMusicVolume(value) {
      musicVolume = volumeToUnit(value);
      if (soundtrack) soundtrack.setVolume(musicVolume);
      if (musicVolume <= 0) {
        stopMusic();
      } else if (musicId && unlocked) {
        playMusic(musicId);
      }
    }

    // Returns the music volume in the same 0-100 range used by Settings.
    function getMusicVolume() {
      return Math.round(musicVolume * 100);
    }

    // Fades procedural soundtrack layers to match the current gameplay state.
    function setMusicGameplayState(state) {
      musicGameplayState = state || "menu";
      if (soundtrack) soundtrack.setGameplayState(musicGameplayState);
    }

    // Expires movement-loop activity when units stop reporting movement.
    function update(dt) {
      for (const [id, remaining] of loopActivity.entries()) {
        const next = remaining - dt;
        if (next <= 0) {
          loopActivity.delete(id);
          stopLoop(id);
        } else {
          loopActivity.set(id, next);
        }
      }
    }

    // Reports whether browser audio has been unlocked by user input.
    function isUnlocked() {
      return unlocked;
    }

    // Reports whether a generated sound ID is available. No network preload is required.
    function isPreloaded(id) {
      if (id === "background-music") return Boolean(window.ProceduralSoundtrack);
      const proceduralIds = window.ProceduralEffects && typeof window.ProceduralEffects.ids === "function"
        ? new Set(window.ProceduralEffects.ids())
        : null;
      if (id) return Boolean(soundIds.has(id) && proceduralIds && proceduralIds.has(id));
      return Boolean(window.ProceduralEffects && window.ProceduralSoundtrack);
    }

    preloadAll();

    return {
      preloadAll,
      unlock,
      play,
      playWeapon,
      playMusic,
      stopMusic,
      setMusicVolume,
      getMusicVolume,
      setMusicGameplayState,
      noteLoopActivity,
      startLoop,
      stopLoop,
      update,
      isUnlocked,
      isPreloaded
    };
  }

  window.AudioSystem = { create };
}());
