"use strict";

(function () {
  // Builds all canvas drawing routines for the tactical view.
  function create(deps) {
    const runtime = deps.runtime;
    const ctx = deps.ctx;
    const world = deps.world;
    const colors = deps.colors;
    const twoPi = deps.twoPi;
    // const imageCache = new Map();
    /*
    const v1ObjectPath = "docs/images/gameplay-objects/";
    const v2ObjectPath = "docs/images/pixel-art-v2/";
    const v1Sprites = {
      floor: `${v1ObjectPath}pixel-art-floor-tile-001.png`,
      floorBackground: `${v1ObjectPath}pixel-art-floor-background-001.png`,
      grid: `${v1ObjectPath}pixel-art-grid-overlay-tile-001.png`,
      zone: `${v1ObjectPath}pixel-art-room-zone-fill-tile-001.png`,
      labelFrame: `${v1ObjectPath}pixel-art-room-label-plaque-001.png`,
      labelSmallFrame: `${v1ObjectPath}pixel-art-room-label-small-plaque-001.png`,
      wallHorizontal: `${v1ObjectPath}pixel-art-horizontal-wall-segment-001.png`,
      wallVertical: `${v1ObjectPath}pixel-art-vertical-wall-segment-001.png`,
      wallCorner: `${v1ObjectPath}pixel-art-wall-corner-001.png`,
      wallEndCap: `${v1ObjectPath}pixel-art-wall-end-cap-001.png`,
      doorClosedHorizontal: `${v1ObjectPath}pixel-art-normal-door-closed-horizontal-001.png`,
      doorClosedVertical: `${v1ObjectPath}pixel-art-normal-door-closed-vertical-001.png`,
      doorOpenHorizontal: `${v1ObjectPath}pixel-art-normal-door-open-horizontal-001.png`,
      doorOpenVertical: `${v1ObjectPath}pixel-art-normal-door-open-vertical-001.png`,
      digitalDoorClosedHorizontal: `${v1ObjectPath}pixel-art-digital-lock-door-closed-horizontal-001.png`,
      digitalDoorClosedVertical: `${v1ObjectPath}pixel-art-digital-lock-door-closed-vertical-001.png`,
      lockedMarker: `${v1ObjectPath}pixel-art-locked-marker-001.png`,
      unlockedMarker: `${v1ObjectPath}pixel-art-unlocked-marker-001.png`,
      windowClosedHorizontal: `${v1ObjectPath}pixel-art-closed-horizontal-window-001.png`,
      windowClosedVertical: `${v1ObjectPath}pixel-art-closed-vertical-window-001.png`,
      windowOpenHorizontal: `${v1ObjectPath}pixel-art-open-horizontal-window-001.png`,
      windowOpenVertical: `${v1ObjectPath}pixel-art-open-vertical-window-001.png`,
      windowBrokenHorizontal: `${v1ObjectPath}pixel-art-broken-horizontal-window-001.png`,
      windowBrokenVertical: `${v1ObjectPath}pixel-art-broken-vertical-window-001.png`,
      glassBreak: `${v1ObjectPath}pixel-art-glass-break-effect-001.png`,
      paper: `${v1ObjectPath}pixel-art-paper-clue-on-floor-001.png`,
      paperHighlighted: `${v1ObjectPath}pixel-art-paper-clue-highlighted-001.png`,
      genericPickup: `${v1ObjectPath}pixel-art-generic-pickup-item-001.png`,
      stairs: `${v1ObjectPath}pixel-art-stair-up-marker-001.png`,
      stairsDown: `${v1ObjectPath}pixel-art-stair-down-marker-001.png`,
      stairGlow: `${v1ObjectPath}pixel-art-stair-interaction-glow-001.png`,
      gearTable: `${v1ObjectPath}pixel-art-gear-table-top-down-001.png`,
      gearTableActive: `${v1ObjectPath}pixel-art-gear-table-active-highlighted-001.png`,
      laptopClosed: `${v1ObjectPath}pixel-art-laptop-closed-001.png`,
      laptopOpen: `${v1ObjectPath}pixel-art-laptop-open-001.png`,
      laptopUsed: `${v1ObjectPath}pixel-art-laptop-hacked-used-001.png`,
      camera: `${v1ObjectPath}pixel-art-camera-body-001.png`,
      cameraActive: `${v1ObjectPath}pixel-art-camera-active-001.png`,
      cameraLabel: `${v1ObjectPath}pixel-art-camera-label-badge-c1-c2-base-001.png`,
      operator: `${v1ObjectPath}pixel-art-operator-idle-top-down-001.png`,
      operatorMoving: `${v1ObjectPath}pixel-art-operator-moving-top-down-001.png`,
      operatorDown: `${v1ObjectPath}pixel-art-operator-downed-001.png`,
      enemy: `${v1ObjectPath}pixel-art-enemy-calm-001.png`,
      enemySuspicious: `${v1ObjectPath}pixel-art-enemy-suspicious-001.png`,
      enemyAlert: `${v1ObjectPath}pixel-art-enemy-alert-001.png`,
      enemyDown: `${v1ObjectPath}pixel-art-enemy-downed-001.png`,
      objective: `${v1ObjectPath}pixel-art-vip-objective-idle-001.png`,
      objectiveSecured: `${v1ObjectPath}pixel-art-vip-secured-001.png`,
      routeDash: `${v1ObjectPath}pixel-art-planned-path-dash-001.png`,
      waypoint: `${v1ObjectPath}pixel-art-waypoint-dot-001.png`,
      waypointActive: `${v1ObjectPath}pixel-art-active-waypoint-dot-001.png`,
      bullet: `${v1ObjectPath}pixel-art-bullet-tracer-segment-001.png`,
      muzzleFlash: `${v1ObjectPath}pixel-art-muzzle-flash-001.png`,
      hitSpark: `${v1ObjectPath}pixel-art-hit-spark-001.png`
    };
    const v2Sprites = {
      floor: `${v2ObjectPath}pixel-art-floor-tile-001.png`,
      floorBackground: `${v2ObjectPath}pixel-art-floor-tile-001.png`,
      grid: `${v2ObjectPath}pixel-art-grid-tile-overlay-001.png`,
      zone: `${v2ObjectPath}pixel-art-room-zone-fill-tile-001.png`,
      labelFrame: `${v2ObjectPath}pixel-art-room-label-plaque-001.png`,
      labelSmallFrame: `${v2ObjectPath}pixel-art-room-label-plaque-001.png`,
      wallHorizontal: `${v2ObjectPath}pixel-art-horizontal-wall-segment-001.png`,
      wallVertical: `${v2ObjectPath}pixel-art-vertical-wall-segment-001.png`,
      wallCorner: `${v2ObjectPath}pixel-art-wall-corner-001.png`,
      wallEndCap: `${v2ObjectPath}pixel-art-wall-end-cap-001.png`,
      lockedMarker: `${v2ObjectPath}pixel-art-locked-door-marker-001.png`,
      unlockedMarker: `${v2ObjectPath}pixel-art-unlocked-door-marker-001.png`,
      windowClosedHorizontal: `${v2ObjectPath}pixel-art-closed-horizontal-window-001.png`,
      windowClosedVertical: `${v2ObjectPath}pixel-art-closed-vertical-window-001.png`,
      windowOpenHorizontal: `${v2ObjectPath}pixel-art-open-horizontal-window-001.png`,
      windowOpenVertical: `${v2ObjectPath}pixel-art-open-vertical-window-001.png`,
      windowBrokenHorizontal: `${v2ObjectPath}pixel-art-broken-horizontal-window-001.png`,
      windowBrokenVertical: `${v2ObjectPath}pixel-art-broken-vertical-window-001.png`,
      paper: `${v2ObjectPath}pixel-art-paper-clue-item-001.png`,
      paperHighlighted: `${v2ObjectPath}pixel-art-paper-clue-item-001.png`,
      genericPickup: `${v2ObjectPath}pixel-art-generic-pickup-item-001.png`,
      stairs: `${v2ObjectPath}pixel-art-stairs-up-marker-001.png`,
      stairsDown: `${v2ObjectPath}pixel-art-stairs-down-marker-001.png`,
      gearTable: `${v2ObjectPath}pixel-art-gear-equipment-table-001.png`,
      gearTableActive: `${v2ObjectPath}pixel-art-gear-equipment-table-001.png`,
      laptopClosed: `${v2ObjectPath}pixel-art-laptop-closed-001.png`,
      laptopOpen: `${v2ObjectPath}pixel-art-laptop-open-001.png`,
      laptopUsed: `${v2ObjectPath}pixel-art-laptop-used-001.png`,
      camera: `${v2ObjectPath}pixel-art-camera-body-001.png`,
      cameraActive: `${v2ObjectPath}pixel-art-camera-active-marker-001.png`,
      cameraLabel: `${v2ObjectPath}pixel-art-camera-label-badge-001.png`,
      operator: `${v2ObjectPath}pixel-art-operator-top-down-001.png`,
      operatorMoving: `${v2ObjectPath}pixel-art-operator-top-down-001.png`,
      operatorDown: `${v2ObjectPath}pixel-art-operator-top-down-001.png`,
      enemy: `${v2ObjectPath}pixel-art-enemy-top-down-001.png`,
      enemySuspicious: `${v2ObjectPath}pixel-art-enemy-top-down-001.png`,
      enemyAlert: `${v2ObjectPath}pixel-art-enemy-top-down-001.png`,
      enemyDown: `${v2ObjectPath}pixel-art-enemy-top-down-001.png`,
      objective: `${v2ObjectPath}pixel-art-vip-top-down-001.png`,
      objectiveSecured: `${v2ObjectPath}pixel-art-vip-top-down-001.png`,
      routeDash: `${v2ObjectPath}pixel-art-path-dash-001.png`,
      waypoint: `${v2ObjectPath}pixel-art-waypoint-dot-001.png`,
      waypointActive: `${v2ObjectPath}pixel-art-waypoint-dot-001.png`,
      bullet: `${v2ObjectPath}pixel-art-bullet-tracer-001.png`,
      muzzleFlash: `${v2ObjectPath}pixel-art-muzzle-flash-001.png`,
      hitSpark: `${v2ObjectPath}pixel-art-hit-spark-001.png`
    };
    const sprites = new Proxy({}, {
      get(target, key) {
        if (typeof key !== "string") return target[key];
        return spriteSource(key);
      }
    });
    */
    const v1Sprites = {};
    const v2Sprites = {};
    const sprites = {};
    const spriteCrops = {
      wallShort: { x: 176, y: 166, w: 362, h: 142 },
      wallLong: { x: 622, y: 166, w: 758, h: 142 },
      wallVertical: { x: 178, y: 430, w: 82, h: 376 },
      doorShortWood: { x: 546, y: 118, w: 480, h: 130 },
      doorLongWood: { x: 370, y: 308, w: 830, h: 120 },
      digitalDoor: { x: 375, y: 280, w: 1030, h: 305 },
      windowClosed: { x: 230, y: 178, w: 1320, h: 180 },
      windowOpenLeft: { x: 346, y: 506, w: 510, h: 180 },
      windowOpenRight: { x: 986, y: 506, w: 510, h: 180 },
      bullet: { x: 710, y: 360, w: 280, h: 150 },
      routeStart: { x: 252, y: 772, w: 102, h: 100 },
      routeArrow: { x: 864, y: 300, w: 86, h: 92 },
      routeEnd: { x: 1212, y: 138, w: 130, h: 132 },
      routeDash: { x: 707, y: 312, w: 70, h: 36 },
      zoneBlue: { x: 68, y: 314, w: 448, h: 355 },
      zoneAmber: { x: 590, y: 314, w: 408, h: 355 },
      zoneRed: { x: 1054, y: 314, w: 404, h: 355 },
      sightWide: { x: 184, y: 100, w: 612, h: 652 },
      sightNarrow: { x: 925, y: 344, w: 560, h: 235 },
      debugSmall: { x: 222, y: 178, w: 172, h: 144 },
      debugMedium: { x: 598, y: 118, w: 272, h: 232 },
      debugLarge: { x: 1012, y: 62, w: 388, h: 392 },
      glassBreak: { x: 282, y: 245, w: 700, h: 735 },
      laptopClosed: { x: 120, y: 386, w: 358, h: 250 },
      laptopOpen: { x: 565, y: 295, w: 395, h: 360 },
      laptopBack: { x: 1055, y: 386, w: 360, h: 250 }
    };

    // Draws one full frame of the current game state.
    function draw() {
      deps.camera.reset(ctx);
      ctx.imageSmoothingEnabled = false;
      const viewport = deps.camera.getViewport ? deps.camera.getViewport() : { w: deps.canvas.width, h: deps.canvas.height };
      ctx.clearRect(0, 0, viewport.w, viewport.h);
      if (!runtime.state) {
        drawLoading();
        return;
      }
      deps.camera.apply(ctx);
      drawFloor();
      drawRooms();
      drawWindows();
      drawStairs();
      drawItems();
      drawEquipmentTables();
      drawLaptops();
      drawPaths();
      drawSight();
      drawDoors();
      drawCameras();
      drawObjective();
      drawUnits();
      drawShots();
      deps.camera.reset(ctx);
      // Visibility fog disabled per user request.
      // drawFog();
      // In-canvas hint/status card moved to the right panel.
      // drawHudOverlay();
      if (runtime.state.debug) {
        deps.camera.apply(ctx);
        drawDebug();
        deps.camera.reset(ctx);
      }
    }

    // Draws the loading screen when no level state is available.
    function drawLoading() {
      const viewport = deps.camera.getViewport ? deps.camera.getViewport() : { w: deps.canvas.width, h: deps.canvas.height };
      ctx.fillStyle = colors.floor;
      ctx.fillRect(0, 0, viewport.w, viewport.h);
      ctx.fillStyle = colors.text;
      ctx.font = "800 24px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Loading level...", viewport.w / 2, viewport.h / 2);
    }

    // Draws the map floor, grid, and floor zone fills.
    function drawFloor() {
      const state = runtime.state;
      const padding = deps.camera.getPadding ? deps.camera.getPadding() : { x: 0, y: 0 };
      ctx.fillStyle = "#101315";
      ctx.fillRect(-padding.x, -padding.y, world.w + padding.x * 2, world.h + padding.y * 2);
      const source = sceneSource();
      const background = source && source.background ? loadImage(resolveVisualSource(source.background)) : null;
      if (background && background.complete && background.naturalWidth) {
        ctx.drawImage(background, 0, 0, world.w, world.h);
        drawGrid();
        drawFloorZones(state);
        return;
      }
      const floorDrawn = drawTiledImage(sprites.floor, 0, 0, world.w, world.h, 64, 64)
        || drawImageInRect(sprites.floorBackground, 0, 0, world.w, world.h);
      if (!floorDrawn) {
        ctx.fillStyle = colors.floor;
        ctx.fillRect(0, 0, world.w, world.h);
      }
      drawGrid();
      drawFloorZones(state);
    }

    // Draws room/floor-zone overlays after the base floor texture.
    function drawFloorZones(state) {
      ctx.fillStyle = colors.floorAlt;
      const zones = (state.level.floorZones.length ? state.level.floorZones : [
        { x: 140, y: 110, w: 155, h: 230 },
        { x: 315, y: 110, w: 185, h: 140 },
        { x: 520, y: 110, w: 270, h: 140 },
        { x: 315, y: 270, w: 185, h: 110 },
        { x: 520, y: 270, w: 130, h: 110 },
        { x: 670, y: 270, w: 120, h: 110 },
        { x: 140, y: 360, w: 155, h: 150 },
        { x: 315, y: 400, w: 185, h: 110 },
        { x: 520, y: 400, w: 270, h: 110 }
      ]).filter(shouldDrawObject);
      for (let index = 0; index < zones.length; index += 1) {
        const zone = zones[index];
        ctx.save();
        ctx.globalAlpha = 0.22;
        const drawn = drawTiledImage(sprites.zone, zone.x, zone.y, zone.w, zone.h, 128, 128);
        ctx.restore();
        if (!drawn) ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      }
    }

    // Draws the authored tactical grid over procedural or image-backed floors.
    function drawGrid() {
      ctx.save();
      ctx.globalAlpha = 0.42;
      const tiled = drawTiledImage(sprites.grid, 20, 20, Math.max(0, world.w - 40), Math.max(0, world.h - 40), 64, 64);
      ctx.restore();
      if (tiled) return;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let x = 20; x < world.w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, world.h - 20);
        ctx.stroke();
      }
      for (let y = 20; y < world.h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(world.w - 20, y);
        ctx.stroke();
      }
    }

    // Draws wall rectangles and their outlines.
    function drawRooms() {
      for (const wall of runtime.state.level.walls.filter(shouldDrawObject)) {
        if (drawSceneWall(wall)) continue;
        if (drawGameplayWall(wall)) continue;
        ctx.fillStyle = colors.wall;
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = colors.wallEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      }
      drawLabels();
    }

    // Draws room and zone labels from level data.
    function drawLabels() {
      const labels = [
        ...(runtime.state.level.rooms || []).filter(shouldDrawObject).map((room) => ({ ...room, x: room.x + room.w / 2, y: room.y + 18, text: room.label || room.id })),
        ...(runtime.state.level.labels || []).filter(shouldDrawObject)
      ].filter(shouldDrawObject);
      ctx.fillStyle = "rgba(238,243,239,0.56)";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const label of labels) {
        drawLabelFrame(label);
        ctx.fillText(label.text, label.x, label.y);
      }
    }

    // Draws windows with open, closed, and broken states.
    function drawWindows() {
      for (const win of (runtime.state.level.windows || []).filter(shouldDrawObject)) {
        const box = deps.geometry.scaledRect(win);
        if (drawGameplayWindow(win, box)) continue;
        ctx.save();
        ctx.fillStyle = win.state === "broken" ? "#92d5e9" : (win.state === "open" ? "#72b7ce" : "#b9e8f3");
        ctx.strokeStyle = win.state === "broken" ? "#ffffff" : "#24434b";
        ctx.lineWidth = 2;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        if (win.state === "broken") {
          ctx.strokeStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(box.x + 3, box.y + 3);
          ctx.lineTo(box.x + box.w - 3, box.y + box.h - 3);
          ctx.moveTo(box.x + box.w - 3, box.y + 3);
          ctx.lineTo(box.x + 3, box.y + box.h - 3);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Draws stair connectors and target direction.
    function drawStairs() {
      for (const stair of (runtime.state.level.stairs || []).filter(shouldDrawObject)) {
        const box = deps.geometry.scaledRect(stair);
        drawImageInRect(sprites.stairGlow, box.x - 8, box.y - 8, box.w + 16, box.h + 16);
        const source = /down/i.test(stair.label || stair.name || stair.id || "") ? sprites.stairsDown : sprites.stairs;
        if (drawImageInRect(source, box.x, box.y, box.w, box.h)) {
          drawSmallObjectLabel(stair.label || "STAIRS", box);
          continue;
        }
        ctx.save();
        ctx.fillStyle = "#8ec6c0";
        ctx.strokeStyle = "#1d3a3a";
        ctx.lineWidth = 2;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = "#102526";
        for (let i = 6; i < box.w; i += 10) {
          ctx.beginPath();
          ctx.moveTo(box.x + i, box.y + 4);
          ctx.lineTo(box.x + i, box.y + box.h - 4);
          ctx.stroke();
        }
        ctx.fillStyle = "#102526";
        ctx.font = "800 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(stair.label || "STAIRS", box.x + box.w / 2, box.y + box.h / 2 + 4);
        ctx.restore();
      }
    }

    // Draws paper and other pickup items.
    function drawItems() {
      for (const item of (runtime.state.level.items || []).filter(shouldDrawObject)) {
        if (item.picked) continue;
        const box = deps.geometry.scaledRect({ ...item, w: item.w || 20, h: item.h || 16 });
        const source = item.type === "paper" ? sprites.paper : sprites.genericPickup;
        if (drawImageInRect(source, box.x, box.y, box.w, box.h)) continue;
        ctx.fillStyle = item.type === "paper" ? "#f5e6a6" : "#d9d9d9";
        ctx.strokeStyle = "#6c6132";
        ctx.lineWidth = 1.5;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#27240e";
        ctx.font = "900 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("P", box.x + box.w / 2, box.y + box.h / 2 + 3);
      }
    }

    // Draws interactable equipment tables.
    function drawEquipmentTables() {
      for (const table of (runtime.state.level.equipmentTables || []).filter(shouldDrawObject)) {
        const box = deps.geometry.scaledRect(table);
        const source = runtime.equipmentTableOpen ? sprites.gearTableActive : sprites.gearTable;
        if (drawImageInRect(source, box.x, box.y, box.w, box.h)) {
          drawSmallObjectLabel("GEAR", box);
          continue;
        }
        ctx.fillStyle = "#6b6f75";
        ctx.strokeStyle = "#25282c";
        ctx.lineWidth = 2;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#eef3ef";
        ctx.font = "800 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("GEAR", box.x + box.w / 2, box.y + box.h / 2 + 3);
      }
    }

    // Draws exterior laptop terminals used for camera hacking.
    function drawLaptops() {
      for (const laptop of runtime.state.level.laptops || []) {
        const box = deps.geometry.scaledRect(laptop);
        if (drawGameplayLaptop(laptop, box)) continue;
        ctx.fillStyle = "#202a31";
        ctx.strokeStyle = "#72b7ce";
        ctx.lineWidth = 2;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#72b7ce";
        ctx.font = "900 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("LAPTOP", box.x + box.w / 2, box.y + box.h / 2 + 3);
      }
    }

    // Draws each door in closed or open orientation.
    function drawDoors() {
      for (const door of runtime.state.level.doors.filter(shouldDrawObject)) {
        const box = deps.geometry.scaledRect(door);
        const center = deps.geometry.rectCenter(box);
        if (drawSceneDoor(door, box, center)) {
          drawDoorIndicator(door, center);
          continue;
        }
        if (drawGameplayDoor(door, box, center)) {
          drawDoorIndicator(door, center);
          continue;
        }
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(door.orientation === "vertical" ? Math.PI / 2 : 0);
        ctx.fillStyle = door.state === "closed" ? colors.doorClosed : colors.doorOpen;
        if (door.state === "closed") {
          ctx.fillRect(-doorLong(box) / 2, -4, doorLong(box), 8);
        } else {
          ctx.rotate(-0.72);
          ctx.fillRect(-doorLong(box) / 2, -4, doorLong(box), 8);
        }
        ctx.restore();
        drawDoorIndicator(door, center);
      }
    }

    // Draws camera labels only after a laptop hack has started.
    function drawCameras() {
      const hack = runtime.state.cameraHack;
      if (!hack || !hack.started) return;
      for (const camera of runtime.state.level.cameras || []) {
        ctx.save();
        const revealed = hack.revealedCameras.has(camera.id);
        const cameraSource = revealed ? sprites.cameraActive : sprites.camera;
        if (drawImageCentered(cameraSource, camera, 32, 32, 0)) {
          drawCameraLabel(camera, revealed);
          ctx.restore();
          continue;
        }
        ctx.fillStyle = revealed ? colors.success : colors.cyan;
        ctx.strokeStyle = "#0f1518";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(camera.x, camera.y, 13, 0, twoPi);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#071015";
        drawCameraLabel(camera, revealed);
        ctx.restore();
      }
    }

    // Draws lock/unlock markers for digital doors.
    function drawDoorIndicator(door, center) {
      if (!deps.geometry.isDigitalLockDoor(door) || door.state !== "closed") return;
      const locked = deps.geometry.isLockedDigitalDoor(door);
      ctx.save();
      const markerSource = locked ? sprites.lockedMarker : sprites.unlockedMarker;
      const markerSize = deps.geometry.scaledRadius({ radius: 12 }) * 2;
      if (drawImageCentered(markerSource, center, markerSize, markerSize, 0)) {
        ctx.restore();
        return;
      }
      ctx.fillStyle = locked ? colors.doorLocked : colors.doorUnlocked;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 2;
      const markerRadius = deps.geometry.scaledRadius({ radius: 9 });
        ctx.beginPath();
        ctx.arc(center.x, center.y, markerRadius, 0, twoPi);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#101214";
      ctx.font = "900 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(locked ? "L" : "U", center.x, center.y + 0.5);
      ctx.restore();
    }

    // Returns the long side of a door rectangle for door drawing.
    function doorLong(door) {
      return Math.max(door.w, door.h);
    }

    // Draws operator waypoint routes and waypoint dots.
    function drawPaths() {
      const state = runtime.state;
      for (const op of state.level.operators) {
        if (!op.path.length) continue;
        if (!drawSpritePath(op, op.id === state.selectedId ? colors.selected : op.color)) {
          ctx.strokeStyle = op.id === state.selectedId ? colors.selected : op.color;
          ctx.lineWidth = op.id === state.selectedId ? 3 : 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(op.x, op.y);
          for (const point of op.path) ctx.lineTo(point.x, point.y);
          ctx.stroke();
          ctx.setLineDash([]);
          for (const point of op.path) {
            ctx.fillStyle = op.color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, twoPi);
            ctx.fill();
          }
        }
      }
    }

    // Draws enemy and operator vision cones with difficulty visibility rules.
    function drawSight() {
      const state = runtime.state;
      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        if (!shouldDrawObject(enemy)) continue;
        if (runtime.currentDifficulty === "difficult" && !deps.visibility.visibleToOperators(enemy)) continue;
        drawCone(enemy, enemy.angle, enemy.sightRange, enemy.fov, colors.sight);
      }

      for (const op of state.level.operators) {
        if (op.down) continue;
        drawCone(op, op.aim, deps.visibility.operatorSightRange(op), Math.PI * 0.52, colors.opSight);
      }
    }

    // Draws a filled radial vision cone.
    function drawCone(origin, angle, length, fov, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.arc(origin.x, origin.y, length, angle - fov / 2, angle + fov / 2);
      ctx.closePath();
      ctx.fill();
    }

    // Draws the VIP objective when it is visible.
    function drawObjective() {
      const obj = runtime.state.level.objective;
      if (!shouldDrawObject(obj) || !deps.visibility.objectiveVisible()) return;
      const radius = deps.geometry.scaledRadius(obj);
      if (drawSceneObjective(obj, radius)) return;
      if (drawGameplayObjective(obj, radius)) return;
      ctx.fillStyle = obj.harmed ? colors.enemy : colors.hostage;
      ctx.strokeStyle = obj.secured ? colors.success : "#5d5330";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, radius, 0, twoPi);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#171b1e";
      ctx.font = "700 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VIP", obj.x, obj.y + 1);
    }

    // Draws all visible enemies and all operators.
    function drawUnits() {
      const state = runtime.state;
      for (const enemy of state.level.enemies) {
        if (!shouldDrawObject(enemy)) continue;
        if (runtime.currentDifficulty === "difficult" && !deps.visibility.visibleToOperators(enemy)) continue;
        drawUnit(enemy, enemy.down ? "#573030" : colors.enemy, enemy.id, false);
      }
      for (const op of state.level.operators) drawUnit(op, op.down ? "#2d4035" : op.color, op.id, true);
    }

    // Applies camera-hack hidden-zone rules while still allowing direct operator sight.
    function shouldDrawObject(obj) {
      if (!obj || !obj.hiddenZone) return true;
      if (deps.cameraHack && deps.cameraHack.isRevealed(obj)) return true;
      if (deps.visibility.hiddenObjectVisible(obj)) {
        if (deps.cameraHack && deps.cameraHack.discoverZone) deps.cameraHack.discoverZone(obj.hiddenZone);
        return true;
      }
      return false;
    }

    // Draws one unit body, facing marker, and label.
    function drawUnit(unit, fill, label, isOperator) {
      if (drawSceneUnit(unit, label, isOperator)) return;
      if (drawGameplayUnit(unit, label, isOperator)) return;
      ctx.save();
      ctx.translate(unit.x, unit.y);
      ctx.rotate(isOperator ? unit.aim : unit.angle);
      ctx.fillStyle = fill;
      ctx.strokeStyle = unit.id === runtime.state.selectedId ? colors.selected : "#111";
      ctx.lineWidth = unit.id === runtime.state.selectedId ? 3 : 2;
      const radius = deps.geometry.scaledRadius(unit);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isOperator ? colors.opDark : "#421d1d";
      ctx.beginPath();
      ctx.moveTo(radius + 8, 0);
      ctx.lineTo(3, -5);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = colors.text;
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, unit.x, unit.y - radius - 8);
    }

    // Returns optional scene-source image metadata for image-backed temporary levels.
    function sceneSource() {
      // return runtime.state && runtime.state.level ? runtime.state.level.sceneSource : null;
      return null;
    }

    // Returns the currently selected pixel-art style.
    function pixelArtStyle() {
      // return runtime.pixelArtStyle === "geometry" || runtime.pixelArtStyle === "v2" ? runtime.pixelArtStyle : "v1";
      return "geometry";
    }

    // Resolves a gameplay sprite key for the selected pixel-art style.
    function spriteSource(key) {
      // const style = pixelArtStyle();
      // if (style === "geometry") return "";
      // if (style === "v2") return Object.prototype.hasOwnProperty.call(v2Sprites, key) ? v2Sprites[key] : "";
      // return v1Sprites[key] || "";
      return "";
    }

    // Retrieves and begins loading an image, returning null until it is drawable.
    function loadImage(src) {
      // if (pixelArtStyle() === "geometry") return null;
      // if (!src) return null;
      // if (!imageCache.has(src)) {
      //   const image = new Image();
      //   image.src = src;
      //   imageCache.set(src, image);
      // }
      // return imageCache.get(src);
      return null;
    }

    // Resolves PDF-capable visual descriptors to the drawable browser image fallback.
    function resolveVisualSource(source) {
      if (!source) return "";
      if (typeof source === "string") return source;
      return source.fallback || source.image || "";
    }

    // Draws an image fitted into a rectangle, returning false while unavailable.
    function drawImageInRect(source, x, y, w, h) {
      const image = loadImage(resolveVisualSource(source));
      if (!image || !image.complete || !image.naturalWidth) return false;
      const fit = typeof source === "object" ? source.fit : "stretch";
      if (fit === "contain" || fit === "cover") {
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const boxRatio = w / h;
        const useWidth = fit === "cover" ? imageRatio < boxRatio : imageRatio > boxRatio;
        const drawW = useWidth ? w : h * imageRatio;
        const drawH = useWidth ? w / imageRatio : h;
        ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      } else {
        ctx.drawImage(image, x, y, w, h);
      }
      return true;
    }

    // Tiles a single PNG inside a rectangle, preserving crisp pixel edges.
    function drawTiledImage(source, x, y, w, h, tileW, tileH) {
      const image = loadImage(resolveVisualSource(source));
      if (!image || !image.complete || !image.naturalWidth) return false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      for (let drawY = y; drawY < y + h; drawY += tileH) {
        for (let drawX = x; drawX < x + w; drawX += tileW) {
          ctx.drawImage(image, drawX, drawY, tileW, tileH);
        }
      }
      ctx.restore();
      return true;
    }

    // Draws a cropped sprite-sheet region stretched into a destination rectangle.
    function drawSpriteInRect(source, crop, x, y, w, h) {
      const image = loadImage(source);
      if (!image || !image.complete || !image.naturalWidth || !crop) return false;
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
      return true;
    }

    // Draws a cropped sprite centered and optionally rotated.
    function drawSpriteCentered(source, crop, center, w, h, angle) {
      const image = loadImage(source);
      if (!image || !image.complete || !image.naturalWidth || !crop) return false;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle || 0);
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, -w / 2, -h / 2, w, h);
      ctx.restore();
      return true;
    }

    // Draws horizontal sprite art into vertical rectangles by rotating around center.
    function drawOrientedSpriteInRect(source, crop, box, orientation) {
      if (orientation !== "vertical") return drawSpriteInRect(source, crop, box.x, box.y, box.w, box.h);
      const image = loadImage(source);
      if (!image || !image.complete || !image.naturalWidth || !crop) return false;
      const center = deps.geometry.rectCenter(box);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, -box.h / 2, -box.w / 2, box.h, box.w);
      ctx.restore();
      return true;
    }

    // Draws a rotated sprite centered on a rectangle.
    function drawImageCentered(source, center, w, h, angle) {
      const image = loadImage(resolveVisualSource(source));
      if (!image || !image.complete || !image.naturalWidth) return false;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle || 0);
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
      ctx.restore();
      return true;
    }

    // Converts gameplay direction angles to source art authored facing upward.
    function facingUpSpriteAngle(angle) {
      return (angle || 0) + Math.PI / 2;
    }

    // Draws a generic gameplay wall sprite based on authored orientation.
    function drawGameplayWall(wall) {
      const squareish = Math.abs(wall.w - wall.h) <= Math.min(wall.w, wall.h) * 0.35;
      const source = squareish
        ? sprites.wallCorner
        : (Math.max(wall.w, wall.h) <= 32 ? sprites.wallEndCap : (wall.w >= wall.h ? sprites.wallHorizontal : sprites.wallVertical));
      return drawImageInRect(source, wall.x, wall.y, wall.w, wall.h);
    }

    // Draws a pixel frame behind room labels while keeping authored label text.
    function drawLabelFrame(label) {
      const textWidth = Math.max(76, Math.min(220, ctx.measureText(label.text || "").width + 28));
      return drawSpriteInRect(sprites.labelFrame, null, label.x - textWidth / 2, label.y - 16, textWidth, 30)
        || drawImageInRect(sprites.labelFrame, label.x - textWidth / 2, label.y - 16, textWidth, 30);
    }

    // Draws windows with sprite states and broken-glass overlay.
    function drawGameplayWindow(win, box) {
      const vertical = win.orientation === "vertical";
      const source = win.state === "broken"
        ? (vertical ? sprites.windowBrokenVertical : sprites.windowBrokenHorizontal)
        : (win.state === "open" ? (vertical ? sprites.windowOpenVertical : sprites.windowOpenHorizontal) : (vertical ? sprites.windowClosedVertical : sprites.windowClosedHorizontal));
      const drawn = drawImageInRect(source, box.x, box.y, box.w, box.h);
      if (drawn && win.state === "broken") {
        const size = Math.max(box.w, box.h) * 1.55;
        drawImageCentered(sprites.glassBreak, deps.geometry.rectCenter(box), size, size, 0);
      }
      return drawn;
    }

    // Draws a small text label over large sprite-backed interactables.
    function drawSmallObjectLabel(text, box) {
      ctx.fillStyle = "#eef3ef";
      ctx.font = "900 9px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
    }

    // Draws a camera label badge over the camera sprite.
    function drawCameraLabel(camera, revealed) {
      const label = camera.label || camera.id;
      const y = camera.y - 24;
      const drawn = drawImageCentered(sprites.cameraLabel, { x: camera.x, y }, 48, 24, 0);
      ctx.fillStyle = revealed ? colors.success : colors.cyan;
      ctx.font = "900 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, camera.x, y + 0.5);
      return drawn;
    }

    // Selects an enemy sprite based on its current behavior state.
    function enemySprite(enemy) {
      if (enemy.down || enemy.status === "down") return sprites.enemyDown;
      if (enemy.status === "alert" || enemy.targetId) return sprites.enemyAlert;
      if (enemy.status === "suspicious" || enemy.status === "search" || enemy.status === "return") return sprites.enemySuspicious;
      return sprites.enemy;
    }

    // Draws normal and digital doors with their respective sprite sheets.
    function drawGameplayDoor(door, box, center) {
      const digital = deps.geometry.isDigitalLockDoor(door);
      const vertical = door.orientation === "vertical";
      const source = digital
        ? (vertical ? sprites.digitalDoorClosedVertical : sprites.digitalDoorClosedHorizontal)
        : ((!door.state || door.state === "closed")
          ? (vertical ? sprites.doorClosedVertical : sprites.doorClosedHorizontal)
          : (vertical ? sprites.doorOpenVertical : sprites.doorOpenHorizontal));
      if (!door.state || door.state === "closed") {
        return drawImageInRect(source, box.x, box.y, box.w, box.h);
      }
      return drawImageInRect(source, box.x, box.y, box.w, box.h);
    }

    // Draws an open/breached gameplay door sprite from its hinge.
    function drawGameplayDoorOpen(door, box, source) {
      const image = loadImage(source);
      if (!image || !image.complete || !image.naturalWidth) return false;
      const vertical = door.orientation === "vertical";
      const pivot = vertical
        ? { x: box.x + box.w / 2, y: box.y }
        : { x: box.x, y: box.y + box.h / 2 };
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      if (!vertical) ctx.rotate(Math.PI / 2);
      ctx.rotate(-0.72);
      if (vertical) {
        ctx.drawImage(image, -box.w / 2, 0, box.w, box.h);
      } else {
        ctx.drawImage(image, -box.h / 2, 0, box.h, box.w);
      }
      ctx.restore();
      return true;
    }

    // Draws laptops from the closed/open/used sprite sheet states.
    function drawGameplayLaptop(laptop, box) {
      const hack = runtime.state.cameraHack;
      const overlayForThisLaptop = runtime.laptopOpen && runtime.activeLaptopId === laptop.id;
      const used = hack && hack.started;
      const source = overlayForThisLaptop ? sprites.laptopOpen : (used ? sprites.laptopUsed : sprites.laptopClosed);
      const image = loadImage(source);
      const height = image && image.complete && image.naturalWidth ? Math.max(box.h, box.w * (image.naturalHeight / image.naturalWidth)) : box.h;
      const y = box.y + (box.h - height) / 2;
      const drawn = drawImageInRect(source, box.x, y, box.w, height);
      if (drawn) drawSmallObjectLabel(laptop.label || "LAPTOP", box);
      return drawn;
    }

    // Draws the VIP objective sprite and preserves secured/harmed outline feedback.
    function drawGameplayObjective(obj, radius) {
      const size = radius * 3.2;
      const source = obj.secured ? sprites.objectiveSecured : sprites.objective;
      const drawn = drawImageCentered(source, obj, size, size, 0);
      if (drawn) {
        ctx.strokeStyle = obj.secured ? colors.success : (obj.harmed ? colors.enemy : "#5d5330");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, radius + 4, 0, twoPi);
        ctx.stroke();
      }
      return drawn;
    }

    // Draws operator/enemy sprites with existing rotation and selected outline behavior.
    function drawGameplayUnit(unit, label, isOperator) {
      const radius = deps.geometry.scaledRadius(unit);
      const moving = Boolean(unit.manualInput || (unit.path && unit.path.length) || (unit.vx || unit.vy));
      const source = isOperator
        ? (unit.down ? sprites.operatorDown : (moving ? sprites.operatorMoving : sprites.operator))
        : enemySprite(unit);
      const drawn = drawImageCentered(source, unit, radius * 3.5, radius * 3.5, facingUpSpriteAngle(isOperator ? unit.aim : unit.angle));
      if (!drawn) return false;
      ctx.fillStyle = colors.text;
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, unit.x, unit.y - radius - 18);
      if (unit.id === runtime.state.selectedId) {
        ctx.strokeStyle = colors.selected;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, radius + 8, 0, twoPi);
        ctx.stroke();
      }
      return true;
    }

    // Draws planned routes with pixel-art dashes and waypoint markers.
    function drawSpritePath(op) {
      const image = loadImage(sprites.routeDash);
      if (!image || !image.complete || !image.naturalWidth) return false;
      const points = [{ x: op.x, y: op.y }, ...op.path];
      for (let i = 0; i < points.length - 1; i += 1) {
        const from = points[i];
        const to = points[i + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const steps = Math.max(1, Math.floor(length / 28));
        for (let step = 1; step <= steps; step += 1) {
          const t = step / (steps + 1);
          const x = from.x + dx * t;
          const y = from.y + dy * t;
          drawImageCentered(sprites.routeDash, { x, y }, 24, 8, angle);
        }
      }
      drawImageCentered(sprites.waypointActive, points[0], 22, 22, 0);
      for (const point of op.path) drawImageCentered(sprites.waypoint, point, 18, 18, 0);
      return true;
    }

    // Draws a bullet sprite along a shot vector.
    function drawSpriteShot(shot) {
      const dx = shot.to.x - shot.from.x;
      const dy = shot.to.y - shot.from.y;
      const length = Math.hypot(dx, dy);
      if (length <= 0) return false;
      const angle = Math.atan2(dy, dx);
      const center = { x: (shot.from.x + shot.to.x) / 2, y: (shot.from.y + shot.to.y) / 2 };
      const drawLength = Math.max(18, Math.min(54, length));
      const drawn = drawImageCentered(sprites.bullet, center, drawLength, 8, angle);
      if (drawn) {
        drawImageCentered(sprites.muzzleFlash, shot.from, 26, 26, angle);
        drawImageCentered(sprites.hitSpark, shot.to, 22, 22, angle);
      }
      return drawn;
    }

    // Draws debug rectangles with a pixel-art collision circle fallback.
    function drawDebugRect(rect) {
      return false;
    }

    // Draws large debug sight/collision circles from the debug sprite sheet.
    function drawDebugCircle(x, y, radius, crop) {
      return false;
    }

    // Replaces wall rectangles with scene-source wall images when configured.
    function drawSceneWall(wall) {
      const source = sceneSource();
      if (!source || !source.walls) return false;
      const src = wall.w >= wall.h
        ? source.walls.horizontal
        : (wall.h > 220 ? source.walls.shortVertical : source.walls.vertical);
      return drawImageInRect(src, wall.x, wall.y, wall.w, wall.h);
    }

    // Replaces door bars with state-aware scene-source door images when configured.
    function drawSceneDoor(door, box, center) {
      const source = sceneSource();
      if (!source || !source.doors) return false;
      const vertical = door.orientation === "vertical";
      const src = vertical ? source.doors.vertical : source.doors.horizontal;
      if (!door.state || door.state === "closed") {
        const angle = vertical ? 0 : Math.PI / 2;
        return drawImageCentered(src, center, box.w, box.h, angle);
      }
      return drawSceneDoorOpen(door, box, src);
    }

    // Draws an open door from a hinge point with optional x/y reflection metadata.
    function drawSceneDoorOpen(door, box, source) {
      const image = loadImage(resolveVisualSource(source));
      if (!image || !image.complete || !image.naturalWidth) return false;
      const config = typeof source === "object" ? source : {};
      const vertical = door.orientation === "vertical";
      const hingeAtEnd = config.hinge === "end";
      const pivot = vertical
        ? { x: box.x + box.w / 2, y: hingeAtEnd ? box.y + box.h : box.y }
        : { x: hingeAtEnd ? box.x + box.w : box.x, y: box.y + box.h / 2 };
      const openSign = hingeAtEnd ? -1 : 1;
      const openAngle = Number.isFinite(config.openAngle) ? config.openAngle : -0.72;
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      if (!vertical) ctx.rotate(Math.PI / 2);
      ctx.rotate(openAngle * openSign);
      ctx.scale(config.flipOpenX ? -1 : 1, config.flipOpenY ? -1 : 1);
      if (vertical) {
        ctx.drawImage(image, -box.w / 2, hingeAtEnd ? -box.h : 0, box.w, box.h);
      } else {
        ctx.drawImage(image, -box.h / 2, hingeAtEnd ? -box.w : 0, box.h, box.w);
      }
      ctx.restore();
      return true;
    }

    // Replaces the VIP marker with a scene-source image when configured.
    function drawSceneObjective(obj, radius) {
      const source = sceneSource();
      if (!source || !source.objective) return false;
      const size = radius * 2.8;
      const drawn = drawImageCentered(source.objective, obj, size, size, 0);
      if (drawn && obj.secured) {
        ctx.strokeStyle = colors.success;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, radius + 4, 0, twoPi);
        ctx.stroke();
      }
      return drawn;
    }

    // Replaces unit circles with scene-source operator/enemy images when configured.
    function drawSceneUnit(unit, label, isOperator) {
      const source = sceneSource();
      if (!source) return false;
      const list = isOperator ? source.operators : source.enemies;
      if (!Array.isArray(list) || !list.length) return false;
      const units = isOperator ? runtime.state.level.operators : runtime.state.level.enemies;
      const index = Math.max(0, units.findIndex((item) => item.id === unit.id));
      const src = list[index % list.length];
      const radius = deps.geometry.scaledRadius(unit);
      const drawn = drawImageCentered(src, unit, radius * 3.4, radius * 3.4, isOperator ? unit.aim : unit.angle);
      if (!drawn) return false;
      ctx.fillStyle = colors.text;
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, unit.x, unit.y - radius - 18);
      if (unit.id === runtime.state.selectedId) {
        ctx.strokeStyle = colors.selected;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, radius + 8, 0, twoPi);
        ctx.stroke();
      }
      return true;
    }

    // Draws active bullet tracers.
    function drawShots() {
      for (const shot of runtime.state.shots) {
        if (drawSpriteShot(shot)) continue;
        ctx.strokeStyle = shot.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shot.from.x, shot.from.y);
        ctx.lineTo(shot.to.x, shot.to.y);
        ctx.stroke();
      }
    }

    /*
    // Draws a screen-space darkness mask outside selected-operator awareness.
    function drawFog() {
      const op = deps.selectedOperator();
      if (!op || op.down) return;
      const screen = worldToScreen(op);
      const radius = deps.visibility.operatorSightRange(op) * deps.camera.getCamera().zoom;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.fillRect(0, 0, deps.canvas.width, deps.canvas.height);
      ctx.globalCompositeOperation = "destination-out";
      const gradient = ctx.createRadialGradient(screen.x, screen.y, radius * 0.4, screen.x, screen.y, radius);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, twoPi);
      ctx.fill();
      ctx.restore();
    }

    // Converts a world point into current screen space.
    function worldToScreen(point) {
      const camera = deps.camera.getCamera();
      return {
        x: (point.x - camera.x) * camera.zoom + deps.canvas.width / 2,
        y: (point.y - camera.y) * camera.zoom + deps.canvas.height / 2
      };
    }
    */

    // Draws the in-canvas selected-operator status and door hint.
    function drawHudOverlay() {
      const state = runtime.state;
      const selected = deps.selectedOperator();
      const hint = selected && !selected.down && deps.interaction ? deps.interaction.nearestHint(selected) : "";
      ctx.fillStyle = "rgba(16,18,20,0.78)";
      ctx.fillRect(22, 22, 334, hint ? 96 : 74);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(22, 22, 334, hint ? 96 : 74);
      ctx.fillStyle = colors.text;
      ctx.font = "800 18px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(deps.hasManualInput() ? "Manual Control" : (state.running ? "Executing Plan" : "Planning Hold"), 38, 50);
      ctx.fillStyle = colors.muted;
      ctx.font = "600 13px system-ui";
      const pathCount = selected ? selected.path.length : 0;
      ctx.fillText(`Selected ${state.selectedId} | Waypoints ${pathCount}`, 38, 76);
      if (hint) {
        ctx.fillStyle = colors.doorClosed;
        ctx.font = "800 12px system-ui";
        ctx.fillText(hint, 38, 98);
      }
    }

    // Draws debug collision outlines, sight ranges, and operator state text.
    function drawDebug() {
      const state = runtime.state;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      for (const rect of deps.geometry.blockingRects(state.level)) {
        if (!drawDebugRect(rect)) ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }

      for (const enemy of state.level.enemies) {
        if (enemy.down) continue;
        ctx.strokeStyle = enemy.targetId ? colors.enemy : "rgba(226,95,95,0.45)";
        if (!drawDebugCircle(enemy.x, enemy.y, enemy.sightRange, enemy.targetId ? spriteCrops.debugLarge : spriteCrops.debugMedium)) {
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.sightRange, 0, twoPi);
          ctx.stroke();
        }
      }

      ctx.fillStyle = colors.text;
      ctx.font = "600 12px monospace";
      ctx.textAlign = "left";
      let y = 120;
      for (const op of state.level.operators) {
        ctx.fillText(`${op.id} hp:${op.health.toFixed(0)} action:${op.action ? op.action.type : "none"}`, 28, y);
        y += 18;
      }
      ctx.restore();
    }

    return {
      draw
    };
  }

  window.RenderSystem = { create };
}());
