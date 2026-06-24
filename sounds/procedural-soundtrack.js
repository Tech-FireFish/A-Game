"use strict";

(function () {
  const TEMPO = 128;
  const STEPS_PER_BEAT = 4;
  const STEP_SECONDS = 60 / TEMPO / STEPS_PER_BEAT;
  const LOOP_STEPS = 64;
  const LOOKAHEAD_SECONDS = 0.14;
  const SCHEDULE_INTERVAL_MS = 25;
  const MASTER_OUTPUT_CEILING = 0.638;
  const ROOT_MIDI = 38;

  const LAYER_IDS = ["ambience", "bass", "percussion", "melody", "warning"];

  const LAYER_TARGETS = {
    menu: { ambience: 0.56, bass: 0.14, percussion: 0, melody: 0, warning: 0 },
    exploration: { ambience: 0.6, bass: 0.26, percussion: 0.08, melody: 0.03, warning: 0 },
    mission: { ambience: 0.58, bass: 0.52, percussion: 0.34, melody: 0.12, warning: 0.03 },
    combat: { ambience: 0.54, bass: 0.82, percussion: 0.76, melody: 0.58, warning: 0.32 },
    result: { ambience: 0.42, bass: 0.16, percussion: 0, melody: 0.12, warning: 0 }
  };

  const PATTERNS = {
    bass: [
      0, null, 0, null, 3, null, 0, null,
      5, null, 3, null, 0, null, -2, null
    ],
    missionBass: [
      0, 0, null, 0, 3, null, 0, 5,
      0, 0, -2, null, 5, 3, 0, null
    ],
    combatBass: [
      0, 0, -12, 0, 3, 3, null, 5,
      0, 0, -2, 0, 5, 3, 0, -2
    ],
    melodyA: [
      12, null, null, 10, null, 7, null, null,
      12, null, 15, null, 10, null, 7, null
    ],
    melodyB: [
      12, null, 10, null, 7, null, 5, null,
      10, null, 12, null, 15, 14, 12, null
    ],
    combatLead: [
      12, null, 15, 14, 12, 10, 7, null,
      12, 15, 17, null, 15, 14, 12, 10
    ],
    kick: [
      1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 1, 1, 0, 0, 0
    ],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0
    ],
    hat: [
      1, 0, 1, 0, 1, 0, 1, 1,
      1, 0, 1, 0, 1, 1, 1, 0
    ],
    tom: [
      0, 0, 0, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 1, 1, 1
    ]
  };

  function create(deps) {
    const audioContext = deps && deps.audioContext;
    const masterGain = audioContext ? audioContext.createGain() : null;
    const compressor = audioContext ? audioContext.createDynamicsCompressor() : null;
    const layers = new Map();
    const noiseBuffer = audioContext ? createNoiseBuffer(audioContext, 2) : null;
    let timer = null;
    let nextStepTime = 0;
    let currentStep = 0;
    let started = false;
    let currentState = "";
    let requestedVolume = 0;

    if (masterGain && compressor) {
      masterGain.gain.value = 0;
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.2;
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);

      for (const id of LAYER_IDS) {
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        gain.connect(masterGain);
        layers.set(id, { id, gain, target: 0, enabled: true });
      }
    }

    function createNoiseBuffer(context, seconds) {
      const length = Math.floor(context.sampleRate * seconds);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    function clampUnit(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      return Math.max(0, Math.min(1, numeric));
    }

    function midiToFrequency(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function noteFrequency(note) {
      const match = /^([A-G]#?)(-?\d+)$/.exec(note);
      if (!match) return 220;
      const names = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
      const semitone = names[match[1]] + (Number(match[2]) + 1) * 12;
      return midiToFrequency(semitone);
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

    function scheduleTone(layerId, frequency, start, duration, options) {
      const layer = layers.get(layerId);
      if (!audioContext || !layer) return;
      const oscillator = audioContext.createOscillator();
      const second = options.secondWaveform ? audioContext.createOscillator() : null;
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();

      oscillator.type = options.waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.detune.setValueAtTime(options.detune || 0, start);
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 1200, start);
      if (options.filterEnd) {
        filter.frequency.exponentialRampToValueAtTime(options.filterEnd, start + Math.max(0.02, duration * 0.6));
      }
      filter.Q.setValueAtTime(options.q || 0.8, start);
      envelope(gain, start, options.peak, options.attack, options.decay, options.sustain, options.release, duration);

      oscillator.connect(filter);
      if (second) {
        second.type = options.secondWaveform;
        second.frequency.setValueAtTime(frequency * (options.secondRatio || 1), start);
        second.detune.setValueAtTime(options.secondDetune || 0, start);
        second.connect(filter);
        second.start(start);
        second.stop(start + duration + 0.05);
      }
      filter.connect(gain);
      gain.connect(layer.gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }

    function scheduleNoise(layerId, start, duration, options) {
      const layer = layers.get(layerId);
      if (!audioContext || !layer || !noiseBuffer) return;
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      source.buffer = noiseBuffer;
      filter.type = options.filterType || "bandpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 1400, start);
      filter.Q.setValueAtTime(options.q || 1.5, start);
      envelope(gain, start, options.peak, 0.004, 0.03, options.sustain || 0.001, 0.05, duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(layer.gain);
      source.start(start);
      source.stop(start + duration + 0.02);
    }

    function scheduleBass(start, semitoneOffset, accent) {
      const frequency = midiToFrequency(ROOT_MIDI + semitoneOffset);
      scheduleTone("bass", frequency, start, STEP_SECONDS * 1.8, {
        waveform: "sawtooth",
        secondWaveform: "sine",
        secondRatio: 0.5,
        peak: 0.12 * accent,
        attack: 0.008,
        decay: 0.055,
        sustain: 0.04 * accent,
        release: 0.1,
        filterFrequency: 540,
        filterEnd: 135,
        q: 7
      });
    }

    function scheduleLead(start, semitoneOffset, accent) {
      const frequency = midiToFrequency(ROOT_MIDI + semitoneOffset);
      scheduleTone("melody", frequency, start, STEP_SECONDS * 2.6, {
        waveform: "square",
        secondWaveform: "triangle",
        secondRatio: 2,
        secondDetune: 6,
        detune: -5,
        peak: 0.044 * accent,
        attack: 0.012,
        decay: 0.08,
        sustain: 0.018 * accent,
        release: 0.13,
        filterFrequency: 1850 + accent * 420,
        q: 5
      });
    }

    function scheduleDrone(start, note, duration, accent) {
      scheduleTone("ambience", noteFrequency(note), start, duration, {
        waveform: "sine",
        secondWaveform: "triangle",
        secondRatio: 1.5,
        secondDetune: -7,
        peak: 0.06 * accent,
        attack: 1.1,
        decay: 1.4,
        sustain: 0.032 * accent,
        release: 2.2,
        filterFrequency: 430,
        q: 1.2
      });
    }

    function scheduleKick(start, strength) {
      const layer = layers.get("percussion");
      if (!audioContext || !layer) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(148, start);
      oscillator.frequency.exponentialRampToValueAtTime(42, start + 0.13);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.38 * strength, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(layer.gain);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    }

    function scheduleSnare(start, strength) {
      scheduleNoise("percussion", start, 0.15, {
        peak: 0.16 * strength,
        sustain: 0.008,
        filterType: "highpass",
        filterFrequency: 1100,
        q: 0.9
      });
      scheduleTone("percussion", 170, start, 0.12, {
        waveform: "triangle",
        peak: 0.055 * strength,
        attack: 0.003,
        decay: 0.035,
        sustain: 0.006,
        release: 0.055,
        filterFrequency: 620,
        q: 1.1
      });
    }

    function scheduleHat(start, strength, open) {
      scheduleNoise("percussion", start, open ? 0.19 : 0.052, {
        peak: 0.045 * strength,
        sustain: 0.001,
        filterType: "highpass",
        filterFrequency: 6100,
        q: 0.7
      });
    }

    function scheduleTom(start, pitch, strength) {
      scheduleTone("percussion", pitch, start, 0.22, {
        waveform: "sine",
        peak: 0.16 * strength,
        attack: 0.004,
        decay: 0.05,
        sustain: 0.018,
        release: 0.12,
        filterFrequency: 520,
        filterEnd: 180,
        q: 1
      });
    }

    function scheduleMetalHit(start, strength) {
      for (const [index, frequency] of [320, 487, 735].entries()) {
        scheduleTone("percussion", frequency, start, 0.11 + index * 0.035, {
          waveform: index === 0 ? "square" : "sawtooth",
          detune: index * 11,
          peak: (0.028 * strength) / (index + 1),
          attack: 0.003,
          decay: 0.025,
          sustain: 0.002,
          release: 0.055,
          filterType: "bandpass",
          filterFrequency: frequency,
          q: 7
        });
      }
    }

    function scheduleWarningPulse(start, strength) {
      scheduleTone("warning", 82, start, 0.28, {
        waveform: "sawtooth",
        peak: 0.085 * strength,
        attack: 0.018,
        decay: 0.055,
        sustain: 0.028,
        release: 0.12,
        filterFrequency: 360,
        q: 8
      });
    }

    function scheduleRiser(start, duration) {
      const layer = layers.get("warning");
      if (!audioContext || !layer || !noiseBuffer) return;
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      source.buffer = noiseBuffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(300, start);
      filter.frequency.exponentialRampToValueAtTime(5200, start + duration);
      filter.Q.value = 2;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + duration * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(layer.gain);
      source.start(start);
      source.stop(start + duration);
    }

    function scheduleImpact(start, strength) {
      scheduleKick(start, 1.15 * strength);
      scheduleSnare(start, 0.8 * strength);
      scheduleMetalHit(start, 1.05 * strength);
      scheduleTone("bass", 58, start, 0.58, {
        waveform: "sine",
        peak: 0.18 * strength,
        attack: 0.01,
        decay: 0.09,
        sustain: 0.04,
        release: 0.36,
        filterFrequency: 160,
        filterEnd: 55,
        q: 0.8
      });
    }

    function scheduleStep(step, start) {
      const localStep = step % 16;
      const section = Math.floor((step % LOOP_STEPS) / 16);
      const combat = currentState === "combat";
      const mission = currentState === "mission";
      const exploration = currentState === "exploration";
      const result = currentState === "result";
      const active = combat || mission;

      if (localStep === 0) {
        const droneNotes = ["D2", "A1", "C2", "G1"];
        scheduleDrone(start, droneNotes[section] || "D2", STEP_SECONDS * 16, combat ? 1.05 : 0.85);
      }

      const bassPattern = combat ? PATTERNS.combatBass : mission ? PATTERNS.missionBass : PATTERNS.bass;
      const bassValue = bassPattern[localStep];
      if (bassValue !== null && (active || exploration || (currentState === "menu" && localStep % 8 === 0) || result)) {
        scheduleBass(start, bassValue, localStep === 0 ? 1.18 : combat ? 1.06 : 0.88);
        if (combat && localStep % 4 === 0) scheduleBass(start, bassValue - 12, 0.42);
      }

      if (active || exploration) {
        if (PATTERNS.kick[localStep] || (combat && [2, 6, 10, 14].includes(localStep))) {
          scheduleKick(start, localStep === 0 ? 1.18 : combat ? 1 : 0.82);
        }
        if (PATTERNS.snare[localStep]) {
          scheduleSnare(start, combat ? 1.12 : 0.9);
          if (combat) scheduleMetalHit(start, 0.72);
        }
        if (PATTERNS.hat[localStep] || (combat && localStep % 2 === 1)) {
          scheduleHat(start, combat ? (localStep % 2 === 0 ? 0.9 : 0.58) : mission ? 0.62 : 0.42, localStep === 7 || localStep === 14);
        }
        if (combat && PATTERNS.tom[localStep]) {
          scheduleTom(start, localStep >= 13 ? 118 + (localStep - 13) * 18 : 92, 0.86);
        }
      }

      const melodyPattern = combat
        ? PATTERNS.combatLead
        : section === 0 || section === 3
          ? PATTERNS.melodyA
          : PATTERNS.melodyB;
      const melodyValue = melodyPattern[localStep];
      if (melodyValue !== null && (combat || (mission && section !== 0) || result)) {
        scheduleLead(start, melodyValue, combat ? 1.22 : mission ? 0.88 : 0.64);
        if (combat && localStep % 4 === 0) scheduleLead(start, melodyValue + 12, 0.38);
      }

      if (combat && (localStep === 0 || localStep === 8)) scheduleWarningPulse(start, localStep === 0 ? 1.1 : 0.85);
      if (combat && localStep === 0) scheduleImpact(start, section === 0 ? 1.08 : 0.8);
      if (combat && localStep === 12 && section === 3) scheduleRiser(start, STEP_SECONDS * 4);
    }

    function tick() {
      if (!audioContext || !started) return;
      while (nextStepTime < audioContext.currentTime + LOOKAHEAD_SECONDS) {
        scheduleStep(currentStep, nextStepTime);
        nextStepTime += STEP_SECONDS;
        currentStep = (currentStep + 1) % LOOP_STEPS;
      }
    }

    function setVolume(value) {
      requestedVolume = clampUnit(value);
      if (!masterGain) return;
      rampAudioParam(masterGain.gain, requestedVolume * MASTER_OUTPUT_CEILING, 0.2);
    }

    function fadeLayer(layerId, target, seconds) {
      const layer = layers.get(layerId);
      if (!layer) return;
      layer.target = clampUnit(target);
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
        fadeLayer(layerId, target, key === "combat" ? 0.45 : 1.1);
      }
    }

    function start() {
      if (!audioContext || started) return;
      started = true;
      currentStep = 0;
      nextStepTime = audioContext.currentTime + 0.06;
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
      const result = {
        state: currentState,
        started,
        tempo: TEMPO,
        requestedVolume,
        masterCeiling: MASTER_OUTPUT_CEILING,
        layers: {}
      };
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
