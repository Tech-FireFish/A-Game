"use strict";

(function () {
  const SOUND_IDS = [
    "door-open",
    "door-locked",
    "rifle-shot",
    "smg-shot",
    "pistol-shot",
    "silenced-shot",
    "operator-down",
    "mission-success",
    "mission-failed",
    "window-break",
    "operator-walk",
    "enemy-walk",
    "button-guidance",
    "store-select",
    "store-purchase",
    "reload",
    "empty-magazine-click",
    "armor-hit",
    "body-hit",
    "melee-hit",
    "enemy-alert",
    "reload-complete",
    "enemy-suspicious",
    "paper-pickup",
    "gear-equip",
    "inventory-open",
    "inventory-close",
    "digital-lock-correct",
    "digital-lock-keypad-press",
    "door-close",
    "window-open",
    "window-vault",
    "glass-step-damage",
    "stairs-use",
    "laptop-open",
    "hack-start",
    "camera-select",
    "objective-secured",
    "vip-harmed",
    "low-health-warning",
    "no-ammo-warning"
  ];

  const LOOP_IDS = new Set(["operator-walk", "enemy-walk"]);
  const KNOWN_IDS = new Set(SOUND_IDS);

  function create(deps = {}) {
    const audioContext = deps.audioContext || null;
    const outputNode = deps.outputNode || null;
    const loops = new Map();
    const noiseBuffer = audioContext ? createNoiseBuffer(audioContext, 2) : null;

    function createNoiseBuffer(context, seconds) {
      const length = Math.max(1, Math.floor(context.sampleRate * seconds));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    function has(id) {
      return KNOWN_IDS.has(id);
    }

    function clamp(value, min, max) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return min;
      return Math.max(min, Math.min(max, numeric));
    }

    function now() {
      return audioContext ? audioContext.currentTime : 0;
    }

    function connectToOutput(node) {
      if (!node || !outputNode) return;
      node.connect(outputNode);
    }

    function env(gainParam, start, peak, attack, decay, sustain, release, duration) {
      const safePeak = Math.max(0.0001, peak);
      const safeSustain = Math.max(0.0001, sustain);
      gainParam.cancelScheduledValues(start);
      gainParam.setValueAtTime(0.0001, start);
      gainParam.exponentialRampToValueAtTime(safePeak, start + Math.max(0.002, attack));
      gainParam.exponentialRampToValueAtTime(safeSustain, start + Math.max(0.004, attack + decay));
      gainParam.setValueAtTime(safeSustain, start + Math.max(attack + decay, duration - release));
      gainParam.exponentialRampToValueAtTime(0.0001, start + duration);
    }

    function tone(time, frequency, duration, options = {}) {
      if (!audioContext || !outputNode) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      oscillator.type = options.waveform || "sine";
      oscillator.frequency.setValueAtTime(frequency, time);
      if (options.frequencyEnd) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.frequencyEnd), time + duration);
      }
      oscillator.detune.setValueAtTime(options.detune || 0, time);
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 8000, time);
      if (options.filterEnd) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, options.filterEnd), time + Math.max(0.01, duration * 0.75));
      }
      filter.Q.setValueAtTime(options.q || 0.7, time);
      env(
        gain.gain,
        time,
        options.peak || 0.12,
        options.attack || 0.006,
        options.decay || 0.04,
        options.sustain || 0.01,
        options.release || 0.04,
        duration
      );
      oscillator.connect(filter);
      filter.connect(gain);
      connectToOutput(gain);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    }

    function noise(time, duration, options = {}) {
      if (!audioContext || !outputNode || !noiseBuffer) return;
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      source.buffer = noiseBuffer;
      filter.type = options.filterType || "bandpass";
      filter.frequency.setValueAtTime(options.filterFrequency || 1600, time);
      if (options.filterEnd) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, options.filterEnd), time + Math.max(0.01, duration * 0.75));
      }
      filter.Q.setValueAtTime(options.q || 1.4, time);
      env(
        gain.gain,
        time,
        options.peak || 0.08,
        options.attack || 0.003,
        options.decay || 0.025,
        options.sustain || 0.002,
        options.release || 0.045,
        duration
      );
      source.connect(filter);
      filter.connect(gain);
      connectToOutput(gain);
      source.start(time);
      source.stop(time + duration + 0.02);
    }

    function blip(time, notes, options = {}) {
      notes.forEach((frequency, index) => {
        tone(time + index * (options.gap || 0.045), frequency, options.duration || 0.12, {
          waveform: options.waveform || "triangle",
          peak: (options.peak || 0.09) * (options.fade ? 1 - index * 0.14 : 1),
          attack: 0.006,
          decay: 0.035,
          sustain: 0.008,
          release: 0.055,
          filterFrequency: options.filterFrequency || 2400,
          q: options.q || 2
        });
      });
    }

    function impact(time, strength = 1) {
      tone(time, 90, 0.22, {
        waveform: "sine",
        frequencyEnd: 38,
        peak: 0.22 * strength,
        attack: 0.004,
        decay: 0.035,
        sustain: 0.025,
        release: 0.12,
        filterFrequency: 240
      });
      noise(time, 0.16, {
        peak: 0.12 * strength,
        filterType: "lowpass",
        filterFrequency: 1200,
        filterEnd: 180,
        q: 1.2
      });
    }

    function shot(time, profile) {
      tone(time, profile.pitch, profile.duration, {
        waveform: profile.waveform || "square",
        frequencyEnd: profile.pitchEnd,
        peak: profile.peak,
        attack: 0.002,
        decay: 0.018,
        sustain: 0.004,
        release: profile.duration * 0.45,
        filterFrequency: profile.filter || 3800,
        filterEnd: profile.filterEnd || 600,
        q: 1.6
      });
      noise(time, profile.noiseDuration || 0.08, {
        peak: profile.noise || 0.12,
        filterType: profile.noiseFilter || "highpass",
        filterFrequency: profile.noiseFreq || 2600,
        filterEnd: profile.noiseEnd || 900,
        q: 0.9
      });
      if (profile.body) impact(time + 0.012, profile.body);
    }

    function play(id, options = {}) {
      if (!audioContext || !outputNode || !has(id)) return;
      if (LOOP_IDS.has(id)) {
        startLoop(id, options);
        return;
      }
      const t = now() + 0.004;
      switch (id) {
        case "button-guidance":
          tone(t, 164, 0.22, { waveform: "sine", peak: 0.08, attack: 0.012, decay: 0.05, sustain: 0.018, release: 0.12, filterFrequency: 700 });
          blip(t + 0.025, [523, 784, 1046], { peak: 0.035, duration: 0.18, gap: 0.035, filterFrequency: 3200, fade: true });
          break;
        case "store-select":
          blip(t, [392, 523], { peak: 0.055, duration: 0.1, gap: 0.045, filterFrequency: 2600 });
          break;
        case "store-purchase":
          blip(t, [330, 494, 659, 988], { peak: 0.06, duration: 0.16, gap: 0.055, filterFrequency: 3400 });
          tone(t, 82, 0.28, { waveform: "sine", peak: 0.09, attack: 0.012, decay: 0.05, sustain: 0.02, release: 0.16, filterFrequency: 360 });
          break;
        case "rifle-shot":
          shot(t, { pitch: 180, pitchEnd: 48, duration: 0.13, peak: 0.28, noise: 0.2, noiseDuration: 0.09, body: 0.55 });
          break;
        case "smg-shot":
          shot(t, { pitch: 220, pitchEnd: 70, duration: 0.085, peak: 0.2, noise: 0.16, noiseDuration: 0.06, body: 0.32 });
          break;
        case "pistol-shot":
          shot(t, { pitch: 205, pitchEnd: 58, duration: 0.11, peak: 0.23, noise: 0.17, noiseDuration: 0.075, body: 0.42 });
          break;
        case "silenced-shot":
          shot(t, { pitch: 155, pitchEnd: 65, duration: 0.07, peak: 0.08, noise: 0.055, noiseDuration: 0.05, noiseFilter: "bandpass", noiseFreq: 900, noiseEnd: 420 });
          break;
        case "reload":
          noise(t, 0.05, { peak: 0.055, filterType: "bandpass", filterFrequency: 900, q: 4 });
          noise(t + 0.11, 0.075, { peak: 0.065, filterType: "bandpass", filterFrequency: 1450, q: 5 });
          noise(t + 0.24, 0.08, { peak: 0.052, filterType: "highpass", filterFrequency: 1700, q: 2 });
          break;
        case "reload-complete":
          noise(t, 0.07, { peak: 0.065, filterType: "bandpass", filterFrequency: 1600, q: 5 });
          tone(t + 0.035, 360, 0.08, { waveform: "triangle", peak: 0.035, filterFrequency: 1800 });
          break;
        case "empty-magazine-click":
          tone(t, 1350, 0.045, { waveform: "square", peak: 0.04, attack: 0.002, decay: 0.012, sustain: 0.003, release: 0.018, filterFrequency: 2600 });
          break;
        case "no-ammo-warning":
          blip(t, [220, 180], { peak: 0.05, duration: 0.1, gap: 0.08, waveform: "square", filterFrequency: 1200 });
          break;
        case "armor-hit":
          impact(t, 0.38);
          tone(t, 620, 0.12, { waveform: "square", peak: 0.07, filterType: "bandpass", filterFrequency: 680, q: 8 });
          break;
        case "body-hit":
          impact(t, 0.28);
          noise(t, 0.1, { peak: 0.06, filterType: "lowpass", filterFrequency: 650, q: 1.5 });
          break;
        case "melee-hit":
          noise(t, 0.09, { peak: 0.11, filterType: "bandpass", filterFrequency: 620, q: 2.5 });
          impact(t + 0.02, 0.35);
          break;
        case "operator-down":
          tone(t, 140, 0.42, { waveform: "sawtooth", frequencyEnd: 48, peak: 0.13, attack: 0.008, decay: 0.08, sustain: 0.035, release: 0.28, filterFrequency: 520, filterEnd: 120 });
          noise(t + 0.04, 0.32, { peak: 0.08, filterType: "lowpass", filterFrequency: 500, filterEnd: 100 });
          break;
        case "enemy-alert":
          blip(t, [740, 988, 740], { peak: 0.055, duration: 0.12, gap: 0.065, waveform: "square", filterFrequency: 2600 });
          break;
        case "enemy-suspicious":
          blip(t, [440, 554], { peak: 0.04, duration: 0.14, gap: 0.08, waveform: "triangle", filterFrequency: 1800 });
          break;
        case "low-health-warning":
          blip(t, [196, 196, 196], { peak: 0.055, duration: 0.12, gap: 0.14, waveform: "sawtooth", filterFrequency: 700 });
          break;
        case "door-open":
        case "door-close":
          noise(t, 0.18, { peak: 0.08, filterType: "bandpass", filterFrequency: id === "door-open" ? 520 : 420, filterEnd: id === "door-open" ? 1300 : 260, q: 2.4 });
          tone(t + 0.14, id === "door-open" ? 280 : 180, 0.08, { waveform: "triangle", peak: 0.035, filterFrequency: 900 });
          break;
        case "door-locked":
          tone(t, 145, 0.08, { waveform: "square", peak: 0.08, filterFrequency: 700 });
          tone(t + 0.07, 120, 0.08, { waveform: "square", peak: 0.055, filterFrequency: 560 });
          break;
        case "window-open":
          noise(t, 0.17, { peak: 0.055, filterType: "highpass", filterFrequency: 1600, filterEnd: 500, q: 1.2 });
          break;
        case "window-break":
          for (let index = 0; index < 4; index += 1) {
            noise(t + index * 0.018, 0.08, { peak: 0.075 - index * 0.01, filterType: "highpass", filterFrequency: 2400 + index * 800, q: 2 });
          }
          break;
        case "window-vault":
          noise(t, 0.16, { peak: 0.075, filterType: "bandpass", filterFrequency: 800, q: 1.6 });
          impact(t + 0.13, 0.24);
          break;
        case "glass-step-damage":
          noise(t, 0.08, { peak: 0.07, filterType: "highpass", filterFrequency: 3200, q: 3 });
          noise(t + 0.08, 0.06, { peak: 0.045, filterType: "highpass", filterFrequency: 4200, q: 2.5 });
          break;
        case "inventory-open":
        case "inventory-close":
          blip(t, id === "inventory-open" ? [262, 392] : [392, 262], { peak: 0.04, duration: 0.09, gap: 0.05, filterFrequency: 2000 });
          break;
        case "paper-pickup":
          noise(t, 0.09, { peak: 0.04, filterType: "highpass", filterFrequency: 1700, q: 1.1 });
          noise(t + 0.045, 0.08, { peak: 0.032, filterType: "bandpass", filterFrequency: 900, q: 1.6 });
          break;
        case "gear-equip":
          noise(t, 0.07, { peak: 0.055, filterType: "bandpass", filterFrequency: 1200, q: 4 });
          tone(t + 0.035, 440, 0.08, { waveform: "triangle", peak: 0.035, filterFrequency: 1600 });
          break;
        case "digital-lock-keypad-press":
          tone(t, 880, 0.055, { waveform: "square", peak: 0.035, filterFrequency: 2200 });
          break;
        case "digital-lock-correct":
          blip(t, [523, 659, 784], { peak: 0.045, duration: 0.11, gap: 0.05, filterFrequency: 2600 });
          break;
        case "laptop-open":
          noise(t, 0.08, { peak: 0.05, filterType: "bandpass", filterFrequency: 700, q: 2 });
          blip(t + 0.04, [330, 660], { peak: 0.035, duration: 0.12, gap: 0.055, filterFrequency: 2400 });
          break;
        case "hack-start":
          blip(t, [330, 370, 415, 494], { peak: 0.035, duration: 0.075, gap: 0.045, waveform: "square", filterFrequency: 1900 });
          noise(t + 0.08, 0.22, { peak: 0.035, filterType: "bandpass", filterFrequency: 1800, filterEnd: 4200, q: 1.7 });
          break;
        case "camera-select":
          blip(t, [740, 555], { peak: 0.035, duration: 0.075, gap: 0.055, waveform: "triangle", filterFrequency: 2500 });
          break;
        case "stairs-use":
          noise(t, 0.08, { peak: 0.055, filterType: "bandpass", filterFrequency: 520, q: 1.4 });
          noise(t + 0.08, 0.08, { peak: 0.045, filterType: "bandpass", filterFrequency: 620, q: 1.4 });
          break;
        case "objective-secured":
          blip(t, [392, 523, 659, 784], { peak: 0.055, duration: 0.16, gap: 0.065, filterFrequency: 3000 });
          tone(t, 98, 0.38, { waveform: "sine", peak: 0.07, attack: 0.02, decay: 0.08, sustain: 0.025, release: 0.24, filterFrequency: 400 });
          break;
        case "vip-harmed":
          blip(t, [220, 185, 147], { peak: 0.07, duration: 0.16, gap: 0.09, waveform: "sawtooth", filterFrequency: 900 });
          break;
        case "mission-success":
          blip(t, [330, 392, 523, 659, 784], { peak: 0.06, duration: 0.18, gap: 0.07, filterFrequency: 3400 });
          break;
        case "mission-failed":
          blip(t, [330, 277, 220, 165], { peak: 0.065, duration: 0.2, gap: 0.08, waveform: "sawtooth", filterFrequency: 1000 });
          noise(t + 0.1, 0.32, { peak: 0.05, filterType: "lowpass", filterFrequency: 420, filterEnd: 120 });
          break;
        default:
          blip(t, [440], { peak: 0.035, duration: 0.08 });
          break;
      }
    }

    function startLoop(id, options = {}) {
      if (!audioContext || !outputNode || !LOOP_IDS.has(id) || loops.has(id)) return;
      const intervalSeconds = id === "enemy-walk" ? 0.22 : 0.18;
      const gainScale = clamp(options.volume ?? 0.34, 0, 1);
      const loop = {
        id,
        timer: null,
        stopped: false
      };
      function step() {
        if (loop.stopped) return;
        const t = now() + 0.004;
        noise(t, 0.055, {
          peak: (id === "enemy-walk" ? 0.045 : 0.038) * gainScale,
          filterType: "bandpass",
          filterFrequency: id === "enemy-walk" ? 420 : 520,
          q: 1.5
        });
        tone(t, id === "enemy-walk" ? 72 : 96, 0.07, {
          waveform: "sine",
          peak: 0.03 * gainScale,
          attack: 0.004,
          decay: 0.02,
          sustain: 0.004,
          release: 0.035,
          filterFrequency: 220
        });
      }
      step();
      loop.timer = window.setInterval(step, intervalSeconds * 1000);
      loops.set(id, loop);
    }

    function stopLoop(id) {
      const loop = loops.get(id);
      if (!loop) return;
      loop.stopped = true;
      if (loop.timer) window.clearInterval(loop.timer);
      loops.delete(id);
    }

    function stopAllLoops() {
      for (const id of Array.from(loops.keys())) stopLoop(id);
    }

    return {
      has,
      play,
      startLoop,
      stopLoop,
      stopAllLoops,
      ids: () => [...SOUND_IDS]
    };
  }

  window.ProceduralEffects = { create, ids: () => [...SOUND_IDS] };
}());
