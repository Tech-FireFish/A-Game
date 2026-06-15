"use strict";

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, "..", "sounds");

const SOUNDS = [
  { name: "operator-down.wav", duration: 0.9, layers: [{ f: 84, type: "saw", gain: 0.48, a: 0.01, r: 0.86, bend: -18 }, { f: 196, type: "sine", gain: 0.18, a: 0.02, r: 0.72, bend: -60 }], noise: { gain: 0.1, decay: 0.55 } },
  { name: "reload-complete.wav", duration: 0.36, layers: [{ f: 980, type: "square", gain: 0.22, a: 0.002, r: 0.13 }, { f: 1760, type: "sine", gain: 0.18, a: 0.02, r: 0.2, delay: 0.12 }], clicks: [{ t: 0.04, gain: 0.38 }, { t: 0.18, gain: 0.32 }] },
  { name: "enemy-suspicious.wav", duration: 0.58, layers: [{ f: 240, type: "triangle", gain: 0.24, a: 0.01, r: 0.5, bend: 80 }, { f: 370, type: "sine", gain: 0.16, a: 0.06, r: 0.44, bend: 110 }], noise: { gain: 0.035, decay: 0.35 } },
  { name: "paper-pickup.wav", duration: 0.42, layers: [{ f: 1220, type: "sine", gain: 0.16, a: 0.005, r: 0.25 }, { f: 1640, type: "triangle", gain: 0.12, a: 0.05, r: 0.24, delay: 0.08 }], noise: { gain: 0.07, decay: 0.18 } },
  { name: "gear-equip.wav", duration: 0.52, layers: [{ f: 330, type: "square", gain: 0.22, a: 0.002, r: 0.18 }, { f: 660, type: "triangle", gain: 0.18, a: 0.04, r: 0.35, delay: 0.1 }], clicks: [{ t: 0.02, gain: 0.42 }, { t: 0.26, gain: 0.36 }] },
  { name: "inventory-open.wav", duration: 0.38, layers: [{ f: 520, type: "triangle", gain: 0.2, a: 0.01, r: 0.32, bend: 160 }, { f: 1040, type: "sine", gain: 0.1, a: 0.05, r: 0.25 }] },
  { name: "inventory-close.wav", duration: 0.32, layers: [{ f: 640, type: "triangle", gain: 0.18, a: 0.005, r: 0.28, bend: -180 }, { f: 320, type: "sine", gain: 0.12, a: 0.02, r: 0.22 }] },
  { name: "digital-lock-correct.wav", duration: 0.64, layers: [{ f: 660, type: "sine", gain: 0.16, a: 0.01, r: 0.24 }, { f: 990, type: "sine", gain: 0.16, a: 0.04, r: 0.3, delay: 0.13 }, { f: 1320, type: "sine", gain: 0.14, a: 0.05, r: 0.36, delay: 0.28 }] },
  { name: "digital-lock-keypad-press.wav", duration: 0.16, layers: [{ f: 880, type: "square", gain: 0.16, a: 0.001, r: 0.08 }, { f: 1320, type: "sine", gain: 0.08, a: 0.002, r: 0.08 }] },
  { name: "door-close.wav", duration: 0.5, layers: [{ f: 120, type: "triangle", gain: 0.34, a: 0.002, r: 0.36, bend: -30 }], noise: { gain: 0.18, decay: 0.18 }, clicks: [{ t: 0.2, gain: 0.58 }] },
  { name: "window-open.wav", duration: 0.55, layers: [{ f: 420, type: "triangle", gain: 0.14, a: 0.02, r: 0.35, bend: 80 }, { f: 980, type: "sine", gain: 0.08, a: 0.08, r: 0.28 }], noise: { gain: 0.09, decay: 0.4 } },
  { name: "window-vault.wav", duration: 0.58, layers: [{ f: 180, type: "triangle", gain: 0.18, a: 0.01, r: 0.45, bend: -50 }], noise: { gain: 0.2, decay: 0.35 }, clicks: [{ t: 0.14, gain: 0.24 }, { t: 0.35, gain: 0.18 }] },
  { name: "glass-step-damage.wav", duration: 0.54, layers: [{ f: 2100, type: "sine", gain: 0.11, a: 0.002, r: 0.18 }, { f: 3100, type: "triangle", gain: 0.08, a: 0.01, r: 0.16, delay: 0.06 }], noise: { gain: 0.28, decay: 0.22 }, clicks: [{ t: 0.04, gain: 0.34 }, { t: 0.12, gain: 0.26 }] },
  { name: "stairs-use.wav", duration: 0.56, layers: [{ f: 260, type: "triangle", gain: 0.16, a: 0.01, r: 0.2 }, { f: 220, type: "triangle", gain: 0.13, a: 0.01, r: 0.2, delay: 0.17 }, { f: 190, type: "triangle", gain: 0.1, a: 0.01, r: 0.2, delay: 0.34 }], clicks: [{ t: 0.08, gain: 0.16 }, { t: 0.25, gain: 0.14 }, { t: 0.42, gain: 0.12 }] },
  { name: "laptop-open.wav", duration: 0.48, layers: [{ f: 540, type: "square", gain: 0.14, a: 0.006, r: 0.22 }, { f: 1080, type: "sine", gain: 0.12, a: 0.06, r: 0.26, delay: 0.12 }], clicks: [{ t: 0.03, gain: 0.22 }] },
  { name: "hack-start.wav", duration: 0.78, layers: [{ f: 280, type: "saw", gain: 0.13, a: 0.02, r: 0.62, bend: 260 }, { f: 1120, type: "sine", gain: 0.12, a: 0.12, r: 0.44, bend: 380 }], noise: { gain: 0.035, decay: 0.75 } },
  { name: "camera-select.wav", duration: 0.34, layers: [{ f: 740, type: "square", gain: 0.14, a: 0.002, r: 0.12 }, { f: 1480, type: "sine", gain: 0.1, a: 0.02, r: 0.18, delay: 0.08 }] },
  { name: "objective-secured.wav", duration: 0.82, layers: [{ f: 440, type: "sine", gain: 0.15, a: 0.02, r: 0.38 }, { f: 660, type: "sine", gain: 0.15, a: 0.06, r: 0.42, delay: 0.14 }, { f: 880, type: "sine", gain: 0.12, a: 0.08, r: 0.46, delay: 0.3 }] },
  { name: "vip-harmed.wav", duration: 0.75, layers: [{ f: 180, type: "saw", gain: 0.26, a: 0.006, r: 0.62, bend: -70 }, { f: 92, type: "sine", gain: 0.22, a: 0.01, r: 0.7 }], noise: { gain: 0.06, decay: 0.55 } },
  { name: "low-health-warning.wav", duration: 0.62, layers: [{ f: 760, type: "square", gain: 0.14, a: 0.002, r: 0.1 }, { f: 760, type: "square", gain: 0.12, a: 0.002, r: 0.1, delay: 0.24 }] },
  { name: "no-ammo-warning.wav", duration: 0.48, layers: [{ f: 190, type: "square", gain: 0.2, a: 0.002, r: 0.12 }, { f: 160, type: "square", gain: 0.16, a: 0.002, r: 0.12, delay: 0.18 }], clicks: [{ t: 0.03, gain: 0.34 }] }
];

function oscillator(type, phase) {
  if (type === "square") return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (type === "saw") return 2 * (phase / (Math.PI * 2) - Math.floor(0.5 + phase / (Math.PI * 2)));
  return Math.sin(phase);
}

function envelope(t, duration, attack, release, delay = 0) {
  if (t < delay) return 0;
  const local = t - delay;
  const active = Math.max(0.001, duration - delay);
  if (local > active) return 0;
  const a = Math.max(0.001, attack);
  const r = Math.max(0.001, release);
  return Math.min(1, local / a, (active - local) / r);
}

function seededNoise(seed) {
  let x = seed || 1234567;
  return () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967295) * 2 - 1;
  };
}

function renderSound(spec) {
  const total = Math.ceil(spec.duration * SAMPLE_RATE);
  const data = new Float32Array(total);
  const noise = seededNoise(hashName(spec.name));

  for (let i = 0; i < total; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (const layer of spec.layers || []) {
      const env = envelope(t, spec.duration, layer.a || 0.01, layer.r || 0.2, layer.delay || 0);
      if (env <= 0) continue;
      const local = Math.max(0, t - (layer.delay || 0));
      const freq = Math.max(20, layer.f + (layer.bend || 0) * (local / Math.max(0.001, spec.duration)));
      sample += oscillator(layer.type || "sine", Math.PI * 2 * freq * local) * env * (layer.gain || 0.1);
    }
    if (spec.noise) {
      const env = Math.exp(-t / Math.max(0.001, spec.noise.decay || 0.2));
      sample += noise() * env * (spec.noise.gain || 0.05);
    }
    for (const click of spec.clicks || []) {
      const d = Math.abs(t - click.t);
      if (d < 0.012) sample += noise() * (1 - d / 0.012) * (click.gain || 0.2);
    }
    data[i] = Math.tanh(sample * 1.2) * 0.82;
  }
  return data;
}

function hashName(name) {
  let hash = 2166136261;
  for (const ch of name) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function writeWav(filePath, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const spec of SOUNDS) {
  const filePath = path.join(OUT_DIR, spec.name);
  writeWav(filePath, renderSound(spec));
  console.log(`wrote ${path.relative(process.cwd(), filePath)}`);
}
