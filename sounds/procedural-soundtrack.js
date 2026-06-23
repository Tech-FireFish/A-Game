"use strict";

(function () {
  const TEMPO = 92;
  const BEAT = 60 / TEMPO;
  const LOOP_BEATS = 32;
  const LOOP_SECONDS = LOOP_BEATS * BEAT;
  const LOOKAHEAD_SECONDS = 0.42;
  const SCHEDULE_INTERVAL_MS = 90;

  const LAYER_TARGETS = {
    menu: { ambience: 0.5, bass: 0.16, percussion: 0, melody: 0 },
    exploration: { ambience: 0.52, bass: 0.2, percussion: 0.04, melody: 0 },
    mission: { ambience: 0.56, bass: 0.32, percussion: 0.18, melody: 0.05 },
    combat: { ambience: 0.62, bass: 0.4, percussion: 0.46, melody: 0.28 },
    result: { ambience: 0.38, bass: 0.12, percussion: 0, melody: 0.1 }
  };

  const SOUNDTRACK = {
    ambience: [
      { beat: 0, note: "D2", duration: 8 },
      { beat: 8, note: "A1", duration: 8 },
      { beat: 16, note: "C2", duration: 8 },
      { beat: 24, note: "G1", duration: 8 }
    ],
    bass: [
      { beat: 0, note: "D2" }, { beat: 3, note: "D2" }, { beat: 6, note: "F2" },
      { beat: 8, note: "A1" }, { beat: 11, note: "A1" }, { beat: 14, note: "C2" },
      { beat: 16, note: "C2" }, { beat: 19, note: "C2" }, { beat: 22, note: "E2" },
      { beat: 24, note: "G1" }, { beat: 27, note: "G1" }, { beat: 30, note: "A1" }
    ],
    melody: [
      { beat: 4, note: "D4" }, { beat: 5.5, note: "F4" }, { beat: 7, note: "A4" },
      { beat: 12, note: "C4" }, { beat: 13.5, note: "E4" }, { beat: 15, note: "G4" },
      { beat: 20, note: "A3" }, { beat: 21.5, note: "C4" }, { beat: 23, note: "E4" },
      { beat: 28, note: "G3" }, { beat: 29.5, note: "A3" }, { beat: 31, note: "D4" }
    ],
    percussion: [
      { beat: 0, type: "kick" }, { beat: 2, type: "hat" }, { beat: 4, type: "snare" }, { beat: 6, type: "hat" },
      { beat: 8, type: "kick" }, { beat: 10, type: "hat" }, { beat: 12, type: "snare" }, { beat: 14, type: "hat" },
      { beat: 16, type: "kick" }, { beat: 18, type: "hat" }, { beat: 20, type: "snare" }, { beat: 22, type: "hat" },
      { beat: 24, type: "kick" }, { beat: 26, type: "hat" }, { beat: 28, type: "snare" }, { beat: 30, type: "hat" }
    ]
  };

  function create(deps) {
    const audioContext = deps && deps.audioContext;
    const masterGain = audioContext ? audioContext.createGain() : null;
    const layers = new Map();
    let timer = null;
    let nextLoopStart = 0;
    let started = false;
    let currentState = "";

    if (masterGain) {
      masterGain.gain.value = 0;
      masterGain.connect(audioContext.destination);
      for (const id of ["ambience", "bass", "percussion", "melody"]) {
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        gain.connect(masterGain);
        layers.set(id, { id, gain, target: 0, enabled: true });
      }
    }

    function noteFrequency(note) {
      const match = /^([A-G]#?)(-?\d+)$/.exec(note);
      if (!match) return 220;
      const names = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
      const semitone = names[match[1]] + (Number(match[2]) + 1) * 12;
      return 440 * Math.pow(2, (semitone - 69) / 12);
    }

    function rampAudioParam(param, value, seconds) {
      if (!audioContext || !param) return;
      const now = audioContext.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(Math.max(0, value), now + Math.max(0.01, seconds));
    }

    function envelope(gain, start, peak, attack, decay, sustain, release, duration) {
      gain.gain.cancelScheduledValues(start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), start + attack + decay);
      gain.gain.setValueAtTime(Math.max(0.0001, sustain), start + Math.max(attack + decay, duration - release));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    }

    function scheduleTone(layerId, note, start, duration, options) {
      const layer = layers.get(layerId);
      if (!audioContext || !layer) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      oscillator.type = options.waveform;
      oscillator.frequency.setValueAtTime(noteFrequency(note), start);
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 1200, start);
      filter.Q.setValueAtTime(options.q || 0.8, start);
      envelope(gain, start, options.peak, options.attack, options.decay, options.sustain, options.release, duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(layer.gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }

    function scheduleNoise(layerId, start, duration, options) {
      const layer = layers.get(layerId);
      if (!audioContext || !layer) return;
      const sampleRate = audioContext.sampleRate;
      const buffer = audioContext.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / data.length, options.decayShape || 1);
      }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      source.buffer = buffer;
      filter.type = options.filterType || "bandpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 1400, start);
      filter.Q.setValueAtTime(options.q || 1.5, start);
      envelope(gain, start, options.peak, 0.004, 0.03, options.sustain || 0.001, 0.05, duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(layer.gain);
      source.start(start);
    }

    function scheduleKick(start) {
      const layer = layers.get("percussion");
      if (!audioContext || !layer) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(92, start);
      oscillator.frequency.exponentialRampToValueAtTime(34, start + 0.16);
      envelope(gain, start, 0.48, 0.004, 0.05, 0.12, 0.14, 0.26);
      oscillator.connect(gain);
      gain.connect(layer.gain);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    }

    function schedulePercussion(event, start) {
      if (event.type === "kick") {
        scheduleKick(start);
      } else if (event.type === "snare") {
        scheduleNoise("percussion", start, 0.16, { peak: 0.18, sustain: 0.01, filterFrequency: 980, q: 0.9 });
      } else {
        scheduleNoise("percussion", start, 0.05, { peak: 0.08, sustain: 0.002, filterType: "highpass", filterFrequency: 4200, q: 0.65, decayShape: 1.8 });
      }
    }

    function scheduleLoop(loopStart) {
      for (const event of SOUNDTRACK.ambience) {
        scheduleTone("ambience", event.note, loopStart + event.beat * BEAT, event.duration * BEAT, {
          waveform: "sine",
          peak: 0.12,
          attack: 1.2,
          decay: 1.8,
          sustain: 0.055,
          release: 2.5,
          filterFrequency: 420
        });
      }
      for (const event of SOUNDTRACK.bass) {
        scheduleTone("bass", event.note, loopStart + event.beat * BEAT, 1.15 * BEAT, {
          waveform: "sawtooth",
          peak: 0.18,
          attack: 0.015,
          decay: 0.12,
          sustain: 0.055,
          release: 0.18,
          filterFrequency: 260
        });
      }
      for (const event of SOUNDTRACK.melody) {
        scheduleTone("melody", event.note, loopStart + event.beat * BEAT, 0.9 * BEAT, {
          waveform: "square",
          peak: 0.065,
          attack: 0.02,
          decay: 0.16,
          sustain: 0.024,
          release: 0.18,
          filterFrequency: 1800
        });
      }
      for (const event of SOUNDTRACK.percussion) {
        schedulePercussion(event, loopStart + event.beat * BEAT);
      }
    }

    function tick() {
      if (!audioContext || !started) return;
      while (nextLoopStart < audioContext.currentTime + LOOKAHEAD_SECONDS) {
        scheduleLoop(nextLoopStart);
        nextLoopStart += LOOP_SECONDS;
      }
    }

    function setVolume(value) {
      if (!masterGain) return;
      rampAudioParam(masterGain.gain, Math.max(0, Math.min(1, Number(value) || 0)), 0.2);
    }

    function fadeLayer(layerId, target, seconds) {
      const layer = layers.get(layerId);
      if (!layer) return;
      layer.target = Math.max(0, Math.min(1, Number(target) || 0));
      rampAudioParam(layer.gain.gain, layer.enabled ? layer.target : 0, seconds);
    }

    function setLayerEnabled(layerId, enabled) {
      const layer = layers.get(layerId);
      if (!layer) return;
      layer.enabled = Boolean(enabled);
      fadeLayer(layerId, layer.target, 0.35);
    }

    function setGameplayState(state) {
      const key = LAYER_TARGETS[state] ? state : "menu";
      if (key === currentState) return;
      currentState = key;
      const targets = LAYER_TARGETS[key];
      for (const [layerId, target] of Object.entries(targets)) {
        fadeLayer(layerId, target, key === "combat" ? 0.45 : 1.2);
      }
    }

    function start() {
      if (!audioContext || started) return;
      started = true;
      nextLoopStart = audioContext.currentTime + 0.04;
      if (!currentState) setGameplayState("menu");
      tick();
      timer = window.setInterval(tick, SCHEDULE_INTERVAL_MS);
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
      started = false;
      setVolume(0);
    }

    function snapshot() {
      const result = { state: currentState, started, layers: {} };
      for (const [id, layer] of layers.entries()) {
        result.layers[id] = { enabled: layer.enabled, target: layer.target };
      }
      return result;
    }

    return {
      start,
      stop,
      setVolume,
      setLayerEnabled,
      fadeLayer,
      setGameplayState,
      snapshot
    };
  }

  window.ProceduralSoundtrack = { create };
}());
