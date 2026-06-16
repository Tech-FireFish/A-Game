const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "docs", "gifs");
const WIDTH = 800;
const HEIGHT = 450;
const FPS_DELAY = 8; // GIF delay is in hundredths of a second, roughly 12 FPS.
const FRAMES = 96;
const LZW_MIN_CODE_SIZE = 5;

const COLORS = [
  [5, 7, 8], // 0 black
  [13, 22, 24], // 1 panel
  [124, 247, 167], // 2 green
  [244, 199, 102], // 3 amber
  [111, 216, 255], // 4 cyan
  [255, 90, 90], // 5 red
  [235, 242, 239], // 6 white
  [97, 117, 122], // 7 gray
  [38, 83, 90], // 8 teal wall
  [25, 68, 48], // 9 dark green
  [160, 112, 255], // 10 purple
  [255, 239, 138], // 11 yellow
  [139, 107, 70], // 12 door
  [18, 21, 24], // 13 floor
  [161, 230, 255], // 14 glass
  [145, 245, 208], // 15 route
  [7, 16, 16], // 16 deep
  [255, 147, 92], // 17 orange
  [168, 255, 189], // 18 owned
  [44, 50, 56], // 19 card fill
  [210, 75, 190], // 20 magenta
  [75, 120, 210], // 21 blue
];
while (COLORS.length < 256) COLORS.push([0, 0, 0]);

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};

function createFrame(fill = 0) {
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  pixels.fill(fill);
  return pixels;
}

function rect(pixels, x, y, w, h, color) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.floor(w);
  h = Math.floor(h);
  const x2 = Math.min(WIDTH, x + w);
  const y2 = Math.min(HEIGHT, y + h);
  for (let yy = y; yy < y2; yy++) {
    const row = yy * WIDTH;
    for (let xx = x; xx < x2; xx++) pixels[row + xx] = color;
  }
}

function outline(pixels, x, y, w, h, color, thickness = 2) {
  rect(pixels, x, y, w, thickness, color);
  rect(pixels, x, y + h - thickness, w, thickness, color);
  rect(pixels, x, y, thickness, h, color);
  rect(pixels, x + w - thickness, y, thickness, h, color);
}

function line(pixels, x0, y0, x1, y1, color, thickness = 1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    rect(pixels, x0 + dx * t - thickness / 2, y0 + dy * t - thickness / 2, thickness, thickness, color);
  }
}

function circle(pixels, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    if (y < 0 || y >= HEIGHT) continue;
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (x < 0 || x >= WIDTH) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) pixels[y * WIDTH + x] = color;
    }
  }
}

function drawText(pixels, text, x, y, color = 6, scale = 2) {
  let cursor = x;
  const upper = String(text).toUpperCase();
  for (const ch of upper) {
    const glyph = FONT[ch] || FONT["?"];
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === "1") rect(pixels, cursor + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function panel(pixels, x, y, w, h, accent = 4) {
  rect(pixels, x, y, w, h, 1);
  rect(pixels, x + 4, y + 4, w - 8, h - 8, 19);
  outline(pixels, x, y, w, h, accent, 2);
}

function geometryBackground(pixels, frame) {
  rect(pixels, 0, 0, WIDTH, HEIGHT, 0);
  for (let y = 0; y < HEIGHT; y += 36) line(pixels, 0, y, WIDTH, y + 12, 16, 1);
  for (let x = -120; x < WIDTH; x += 150) {
    const offset = (frame * 2 + x) % 80;
    outline(pixels, x + offset, 48 + ((x * 7) % 280), 105, 68, x % 2 ? 9 : 8, 2);
  }
  line(pixels, 50, 400, 760, 40, 8, 2);
  line(pixels, 140, 420, 790, 160, 9, 2);
}

function room(pixels, x, y, w, h) {
  rect(pixels, x, y, w, h, 13);
  outline(pixels, x, y, w, h, 8, 7);
}

function door(pixels, x, y, open = false) {
  if (open) line(pixels, x, y, x + 32, y - 28, 12, 5);
  else rect(pixels, x, y - 6, 48, 12, 12);
}

function windowSprite(pixels, x, y, broken = false) {
  rect(pixels, x, y, 48, 9, broken ? 7 : 14);
  if (broken) {
    line(pixels, x + 4, y - 6, x + 18, y + 12, 4, 1);
    line(pixels, x + 26, y + 12, x + 44, y - 5, 4, 1);
  }
}

function route(pixels, points) {
  for (let i = 0; i < points.length - 1; i++) line(pixels, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 15, 3);
  for (const [x, y] of points) circle(pixels, x, y, 6, 2);
}

function drawWeaponIcon(pixels, x, y, type, color = 4, scale = 4) {
  if (type === "rifle") {
    rect(pixels, x, y + 20, 52, 8, color);
    rect(pixels, x + 8, y + 12, 22, 10, color);
    rect(pixels, x + 42, y + 16, 26, 4, color);
    rect(pixels, x + 2, y + 28, 12, 10, 12);
    rect(pixels, x + 28, y + 28, 8, 18, 7);
  } else if (type === "smg") {
    rect(pixels, x, y + 20, 38, 10, color);
    rect(pixels, x + 34, y + 22, 20, 5, color);
    rect(pixels, x + 16, y + 30, 8, 20, 7);
    rect(pixels, x + 3, y + 30, 12, 9, 12);
  } else if (type === "pistol") {
    rect(pixels, x + 8, y + 18, 34, 10, color);
    rect(pixels, x + 38, y + 21, 16, 4, color);
    rect(pixels, x + 16, y + 28, 10, 22, 12);
  } else if (type === "armor") {
    rect(pixels, x + 14, y + 6, 34, 48, color);
    rect(pixels, x + 5, y + 16, 14, 24, color);
    rect(pixels, x + 43, y + 16, 14, 24, color);
    rect(pixels, x + 22, y + 16, 18, 8, 7);
  } else if (type === "backpack") {
    rect(pixels, x + 14, y + 8, 36, 48, color);
    rect(pixels, x + 20, y + 14, 24, 10, 7);
    rect(pixels, x + 10, y + 18, 8, 30, 12);
    rect(pixels, x + 46, y + 18, 8, 30, 12);
  } else if (type === "melee") {
    rect(pixels, x + 10, y + 36, 12, 20, 12);
    line(pixels, x + 16, y + 36, x + 52, y + 4, color, 8);
  } else {
    outline(pixels, x + 10, y + 10, 42, 42, 7, 3);
    line(pixels, x + 12, y + 12, x + 50, y + 50, 5, 4);
  }
  if (scale === 0) return;
}

function drawMenuButtons(pixels, x, y, labels, activeIndex = -1) {
  labels.forEach((label, index) => {
    const yy = y + index * 48;
    if (index === activeIndex) outline(pixels, x - 10, yy - 8, 190, 34, 2, 2);
    drawText(pixels, label, x, yy, index === activeIndex ? 2 : 6, 2);
  });
}

function renderStartStoreMain(progress, frame) {
  const p = createFrame();
  geometryBackground(p, frame);
  if (progress < 0.25) {
    drawText(p, "DELTA", 520, 80, 2, 5);
    drawText(p, "GEOMETRY", 455, 125, 4, 5);
    drawMenuButtons(p, 520, 215, ["START", "SETTING", "INFO", "EXIT"], progress > 0.14 ? 0 : -1);
    circle(p, 500 + progress * 240, 235, 8, 11);
  } else if (progress < 0.68) {
    panel(p, 50, 34, 220, 96, 2);
    circle(p, 92, 82, 28, 2);
    drawText(p, "OPERATOR#1", 132, 58, 6, 2);
    drawText(p, "SCORE 5000", 132, 88, 3, 2);
    drawText(p, "STORE", 342, 30, 4, 4);
    const items = [
      ["RIFLE", "rifle", 2], ["SMG", "smg", 4], ["PISTOL", "pistol", 3], ["MELEE", "melee", 11],
      ["LIGHT", "armor", 2], ["MEDIUM", "armor", 3], ["HEAVY", "armor", 20], ["PACK", "backpack", 4],
    ];
    const selected = progress > 0.42 ? 1 : 0;
    items.forEach((it, i) => {
      const x = 82 + (i % 4) * 170;
      const y = 160 + Math.floor(i / 4) * 112;
      panel(p, x, y, 134, 86, i === selected ? 2 : 7);
      drawWeaponIcon(p, x + 12, y + 10, it[1], it[2]);
      drawText(p, it[0], x + 72, y + 18, 6, 1);
      drawText(p, i === selected && progress > 0.52 ? "OWNED" : "$750", x + 72, y + 48, i === selected ? 18 : 3, 1);
    });
    drawText(p, "EXIT TO MENU", 180, 398, 6, 2);
    drawText(p, "PLAY", 525, 398, 2, 2);
  } else {
    drawText(p, "MAIN PAGE", 264, 34, 2, 4);
    panel(p, 68, 105, 660, 82, 4);
    drawText(p, "QUICK SETUP", 100, 132, 6, 2);
    drawText(p, "NORMAL", 430, 132, 2, 2);
    drawText(p, "MANUAL", 560, 132, 3, 2);
    drawText(p, "STORY LEVELS", 85, 222, 4, 3);
    drawText(p, "TUTORIALS", 440, 222, 3, 3);
    for (let i = 0; i < 6; i++) {
      const x = 90 + (i % 3) * 76;
      const y = 270 + Math.floor(i / 3) * 56;
      panel(p, x, y, 50, 38, i === 0 ? 2 : 7);
      drawText(p, String(i + 1), x + 18, y + 10, 6, 2);
    }
    for (let i = 0; i < 6; i++) {
      const x = 456 + (i % 3) * 76;
      const y = 270 + Math.floor(i / 3) * 56;
      panel(p, x, y, 50, 38, i === 0 ? 3 : 7);
      drawText(p, String(i + 1), x + 18, y + 10, 6, 2);
    }
  }
  return p;
}

function renderTactical(progress) {
  const p = createFrame(0);
  rect(p, 18, 18, 764, 414, 16);
  room(p, 115, 82, 250, 240);
  room(p, 365, 82, 285, 240);
  door(p, 350, 204, progress > 0.38);
  windowSprite(p, 245, 78, progress > 0.68);
  drawText(p, "RIDGE HOUSE ENTRY", 110, 34, 4, 2);
  const opPath = [[88, 338], [162, 260], [248, 240], [345, 226], [466, 216], [595, 240]];
  const t = Math.min(1, progress * 1.25);
  const segment = Math.min(opPath.length - 2, Math.floor(t * (opPath.length - 1)));
  const local = t * (opPath.length - 1) - segment;
  const [x0, y0] = opPath[segment];
  const [x1, y1] = opPath[segment + 1];
  const ox = x0 + (x1 - x0) * local;
  const oy = y0 + (y1 - y0) * local;
  route(p, opPath.slice(0, segment + 2));
  const enemyAlive = progress < 0.73;
  if (enemyAlive) {
    circle(p, 520, 190, 18, 5);
    drawText(p, "E", 514, 181, 6, 1);
  } else {
    line(p, 505, 176, 535, 204, 5, 4);
    line(p, 535, 176, 505, 204, 5, 4);
  }
  if (progress > 0.55 && progress < 0.75) line(p, ox, oy, 520, 190, 11, 4);
  circle(p, ox, oy, 20, 2);
  drawText(p, "A", ox - 5, oy - 8, 0, 1);
  circle(p, 614, 252, 22, 11);
  drawText(p, "VIP", 602, 245, 0, 1);
  panel(p, 54, 365, 690, 45, 2);
  drawText(p, progress < 0.4 ? "PLAN ROUTE  OPEN DOOR" : progress < 0.75 ? "CONTACT  CONTROLLED FIRE" : "OBJECTIVE SECURED", 78, 381, 6, 2);
  return p;
}

function renderDigitalLock(progress) {
  const p = createFrame(0);
  room(p, 86, 70, 300, 270);
  room(p, 386, 70, 250, 270);
  rect(p, 372, 195, 28, 80, progress > 0.7 ? 2 : 5);
  drawText(p, progress > 0.7 ? "OPEN" : "LOCK", 354, 285, progress > 0.7 ? 2 : 5, 1);
  const ox = 130 + Math.min(progress * 2, 1) * 150;
  const oy = 290 - Math.min(progress * 2, 1) * 90;
  rect(p, 258, 180, 28, 34, 6);
  drawText(p, "PAPER", 228, 150, 3, 1);
  circle(p, ox, oy, 18, 2);
  drawText(p, "TUTORIAL DIGITAL LOCK", 84, 34, 4, 2);
  if (progress > 0.25) {
    panel(p, 72, 355, 265, 62, 3);
    drawText(p, "INVENTORY", 94, 372, 6, 2);
    drawText(p, "CODE 4729", 94, 394, 2, 2);
  }
  if (progress > 0.45) {
    panel(p, 496, 108, 180, 236, 4);
    drawText(p, "KEYPAD", 532, 130, 6, 2);
    for (let i = 0; i < 9; i++) {
      const x = 526 + (i % 3) * 42;
      const y = 170 + Math.floor(i / 3) * 38;
      panel(p, x, y, 32, 28, progress > 0.48 + i * 0.02 ? 2 : 7);
      drawText(p, String(i + 1), x + 11, y + 8, 6, 1);
    }
    drawText(p, progress > 0.68 ? "UNLOCKED" : "4729", 530, 296, progress > 0.68 ? 2 : 3, 2);
  }
  return p;
}

function renderAdvanced(progress) {
  const p = createFrame(0);
  rect(p, 0, 0, WIDTH, HEIGHT, 16);
  room(p, 90, 82, 240, 130);
  room(p, 330, 82, 250, 130);
  room(p, 90, 212, 490, 120);
  if (progress < 0.45) {
    rect(p, 112, 104, 444, 206, 0);
    outline(p, 90, 82, 490, 250, 8, 7);
  }
  rect(p, 76, 355, 54, 38, 4);
  drawText(p, "LAPTOP", 52, 402, 6, 1);
  circle(p, 150, 376, 18, 2);
  if (progress > 0.2) {
    panel(p, 218, 340, 360, 70, 4);
    drawText(p, progress < 0.45 ? "START HACKING" : "CAMERA ZONES REVEALED", 242, 366, progress < 0.45 ? 3 : 2, 2);
  }
  if (progress > 0.45) {
    outline(p, 115, 103, 185, 90, 2, 3);
    outline(p, 355, 105, 180, 90, 4, 3);
    drawText(p, "C1", 170, 136, 2, 3);
    drawText(p, "C2", 414, 136, 4, 3);
    rect(p, 244, 224, 80, 18, 14);
    drawText(p, "WINDOW", 238, 250, 6, 1);
    rect(p, 395, 252, 46, 46, 3);
    drawText(p, "STAIRS", 380, 306, 6, 1);
    circle(p, 500, 270, 22, 11);
    drawText(p, "VIP", 488, 263, 0, 1);
  }
  drawText(p, "ADVANCED INTERACTIONS", 92, 34, 4, 2);
  return p;
}

function encodeGif(frames) {
  const bytes = [];
  const writeByte = (value) => bytes.push(value & 255);
  const writeBytes = (values) => values.forEach(writeByte);
  const writeString = (value) => writeBytes([...Buffer.from(value, "ascii")]);
  const writeShort = (value) => {
    writeByte(value);
    writeByte(value >> 8);
  };

  writeString("GIF89a");
  writeShort(WIDTH);
  writeShort(HEIGHT);
  writeByte(0xf7);
  writeByte(0);
  writeByte(0);
  for (const [r, g, b] of COLORS) writeBytes([r, g, b]);
  writeBytes([0x21, 0xff, 0x0b]);
  writeString("NETSCAPE2.0");
  writeBytes([0x03, 0x01]);
  writeShort(0);
  writeByte(0);

  for (const pixels of frames) {
    writeBytes([0x21, 0xf9, 0x04, 0x08]);
    writeShort(FPS_DELAY);
    writeBytes([0, 0]);
    writeByte(0x2c);
    writeShort(0);
    writeShort(0);
    writeShort(WIDTH);
    writeShort(HEIGHT);
    writeByte(0);
    writeByte(LZW_MIN_CODE_SIZE);
    const lzw = lzwEncode(pixels, LZW_MIN_CODE_SIZE);
    for (let i = 0; i < lzw.length; i += 255) {
      const chunk = lzw.slice(i, i + 255);
      writeByte(chunk.length);
      writeBytes(chunk);
    }
    writeByte(0);
  }
  writeByte(0x3b);
  return Buffer.from(bytes);
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dict = baseDictionary(clearCode);
  const out = [];
  let bitBuffer = 0;
  let bitCount = 0;

  function emit(code) {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 255);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
    if (nextCode > (1 << codeSize) - 1 && codeSize < 12) codeSize++;
  }

  function reset() {
    dict = baseDictionary(clearCode);
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  }

  emit(clearCode);
  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const combo = `${prefix},${k}`;
    if (dict.has(combo)) {
      prefix = combo;
      continue;
    }
    emit(dict.get(prefix));
    if (nextCode < 4096) {
      dict.set(combo, nextCode++);
    } else {
      emit(clearCode);
      reset();
    }
    prefix = String(k);
  }
  emit(dict.get(prefix));
  emit(endCode);
  if (bitCount > 0) out.push(bitBuffer & 255);
  return out;
}

function baseDictionary(size) {
  const dict = new Map();
  for (let i = 0; i < size; i++) dict.set(String(i), i);
  return dict;
}

function generate(name, render) {
  const frames = [];
  for (let i = 0; i < FRAMES; i++) frames.push(render(i / (FRAMES - 1), i));
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodeGif(frames));
  const sizeKb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${name} ${sizeKb}KB`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
generate("01-start-store-main.gif", renderStartStoreMain);
generate("02-tactical-breach-combat.gif", renderTactical);
generate("03-digital-lock-tutorial.gif", renderDigitalLock);
generate("04-advanced-interactions.gif", renderAdvanced);
