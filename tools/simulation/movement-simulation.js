"use strict";

(function () {
  const PREVIEW_STORAGE_KEY = "delta-geometry-editor-preview";
  const PREVIEW_STORAGE_FALLBACK_KEY = "delta-geometry-editor-preview-transfer";
  const GRID = 40;
  const UNIT_RADIUS = 12;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2;
  const ZOOM_FACTOR = 1.25;

  const canvas = document.getElementById("simulationCanvas");
  const ctx = canvas.getContext("2d");
  const levelTitle = document.getElementById("levelTitle");
  const statusLine = document.getElementById("statusLine");
  const zoomOutButton = document.getElementById("zoomOutButton");
  const zoomInButton = document.getElementById("zoomInButton");
  const zoomValue = document.getElementById("zoomValue");

  const keys = new Set();
  const state = {
    level: null,
    tester: null,
    camera: { x: 0, y: 0, zoom: 1 },
    last: 0,
    message: "",
    missingOperator: false,
    loaded: false
  };

  zoomOutButton.addEventListener("click", () => setZoom(state.camera.zoom / ZOOM_FACTOR));
  zoomInButton.addEventListener("click", () => setZoom(state.camera.zoom * ZOOM_FACTOR));
  canvas.addEventListener("click", handleCanvasClick);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("message", handlePreviewMessage);

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "control", "shift"].includes(key)) {
      event.preventDefault();
    }
    if (key === "escape") {
      window.close();
      setMessage("Preview can be closed with the browser tab if the window stays open.");
      return;
    }
    if (key === "e") {
      event.preventDefault();
      toggleNearestDoor();
      return;
    }
    keys.add(key);
  }

  function loadPreview() {
    let raw = "";
    try {
      raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY) || "";
      if (!raw) {
        raw = localStorage.getItem(PREVIEW_STORAGE_FALLBACK_KEY) || "";
      }
      if (raw) localStorage.removeItem(PREVIEW_STORAGE_FALLBACK_KEY);
    } catch (error) {
      showLoadFailure("Preview storage is unavailable.");
      return;
    }
    if (!raw) {
      waitForPreviewMessage();
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      showLoadFailure("Preview data is invalid. Return to Map Editor and press Start Preview again.");
      return;
    }
    loadPayload(payload);
  }

  function handlePreviewMessage(event) {
    if (window.location.protocol !== "file:" && event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.type !== "delta-geometry-editor-preview") return;
    loadPayload(message.payload);
  }

  function waitForPreviewMessage() {
    setMessage("Waiting for Map Editor preview data...");
    window.setTimeout(() => {
      if (!state.loaded) showLoadFailure("Preview data unavailable. Return to Map Editor and press Start Preview again.");
    }, 2600);
  }

  function loadPayload(payload) {
    if (!payload || payload.source !== "scene-editor" || !payload.level) {
      showLoadFailure("Preview data unavailable. Return to Map Editor and press Start Preview again.");
      return;
    }
    state.level = normalizeLevel(payload.level);
    state.tester = createTester(state.level);
    state.loaded = true;
    levelTitle.textContent = `${state.level.title || "Custom Level"} Movement Preview`;
    setMessage(state.missingOperator ? "No operator found; spawned a temporary tester at 80, 80." : "Movement preview ready. Walls and closed doors block movement.");
    resizeCanvas();
    requestAnimationFrame(loop);
  }

  function normalizeLevel(raw) {
    return {
      id: raw.id || "editor-preview",
      title: raw.title || "Custom Level",
      width: Number(raw.width) || 1200,
      height: Number(raw.height) || 760,
      floorZones: cloneList(raw.floorZones),
      rooms: cloneList(raw.rooms),
      walls: cloneList(raw.walls),
      doors: cloneList(raw.doors).map((door) => ({ ...door, state: door.state || "closed" })),
      windows: cloneList(raw.windows),
      labels: cloneList(raw.labels),
      stairs: cloneList(raw.stairs),
      equipmentTables: cloneList(raw.equipmentTables),
      items: cloneList(raw.items),
      operators: cloneList(raw.operators),
      enemies: cloneList(raw.enemies),
      objective: raw.objective ? { ...raw.objective } : { x: 980, y: 620, radius: 16 }
    };
  }

  function cloneList(value) {
    return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
  }

  function createTester(level) {
    const op = level.operators[0];
    if (!op) {
      state.missingOperator = true;
      return { x: 80, y: 80, radius: UNIT_RADIUS, speed: 120 };
    }
    state.missingOperator = false;
    return {
      x: Number(op.x) || 80,
      y: Number(op.y) || 80,
      radius: UNIT_RADIUS,
      speed: Number(op.speed) || 120
    };
  }

  function showLoadFailure(message) {
    state.loaded = false;
    levelTitle.textContent = "Preview Load Failed";
    setMessage(message);
    resizeCanvas();
    draw();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(220, Math.floor(rect.height * dpr));
    draw();
  }

  function loop(now) {
    if (!state.loaded) return;
    const dt = Math.min(0.05, (now - (state.last || now)) / 1000);
    state.last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    const move = movementVector();
    if (move.x || move.y) {
      const speed = keys.has("shift") ? 190 : (keys.has("control") ? 65 : state.tester.speed);
      const nextX = { ...state.tester, x: state.tester.x + move.x * speed * dt };
      if (!collidesWithMap(nextX)) state.tester.x = clamp(nextX.x, state.tester.radius, state.level.width - state.tester.radius);
      const nextY = { ...state.tester, y: state.tester.y + move.y * speed * dt };
      if (!collidesWithMap(nextY)) state.tester.y = clamp(nextY.y, state.tester.radius, state.level.height - state.tester.radius);
    }
    followTester();
  }

  function movementVector() {
    let x = 0;
    let y = 0;
    if (keys.has("a") || keys.has("arrowleft")) x -= 1;
    if (keys.has("d") || keys.has("arrowright")) x += 1;
    if (keys.has("w") || keys.has("arrowup")) y -= 1;
    if (keys.has("s") || keys.has("arrowdown")) y += 1;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function followTester() {
    const viewW = canvas.width / state.camera.zoom;
    const viewH = canvas.height / state.camera.zoom;
    state.camera.x = clamp(state.tester.x - viewW / 2, 0, Math.max(0, state.level.width - viewW));
    state.camera.y = clamp(state.tester.y - viewH / 2, 0, Math.max(0, state.level.height - viewH));
  }

  function setZoom(value) {
    state.camera.zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    updateZoomLabel();
    if (state.loaded) followTester();
    draw();
  }

  function updateZoomLabel() {
    zoomValue.textContent = `${Math.round(state.camera.zoom * 100)}%`;
  }

  function handleCanvasClick(event) {
    if (!state.loaded) return;
    const point = screenToWorld(event);
    const door = state.level.doors.find((item) => pointInRect(point, inflateRect(item, 8)));
    if (!door) return;
    if (pointRectDistance(state.tester, door) > 64) {
      setMessage("Move closer to the door.");
      return;
    }
    toggleDoor(door);
  }

  function toggleNearestDoor() {
    if (!state.loaded) return;
    let best = null;
    let bestDistance = Infinity;
    for (const door of state.level.doors) {
      const distance = pointRectDistance(state.tester, door);
      if (distance < bestDistance) {
        best = door;
        bestDistance = distance;
      }
    }
    if (!best || bestDistance > 64) {
      setMessage("No door in range.");
      return;
    }
    toggleDoor(best);
  }

  function toggleDoor(door) {
    door.state = door.state === "open" ? "closed" : "open";
    setMessage(`${door.id || "Door"} ${door.state}.`);
  }

  function collidesWithMap(circle) {
    if (circle.x - circle.radius < 0 || circle.y - circle.radius < 0 || circle.x + circle.radius > state.level.width || circle.y + circle.radius > state.level.height) {
      return true;
    }
    return blockers().some((rect) => circleRectCollides(circle, rect));
  }

  function blockers() {
    return [
      ...state.level.walls,
      ...state.level.doors.filter((door) => door.state !== "open")
    ];
  }

  function screenToWorld(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: state.camera.x + x / state.camera.zoom,
      y: state.camera.y + y / state.camera.zoom
    };
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!state.level) return;
    ctx.setTransform(state.camera.zoom, 0, 0, state.camera.zoom, -state.camera.x * state.camera.zoom, -state.camera.y * state.camera.zoom);
    ctx.fillStyle = "#15191b";
    ctx.fillRect(0, 0, state.level.width, state.level.height);
    drawGrid();
    ctx.strokeStyle = "#596369";
    ctx.lineWidth = 3 / state.camera.zoom;
    ctx.strokeRect(0, 0, state.level.width, state.level.height);
    drawRects(state.level.floorZones, "rgba(96, 198, 137, 0.08)", "");
    drawRects(state.level.rooms, "rgba(114, 183, 206, 0.08)", "room");
    drawRects(state.level.walls, "#596369", "");
    drawRects(state.level.doors, null, "");
    drawRects(state.level.windows, "#72b7ce", "");
    drawRects(state.level.stairs, "#8ec6c0", "");
    drawRects(state.level.equipmentTables, "#6b6f75", "");
    drawRects(state.level.items, "#f5e6a6", "");
    drawLabels();
    drawUnits();
    if (state.loaded) drawTester();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1 / state.camera.zoom;
    for (let x = 0; x <= state.level.width; x += GRID) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.level.height);
      ctx.stroke();
    }
    for (let y = 0; y <= state.level.height; y += GRID) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.level.width, y);
      ctx.stroke();
    }
  }

  function drawRects(list, fill, labelMode) {
    for (const object of list || []) {
      const fillStyle = fill || (object.state === "open" ? "#60c689" : "#e3b456");
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1 / state.camera.zoom;
      ctx.fillRect(object.x, object.y, object.w || 20, object.h || 20);
      ctx.strokeRect(object.x, object.y, object.w || 20, object.h || 20);
      if (labelMode === "room" && object.name) {
        ctx.fillStyle = "#eef3ef";
        ctx.font = `${Math.max(9, 12 / state.camera.zoom)}px monospace`;
        ctx.fillText(object.name, object.x + 6, object.y + 16);
      }
    }
  }

  function drawLabels() {
    ctx.fillStyle = "#eef3ef";
    ctx.font = `${Math.max(10, 14 / state.camera.zoom)}px monospace`;
    for (const label of state.level.labels || []) {
      ctx.fillText(label.text || "Room", label.x, label.y);
    }
  }

  function drawUnits() {
    for (const op of state.level.operators || []) drawCircle(op, op.color || "#67c98f", op.id || "OP");
    for (const enemy of state.level.enemies || []) drawCircle(enemy, "#df6262", enemy.id || "E");
    if (state.level.objective) drawCircle(state.level.objective, "#ebd36b", "VIP");
  }

  function drawTester() {
    drawCircle(state.tester, "#60c689", "YOU", 4);
  }

  function drawCircle(object, fill, label, outlineWidth = 1) {
    const radius = object.radius || 12;
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = outlineWidth / state.camera.zoom;
    ctx.beginPath();
    ctx.arc(object.x, object.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#101214";
    ctx.font = `${Math.max(8, 10 / state.camera.zoom)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(label, object.x, object.y + 3);
    ctx.textAlign = "start";
  }

  function setMessage(message) {
    state.message = message;
    statusLine.textContent = message;
  }

  function circleRectCollides(circle, rect) {
    const nearestX = clamp(circle.x, rect.x, rect.x + (rect.w || 0));
    const nearestY = clamp(circle.y, rect.y, rect.y + (rect.h || 0));
    return Math.hypot(circle.x - nearestX, circle.y - nearestY) < circle.radius;
  }

  function pointRectDistance(point, rect) {
    const nearestX = clamp(point.x, rect.x, rect.x + (rect.w || 0));
    const nearestY = clamp(point.y, rect.y, rect.y + (rect.h || 0));
    return Math.hypot(point.x - nearestX, point.y - nearestY);
  }

  function pointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + (rect.w || 0) && point.y >= rect.y && point.y <= rect.y + (rect.h || 0);
  }

  function inflateRect(rect, amount) {
    return {
      ...rect,
      x: rect.x - amount,
      y: rect.y - amount,
      w: (rect.w || 0) + amount * 2,
      h: (rect.h || 0) + amount * 2
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  resizeCanvas();
  updateZoomLabel();
  loadPreview();
}());
