"use strict";

(function () {
  const LOOP_SOUND_IDS = new Set(["operator-walk", "enemy-walk"]);
  const WEAPON_SOUND_IDS = new Set(["rifle-shot", "smg-shot", "pistol-shot", "silenced-shot"]);
  const HIGH_FREQUENCY_SOUND_IDS = new Set([
    "button-guidance",
    "rifle-shot",
    "smg-shot",
    "pistol-shot",
    "silenced-shot",
    "empty-magazine-click",
    "armor-hit",
    "body-hit",
    "melee-hit",
    "digital-lock-keypad-press",
    "no-ammo-warning",
    "low-health-warning",
    "enemy-alert",
    "enemy-suspicious"
  ]);
  const BUTTON_POOL_SIZE = 3;
  const WEAPON_POOL_SIZE = 4;
  const EFFECT_POOL_SIZE = 3;

  // Builds sound loading, browser unlock, and playback helpers.
  function create(deps) {
    const sounds = new Map();
    const loops = new Map();
    const loopActivity = new Map();
    let unlocked = false;
    let musicId = null;
    let audioContext = null;
    let soundtrack = null;
    let musicGameplayState = "menu";
    let musicVolume = volumeToUnit(deps.musicVolume);

    // Converts the Settings slider range into an audio volume scalar.
    function volumeToUnit(value) {
      const next = Number(value);
      if (!Number.isFinite(next)) return 0.5;
      return Math.max(0, Math.min(1, next / 100));
    }

    // Creates the shared Web Audio context used by procedural music after user unlock.
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

    // Chooses a small reusable pool size for short one-shot sounds.
    function poolSizeFor(id) {
      if (LOOP_SOUND_IDS.has(id)) return 0;
      if (id === "button-guidance") return BUTTON_POOL_SIZE;
      if (WEAPON_SOUND_IDS.has(id)) return WEAPON_POOL_SIZE;
      return HIGH_FREQUENCY_SOUND_IDS.has(id) ? EFFECT_POOL_SIZE : 0;
    }

    // Marks a sound entry ready once any of its preloaded elements can decode.
    function markReady(entry, audio) {
      if (audio.__preloadReady) return;
      audio.__preloadReady = true;
      entry.loadedCount += 1;
      entry.status = "ready";
    }

    // Records preload errors without making gameplay depend on sound success.
    function markError(entry, audio) {
      if (audio.__preloadError) return;
      audio.__preloadError = true;
      entry.errorCount += 1;
      if (entry.loadedCount === 0 && entry.errorCount >= entry.totalCount) {
        entry.status = "error";
      }
    }

    // Creates an audio element and connects non-fatal preload diagnostics.
    function createAudioElement(entry) {
      const audio = new Audio(entry.file);
      audio.preload = "auto";
      entry.totalCount += 1;
      entry.elements.push(audio);
      audio.addEventListener("loadeddata", () => markReady(entry, audio), { once: true });
      audio.addEventListener("canplaythrough", () => markReady(entry, audio), { once: true });
      audio.addEventListener("error", () => markError(entry, audio), { once: true });
      return audio;
    }

    // Requests browser preload for a single element while staying non-fatal.
    function requestLoad(audio) {
      try {
        audio.load();
      } catch (error) {
        return;
      }
    }

    // Loads each configured audio asset without blocking gameplay on failures.
    function loadSounds() {
      for (const sound of deps.soundOptions) {
        const entry = {
          id: sound.id,
          file: sound.file,
          source: null,
          pool: [],
          poolIndex: 0,
          elements: [],
          totalCount: 0,
          loadedCount: 0,
          errorCount: 0,
          status: "loading"
        };
        entry.source = createAudioElement(entry);
        sounds.set(sound.id, entry);
      }
      preloadAll();
    }

    // Starts or refreshes preload requests for every configured sound.
    function preloadAll() {
      for (const entry of sounds.values()) {
        requestLoad(entry.source);
      }
    }

    // Creates a tiny reuse pool after browser audio has been unlocked.
    function ensurePool(entry) {
      const poolSize = poolSizeFor(entry.id);
      if (!poolSize || entry.pool.length >= poolSize) return;
      for (let index = entry.pool.length; index < poolSize; index += 1) {
        const audio = createAudioElement(entry);
        entry.pool.push(audio);
        requestLoad(audio);
      }
    }

    // Warms source elements and creates only high-frequency pools after unlock.
    function warmUnlockedAudio() {
      for (const entry of sounds.values()) {
        requestLoad(entry.source);
        if (HIGH_FREQUENCY_SOUND_IDS.has(entry.id)) ensurePool(entry);
        for (const audio of entry.pool) {
          try { audio.currentTime = 0; } catch (error) { continue; }
        }
      }
    }

    // Allows playback after the first user gesture, as required by browsers.
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      const context = ensureAudioContext();
      if (context && context.state === "suspended") {
        const result = context.resume();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
      warmUnlockedAudio();
      if (musicId && musicVolume > 0) playMusic(musicId);
    }

    // Returns a pooled one-shot element, preferring elements that are not busy.
    function nextPoolAudio(entry) {
      if (unlocked && HIGH_FREQUENCY_SOUND_IDS.has(entry.id)) ensurePool(entry);
      if (!entry.pool.length) return null;
      for (let offset = 0; offset < entry.pool.length; offset += 1) {
        const index = (entry.poolIndex + offset) % entry.pool.length;
        const audio = entry.pool[index];
        const ready = audio.readyState >= 2;
        if (ready && (audio.paused || audio.ended || audio.currentTime === 0)) {
          entry.poolIndex = (index + 1) % entry.pool.length;
          return audio;
        }
      }
      const audio = entry.pool[entry.poolIndex];
      if (audio.readyState < 2) return null;
      entry.poolIndex = (entry.poolIndex + 1) % entry.pool.length;
      return audio;
    }

    // Plays one sound effect by ID when audio is available.
    function play(id) {
      const entry = sounds.get(id);
      if (!entry || !unlocked) return;
      try {
        const audio = nextPoolAudio(entry) || entry.source;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (error) {
          requestLoad(audio);
        }
        audio.volume = deps.volume;
        const result = audio.play();
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch (error) {
        return;
      }
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
      if (unlocked) {
        startLoop(id);
      }
    }

    // Starts a looping sound if it is not already running.
    function startLoop(id) {
      if (loops.has(id)) return;
      const entry = sounds.get(id);
      if (!entry) return;
      try {
        const audio = entry.source.cloneNode();
        audio.loop = true;
        audio.volume = deps.loopVolume;
        loops.set(id, audio);
        const result = audio.play();
        if (result && typeof result.catch === "function") {
          result.catch(() => stopLoop(id));
        }
      } catch (error) {
        stopLoop(id);
      }
    }

    // Stops and clears a looping sound.
    function stopLoop(id) {
      const audio = loops.get(id);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        return;
      } finally {
        loops.delete(id);
      }
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

    // Reports whether a specific sound, or all sounds, has decoded enough data.
    function isPreloaded(id) {
      if (id === "background-music") return Boolean(window.ProceduralSoundtrack);
      if (id) {
        const entry = sounds.get(id);
        return Boolean(entry && entry.status === "ready");
      }
      return Array.from(sounds.values()).every((entry) => entry.status === "ready" || entry.status === "error");
    }

    loadSounds();

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
