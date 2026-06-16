"use strict";

const WORLD_WIDTH = 3600;
const WORLD_HEIGHT = 2280;
const SNAP = 10;
const GRID = 40;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_FACTOR = 1.25;
const DRAG_THRESHOLD = 4;

const canvas = document.getElementById("sceneBoard");
const ctx = canvas.getContext("2d");
const propertyPanel = document.getElementById("propertyPanel");
const openLevelButton = document.getElementById("openLevelButton");
const openLevelInput = document.getElementById("openLevelInput");
const downloadDialog = document.getElementById("downloadDialog");
const downloadFileNameInput = document.getElementById("downloadFileNameInput");
const downloadLevelButton = document.getElementById("downloadLevelButton");
const cancelDownloadButton = document.getElementById("cancelDownloadButton");
const confirmDownloadButton = document.getElementById("confirmDownloadButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomValue = document.getElementById("zoomValue");
const objectContextMenu = document.getElementById("objectContextMenu");
const deleteObjectButton = document.getElementById("deleteObjectButton");

const state = {
  selectedResource: "wall",
  selectedId: null,
  camera: { x: 0, y: 0, zoom: 1 },
  interaction: null,
  contextTargetId: null,
  level: createBlankLevel()
};

const resourceDefaults = {
  wall: (x, y) => ({ type: "wall", x, y, w: 120, h: 20 }),
  door: (x, y) => ({ type: "door", id: nextId("door"), x, y, w: 90, h: 20, orientation: "horizontal", state: "closed", lockType: "" }),
  window: (x, y) => ({ type: "window", id: nextId("window"), x, y, w: 110, h: 20, orientation: "horizontal", state: "closed", damage: 8 }),
  label: (x, y) => ({ type: "label", text: "Room", x, y }),
  stairs: (x, y) => ({ type: "stairs", id: nextId("stairs"), name: "Stairs", label: "A", x, y, w: 90, h: 70, target: { x: x + 180, y, floor: "Floor 2", label: "B" } }),
  equipmentTable: (x, y) => ({ type: "equipmentTable", id: nextId("gear"), name: "Gear Table", x, y, w: 70, h: 50 }),
  paper: (x, y) => ({ type: "paper", id: nextId("paper"), name: "Code Paper", x, y, w: 24, h: 18, passwordFor: "door-1" }),
  operator: (x, y) => ({ type: "operator", id: nextOperatorId(), x, y, color: "#67c98f", floor: "Floor 1", zone: "Entry" }),
  enemy: (x, y) => ({ type: "enemy", id: nextId("E"), x, y, angle: 3.14159, watch: { x: x - 120, y } }),
  objective: (x, y) => ({ type: "objective", x, y, radius: 16, secured: false, harmed: false })
};

document.querySelectorAll("[data-resource]").forEach((button) => {
  button.addEventListener("click", () => {
    hideContextMenu();
    state.selectedResource = button.dataset.resource;
    document.querySelectorAll("[data-resource]").forEach((item) => item.classList.toggle("active", item === button));
    updateCursor();
  });
});

openLevelButton.addEventListener("click", () => openLevelInput.click());
openLevelInput.addEventListener("change", openSelectedFile);
downloadLevelButton.addEventListener("click", () => {
  hideContextMenu();
  openDownloadDialog();
});
cancelDownloadButton.addEventListener("click", closeDownloadDialog);
confirmDownloadButton.addEventListener("click", confirmDownload);
zoomInButton.addEventListener("click", () => setZoom(state.camera.zoom * ZOOM_FACTOR));
zoomOutButton.addEventListener("click", () => setZoom(state.camera.zoom / ZOOM_FACTOR));
deleteObjectButton.addEventListener("click", deleteContextTarget);

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", finishInteraction);
canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("contextmenu", handleContextMenu);
window.addEventListener("scroll", hideContextMenu, true);
window.addEventListener("resize", hideContextMenu);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
});

function createBlankLevel() {
  return {
    id: "custom-level",
    title: "Custom Level",
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    floorZones: [],
    rooms: [],
    labels: [],
    walls: [],
    doors: [],
    windows: [],
    stairs: [],
    items: [],
    equipmentTables: [],
    operators: [],
    enemies: [],
    objective: { type: "objective", x: 980, y: 620, radius: 16, secured: false, harmed: false, _editorId: nextId("obj") }
  };
}

function handlePointerDown(event) {
  if (event.button === 2) {
    openContextMenuAtEvent(event);
    return;
  }
  if (event.button !== 0) return;
  hideContextMenu();
  const screen = screenPoint(event);
  const world = screenToWorld(screen);
  canvas.setPointerCapture(event.pointerId);

  if (state.selectedResource === "hand") {
    state.interaction = { type: "pan", pointerId: event.pointerId, lastScreen: screen };
    updateCursor();
    return;
  }

  const hit = findAt(world);
  if (hit) {
    selectObject(hit);
    state.interaction = {
      type: "drag",
      pointerId: event.pointerId,
      object: hit,
      offset: { x: world.x - hit.x, y: world.y - hit.y },
      startScreen: screen,
      moved: false
    };
    updateCursor();
    return;
  }

  state.interaction = { type: "place", pointerId: event.pointerId, startScreen: screen, world, moved: false };
}

function handleMouseDown(event) {
  if (event.button === 2) openContextMenuAtEvent(event);
}

function handlePointerMove(event) {
  if (event.button !== 0 && event.buttons !== 1) return;
  if (!state.interaction || state.interaction.pointerId !== event.pointerId) return;
  const screen = screenPoint(event);
  const interaction = state.interaction;

  if (interaction.type === "pan") {
    state.camera.x -= (screen.x - interaction.lastScreen.x) / state.camera.zoom;
    state.camera.y -= (screen.y - interaction.lastScreen.y) / state.camera.zoom;
    interaction.lastScreen = screen;
    clampCamera();
    draw();
    return;
  }

  if (interaction.startScreen && pointDistance(screen, interaction.startScreen) > DRAG_THRESHOLD) {
    interaction.moved = true;
  }

  if (interaction.type === "drag") {
    const world = screenToWorld(screen);
    interaction.object.x = snap(world.x - interaction.offset.x);
    interaction.object.y = snap(world.y - interaction.offset.y);
    clampObject(interaction.object);
    draw();
  }
}

function handlePointerUp(event) {
  if (event.button !== 0) return;
  if (!state.interaction || state.interaction.pointerId !== event.pointerId) return;
  const interaction = state.interaction;

  if (interaction.type === "place" && !interaction.moved) {
    const point = {
      x: snap(interaction.world.x),
      y: snap(interaction.world.y)
    };
    const factory = resourceDefaults[state.selectedResource] || resourceDefaults.wall;
    const object = factory(point.x, point.y);
    addObject(object);
    selectObject(object);
  } else if (interaction.type === "drag") {
    renderProperties(interaction.object);
  }

  finishInteraction(event);
}

function finishInteraction(event) {
  if (event && typeof canvas.releasePointerCapture === "function") {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer capture may already be released by the browser.
    }
  }
  state.interaction = null;
  updateCursor();
  draw();
}

function handleContextMenu(event) {
  openContextMenuAtEvent(event);
}

function openContextMenuAtEvent(event) {
  const screen = screenPoint(event);
  const world = screenToWorld(screen);
  const hit = findAt(world);
  hideContextMenu();
  if (!hit) return;
  event.preventDefault();
  selectObject(hit);
  state.contextTargetId = hit._editorId;
  showContextMenu(event.clientX, event.clientY);
}

function showContextMenu(x, y) {
  objectContextMenu.classList.remove("hidden");
  const rect = objectContextMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  objectContextMenu.style.left = `${Math.max(8, left)}px`;
  objectContextMenu.style.top = `${Math.max(8, top)}px`;
}

function hideContextMenu() {
  state.contextTargetId = null;
  if (!objectContextMenu) return;
  objectContextMenu.classList.add("hidden");
}

function deleteContextTarget() {
  const target = allObjects().find((object) => object._editorId === state.contextTargetId);
  if (target) removeObject(target);
  hideContextMenu();
  selectObject(null);
  draw();
}

function screenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function screenToWorld(point) {
  return {
    x: state.camera.x + point.x / state.camera.zoom,
    y: state.camera.y + point.y / state.camera.zoom
  };
}

function worldToScreen(point) {
  return {
    x: (point.x - state.camera.x) * state.camera.zoom,
    y: (point.y - state.camera.y) * state.camera.zoom
  };
}

function setZoom(nextZoom) {
  const oldZoom = state.camera.zoom;
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const worldCenter = screenToWorld(center);
  state.camera.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  state.camera.x = worldCenter.x - center.x / state.camera.zoom;
  state.camera.y = worldCenter.y - center.y / state.camera.zoom;
  if (oldZoom !== state.camera.zoom) {
    clampCamera();
    draw();
  }
}

function updateZoomLabel() {
  zoomValue.textContent = `${Math.round(state.camera.zoom * 100)}%`;
}

function updateCursor() {
  canvas.classList.toggle("is-hand", state.selectedResource === "hand" && (!state.interaction || state.interaction.type !== "pan"));
  canvas.classList.toggle("is-panning", Boolean(state.interaction && state.interaction.type === "pan"));
  canvas.classList.toggle("is-dragging", Boolean(state.interaction && state.interaction.type === "drag"));
}

function openSelectedFile() {
  const file = openLevelInput.files && openLevelInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      loadLevel(parsed);
    } catch (error) {
      propertyPanel.textContent = `Could not open JSON: ${error.message}`;
    } finally {
      openLevelInput.value = "";
    }
  });
  reader.readAsText(file);
}

function loadLevel(raw) {
  const level = {
    id: raw.id || "custom-level",
    title: raw.title || "Custom Level",
    width: raw.width || WORLD_WIDTH,
    height: raw.height || WORLD_HEIGHT,
    floorZones: cloneList(raw.floorZones),
    rooms: cloneList(raw.rooms),
    labels: withEditor(cloneList(raw.labels), "label"),
    walls: withEditor(cloneList(raw.walls), "wall"),
    doors: withEditor(cloneList(raw.doors), "door"),
    windows: withEditor(cloneList(raw.windows), "window"),
    stairs: withEditor(cloneList(raw.stairs), "stairs"),
    items: withEditor(cloneList(raw.items), "paper", true),
    equipmentTables: withEditor(cloneList(raw.equipmentTables), "equipmentTable"),
    operators: withEditor(cloneList(raw.operators), "operator"),
    enemies: withEditor(cloneList(raw.enemies), "enemy"),
    objective: { ...(raw.objective || { x: 980, y: 620, radius: 16, secured: false, harmed: false }), type: "objective", _editorId: nextId("obj") }
  };
  state.level = level;
  state.selectedId = null;
  state.camera.x = 0;
  state.camera.y = 0;
  state.camera.zoom = 1;
  clampCamera();
  renderProperties(null);
  draw();
}

function cloneList(list) {
  return Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : [];
}

function withEditor(list, editorType, keepItemType = false) {
  return list.map((item) => ({
    ...item,
    type: keepItemType ? (item.type || editorType) : editorType,
    _editorId: nextId("obj")
  }));
}

function openDownloadDialog() {
  downloadFileNameInput.value = defaultDownloadName();
  downloadDialog.classList.remove("hidden");
  downloadFileNameInput.focus();
  downloadFileNameInput.select();
}

function closeDownloadDialog() {
  downloadDialog.classList.add("hidden");
}

function confirmDownload() {
  const filename = normalizeFilename(downloadFileNameInput.value || defaultDownloadName());
  const level = serializeLevel(filename);
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  closeDownloadDialog();
}

function defaultDownloadName() {
  return normalizeFilename(`${state.level.id || "custom-level"}.json`);
}

function normalizeFilename(value) {
  const cleaned = String(value || "custom-level.json").trim().replace(/[\\/:*?"<>|]+/g, "-");
  return cleaned.toLowerCase().endsWith(".json") ? cleaned : `${cleaned}.json`;
}

function idFromFilename(filename) {
  return filename.replace(/\.json$/i, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom-level";
}

function titleFromId(id) {
  return id.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "Custom Level";
}

function nextId(prefix) {
  return `${prefix}-${Math.floor(Math.random() * 100000)}`;
}

function nextOperatorId() {
  const count = state.level.operators.length;
  return count === 0 ? "ALPHA" : count === 1 ? "BRAVO" : `OP${count + 1}`;
}

function addObject(object) {
  object._editorId = nextId("obj");
  if (object.type === "wall") state.level.walls.push(object);
  else if (object.type === "door") state.level.doors.push(object);
  else if (object.type === "window") state.level.windows.push(object);
  else if (object.type === "label") state.level.labels.push(object);
  else if (object.type === "stairs") state.level.stairs.push(object);
  else if (object.type === "equipmentTable") state.level.equipmentTables.push(object);
  else if (object.type === "paper") state.level.items.push(object);
  else if (object.type === "operator") state.level.operators.push(object);
  else if (object.type === "enemy") state.level.enemies.push(object);
  else if (object.type === "objective") state.level.objective = object;
}

function removeObject(object) {
  if (object === state.level.objective || object.type === "objective") {
    state.level.objective = { type: "objective", x: 980, y: 620, radius: 16, secured: false, harmed: false, _editorId: nextId("obj") };
    return true;
  }
  const collections = [
    state.level.walls,
    state.level.doors,
    state.level.windows,
    state.level.labels,
    state.level.stairs,
    state.level.equipmentTables,
    state.level.items,
    state.level.operators,
    state.level.enemies
  ];
  for (const collection of collections) {
    const index = collection.findIndex((item) => item._editorId === object._editorId);
    if (index >= 0) {
      collection.splice(index, 1);
      return true;
    }
  }
  return false;
}

function allObjects() {
  return [
    ...state.level.walls,
    ...state.level.doors,
    ...state.level.windows,
    ...state.level.labels,
    ...state.level.stairs,
    ...state.level.equipmentTables,
    ...state.level.items,
    ...state.level.operators,
    ...state.level.enemies,
    state.level.objective
  ].filter(Boolean);
}

function findAt(point) {
  return allObjects().slice().reverse().find((object) => {
    if (object.radius) return Math.hypot(point.x - object.x, point.y - object.y) <= object.radius + 8;
    const w = object.w || 70;
    const h = object.h || 28;
    return point.x >= object.x && point.x <= object.x + w && point.y >= object.y && point.y <= object.y + h;
  });
}

function selectObject(object) {
  state.selectedId = object ? object._editorId : null;
  renderProperties(object);
  draw();
}

function renderProperties(object) {
  if (!object) {
    propertyPanel.textContent = "Select or place an object.";
    return;
  }
  const fields = Object.entries(object)
    .filter(([key]) => key !== "_editorId" && key !== "type" && typeof object[key] !== "object")
    .map(([key, value]) => `
      <label class="field">
        <span>${key}</span>
        <input data-prop="${key}" value="${String(value)}">
      </label>
    `).join("");
  const digital = object.type === "door" ? `
    <label class="field">
      <span>Digital Lock</span>
      <select data-prop="lockType">
        <option value=""${object.lockType ? "" : " selected"}>None</option>
        <option value="digital"${object.lockType === "digital" ? " selected" : ""}>Digital</option>
      </select>
    </label>
  ` : "";
  const target = object.type === "stairs" ? `
    <label class="field"><span>Target X</span><input data-target-prop="x" value="${object.target ? object.target.x : ""}"></label>
    <label class="field"><span>Target Y</span><input data-target-prop="y" value="${object.target ? object.target.y : ""}"></label>
  ` : "";
  propertyPanel.innerHTML = `<strong>${object.type}</strong>${fields}${digital}${target}`;
  propertyPanel.querySelectorAll("input[data-prop], select[data-prop]").forEach((input) => {
    input.addEventListener("input", () => {
      object[input.dataset.prop] = parseValue(input.value);
      draw();
    });
  });
  propertyPanel.querySelectorAll("input[data-target-prop]").forEach((input) => {
    input.addEventListener("input", () => {
      object.target = object.target || {};
      object.target[input.dataset.targetProp] = parseValue(input.value);
      draw();
    });
  });
}

function parseValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

function serializeLevel(filename = defaultDownloadName()) {
  const clean = JSON.parse(JSON.stringify(state.level));
  if (clean.id === "custom-level") clean.id = idFromFilename(filename);
  if (clean.title === "Custom Level") clean.title = titleFromId(clean.id);

  const strip = (item, options = {}) => {
    delete item._editorId;
    if (!options.keepType) delete item.type;
    if (item.lockType === "") delete item.lockType;
    return item;
  };
  clean.walls = clean.walls.map(strip);
  clean.doors = clean.doors.map((door) => {
    strip(door);
    if (door.lockType === "digital") {
      door.locked = true;
      door.password = "0000";
    }
    return door;
  });
  clean.windows = clean.windows.map(strip);
  clean.labels = clean.labels.map(strip);
  clean.stairs = clean.stairs.map(strip);
  clean.equipmentTables = clean.equipmentTables.map(strip);
  clean.items = clean.items.map((item) => strip(item, { keepType: true }));
  clean.operators = clean.operators.map(strip);
  clean.enemies = clean.enemies.map(strip);
  strip(clean.objective);
  return clean;
}

function draw() {
  updateZoomLabel();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#101214";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(state.camera.zoom, 0, 0, state.camera.zoom, -state.camera.x * state.camera.zoom, -state.camera.y * state.camera.zoom);
  ctx.fillStyle = "#15191b";
  ctx.fillRect(0, 0, state.level.width, state.level.height);
  drawGrid();
  ctx.strokeStyle = "#596369";
  ctx.lineWidth = 3 / state.camera.zoom;
  ctx.strokeRect(0, 0, state.level.width, state.level.height);

  for (const zone of state.level.floorZones || []) drawRectObject(zone, "rgba(96, 198, 137, 0.08)", "");
  for (const room of state.level.rooms || []) drawRectObject(room, "rgba(114, 183, 206, 0.08)", room.name || "");
  drawRects(state.level.walls, "#596369");
  drawRects(state.level.doors, "#e3b456");
  drawRects(state.level.windows, "#72b7ce");
  drawRects(state.level.stairs, "#8ec6c0");
  drawRects(state.level.equipmentTables, "#6b6f75");
  drawRects(state.level.items, "#f5e6a6");
  drawLabels();
  drawUnits();
  ctx.restore();
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

function drawRects(list, fill) {
  for (const object of list) drawRectObject(object, fill, "");
}

function drawRectObject(object, fill, label) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = object._editorId === state.selectedId ? "#ffffff" : "#222";
  ctx.lineWidth = (object._editorId === state.selectedId ? 3 : 1) / state.camera.zoom;
  ctx.fillRect(object.x, object.y, object.w || 24, object.h || 18);
  ctx.strokeRect(object.x, object.y, object.w || 24, object.h || 18);
  if (label) {
    ctx.fillStyle = "#eef3ef";
    ctx.font = "800 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, object.x + (object.w || 24) / 2, object.y + 18);
  }
}

function drawLabels() {
  ctx.fillStyle = "#eef3ef";
  ctx.font = "800 13px system-ui";
  ctx.textAlign = "center";
  for (const label of state.level.labels) {
    ctx.fillText(label.text || "Room", label.x, label.y);
  }
}

function drawUnits() {
  for (const op of state.level.operators) drawCircle(op, op.color || "#67c98f", op.id);
  for (const enemy of state.level.enemies) drawCircle(enemy, "#df6262", enemy.id);
  drawCircle(state.level.objective, "#ebd36b", "VIP");
}

function drawCircle(object, fill, label) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = object._editorId === state.selectedId ? "#ffffff" : "#111";
  ctx.lineWidth = (object._editorId === state.selectedId ? 3 : 1) / state.camera.zoom;
  ctx.beginPath();
  ctx.arc(object.x, object.y, object.radius || 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#eef3ef";
  ctx.font = "800 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label || object.type, object.x, object.y - 18);
}

function clampCamera() {
  const maxX = Math.max(0, state.level.width - canvas.width / state.camera.zoom);
  const maxY = Math.max(0, state.level.height - canvas.height / state.camera.zoom);
  state.camera.x = clamp(state.camera.x, 0, maxX);
  state.camera.y = clamp(state.camera.y, 0, maxY);
}

function clampObject(object) {
  object.x = clamp(object.x, 0, state.level.width);
  object.y = clamp(object.y, 0, state.level.height);
}

function snap(value) {
  return Math.round(value / SNAP) * SNAP;
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.querySelector("[data-resource='wall']").classList.add("active");
updateCursor();
draw();
