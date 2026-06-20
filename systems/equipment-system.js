"use strict";

(function () {
  // Builds equipment loading, validation, loadout, and board rendering helpers.
  function create(deps) {
    const runtime = deps.runtime;
    const weapons = deps.weapons;
    const armors = deps.armors;
    const backpacks = deps.backpacks;
    const operatorLoadouts = deps.operatorLoadouts;
    const operatorArmorLoadouts = deps.operatorArmorLoadouts;
    const operatorBackpackLoadouts = deps.operatorBackpackLoadouts;
    const enemyLoadouts = deps.enemyLoadouts;
    const enemyArmorLoadouts = deps.enemyArmorLoadouts;
    const enemyPersonalityLoadouts = deps.enemyPersonalityLoadouts;
    const elements = deps.elements;
    let lastHealthBoardHtml = "";
    let lastEnemyLoadoutHtml = "";
    let lastEnemyPersonalityHtml = "";
    const enemyPersonalities = {
      aggressive: "Acts on the desire to damage operators.",
      calm: "Defends logically, holds position, and may retreat when the defense collapses.",
      loyal: "Commits to winning the defense and will not retreat when teammates fall.",
      violent: "Attacks with little concern for the health of teammates or itself."
    };
    /*
    const equipmentImages = {
      "no-weapon": "pixel-art-no-weapon-001.png",
      rifle: "pixel-art-rifle-001.png",
      smg: "pixel-art-smg-001.png",
      pistol: "pixel-art-pistol-001.png",
      melee: "pixel-art-melee-001.png",
      "advanced-carbine": "pixel-art-advanced-carbine-001.png",
      "compact-pdw": "pixel-art-compact-pdw-001.png",
      "marksman-pistol": "pixel-art-pistol-001.png",
      "no-armor": "pixel-art-no-armor-001.png",
      "light-armor": "pixel-art-light-armor-001.png",
      "medium-armor": "pixel-art-medium-armor-001.png",
      "heavy-armor": "pixel-art-heavy-armor-001.png",
      "small-backpack": "pixel-art-small-backpack-001.png",
      "medium-backpack": "pixel-art-medium-backpack-001.png",
      "large-backpack": "pixel-art-large-backpack-001.png"
    };
    */
    const equipmentImages = {};

    // Resolves a weapon definition, falling back to rifle.
    function weaponById(id) {
      return weapons.get(id) || weapons.get("rifle");
    }

    // Normalizes unknown weapon IDs to the default rifle.
    function validWeaponId(id) {
      return weapons.has(id) ? id : "rifle";
    }

    // Resolves an armor definition, falling back to light armor.
    function armorById(id) {
      return armors.get(id) || armors.get("light-armor");
    }

    // Normalizes unknown armor IDs to the default light armor.
    function validArmorId(id) {
      return armors.has(id) ? id : "light-armor";
    }

    // Resolves a backpack definition, falling back to no backpack.
    function backpackById(id) {
      return backpacks.get(id) || backpacks.get("no-backpack");
    }

    // Normalizes unknown backpack IDs to the default no backpack.
    function validBackpackId(id) {
      return backpacks.has(id) ? id : "no-backpack";
    }

    // Normalizes enemy personality values to the defensive default.
    function validEnemyPersonality(id) {
      return Object.prototype.hasOwnProperty.call(enemyPersonalities, id) ? id : "calm";
    }

    // Gets the saved enemy weapon choices for the active level.
    function currentLevelWeaponLoadouts() {
      const levelId = runtime.currentLevelMeta ? runtime.currentLevelMeta.id : "default";
      if (!enemyLoadouts[levelId]) enemyLoadouts[levelId] = {};
      return enemyLoadouts[levelId];
    }

    // Gets the saved enemy armor choices for the active level.
    function currentLevelArmorLoadouts() {
      const levelId = runtime.currentLevelMeta ? runtime.currentLevelMeta.id : "default";
      if (!enemyArmorLoadouts[levelId]) enemyArmorLoadouts[levelId] = {};
      return enemyArmorLoadouts[levelId];
    }

    // Gets the saved enemy personality choices for the active level.
    function currentLevelPersonalityLoadouts() {
      const levelId = runtime.currentLevelMeta ? runtime.currentLevelMeta.id : "default";
      if (!enemyPersonalityLoadouts[levelId]) enemyPersonalityLoadouts[levelId] = {};
      return enemyPersonalityLoadouts[levelId];
    }

    // Produces weapon selector options for loadout controls.
    function weaponOptionsHtml(selectedId) {
      return deps.weaponOptions.map((meta) => {
        const weapon = weapons.get(meta.id);
        if (!weapon) return "";
        const selected = weapon.id === selectedId ? " selected" : "";
        return `<option value="${weapon.id}"${selected}>${weapon.name}</option>`;
      }).join("");
    }

    // Produces armor selector options for loadout controls.
    function armorOptionsHtml(selectedId) {
      return deps.armorOptions.map((meta) => {
        const armor = armors.get(meta.id);
        if (!armor) return "";
        const selected = armor.id === selectedId ? " selected" : "";
        return `<option value="${armor.id}"${selected}>${armor.name}</option>`;
      }).join("");
    }

    // Produces backpack selector options for loadout controls.
    function backpackOptionsHtml(selectedId) {
      return deps.backpackOptions.map((meta) => {
        const backpack = backpacks.get(meta.id);
        if (!backpack) return "";
        const selected = backpack.id === selectedId ? " selected" : "";
        return `<option value="${backpack.id}"${selected}>${backpack.name}</option>`;
      }).join("");
    }

    // Produces enemy personality selector options with hover descriptions.
    function enemyPersonalityOptionsHtml(selectedId) {
      return Object.entries(enemyPersonalities).map(([id, description]) => {
        const selected = id === selectedId ? " selected" : "";
        return `<option value="${id}" title="${escapeAttr(description)}"${selected}>${id.toUpperCase()}</option>`;
      }).join("");
    }

    // Resolves the static pixel-art image for any equipment id.
    function equipmentImagePath(id) {
      // if (runtime.pixelArtStyle === "geometry") return "";
      // const file = equipmentImages[id];
      // if (!file) return "";
      // const base = runtime.pixelArtStyle === "v2" ? "docs/images/pixel-art-v2" : "docs/images/equipments";
      // return `${base}/${file}`;
      return "";
    }

    // Renders a compact static equipment image with a text fallback.
    function equipmentIconHtml(id, label, className = "") {
      // const src = equipmentImagePath(id);
      // const safeLabel = escapeAttr(label || id || "Equipment");
      // const classes = ["equipment-icon", className].filter(Boolean).join(" ");
      /*
      if (src) {
        return `<img class="${classes}" src="${src}" alt="${safeLabel}" loading="lazy" draggable="false" onerror="this.replaceWith(document.createTextNode('${fallbackInitial(label || id)}'))">`;
      }
      return `<span class="${classes} equipment-icon-fallback" aria-label="${safeLabel}">${fallbackInitial(label || id)}</span>`;
      */
      return "";
    }

    // Loads all weapon and armor JSON definitions from the equipment folder.
    async function loadEquipment() {
      weapons.clear();
      armors.clear();
      backpacks.clear();
      const loadedWeapons = await Promise.all(deps.weaponOptions.map(async (meta) => {
        const response = await fetch(meta.file, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Unable to load ${meta.file}: ${response.status}`);
        }
        return response.json();
      }));
      const loadedArmors = await Promise.all(deps.armorOptions.map(async (meta) => {
        const response = await fetch(meta.file, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Unable to load ${meta.file}: ${response.status}`);
        }
        return response.json();
      }));
      const loadedBackpacks = await Promise.all(deps.backpackOptions.map(async (meta) => {
        const response = await fetch(meta.file, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Unable to load ${meta.file}: ${response.status}`);
        }
        return response.json();
      }));
      for (const weapon of loadedWeapons) {
        weapons.set(weapon.id, weapon);
      }
      for (const armor of loadedArmors) {
        armors.set(armor.id, armor);
      }
      for (const backpack of loadedBackpacks) {
        backpacks.set(backpack.id, backpack);
      }
      populateEquipmentSelects();
    }

    // Fills the operator weapon and armor select elements.
    function populateEquipmentSelects() {
      elements.weaponSelect.innerHTML = "";
      for (const meta of deps.weaponOptions) {
        const weapon = weapons.get(meta.id);
        if (!weapon) continue;
        const option = document.createElement("option");
        option.value = weapon.id;
        const locked = isLockedForOperator(weapon.id, weapon);
        option.disabled = locked;
        option.textContent = locked ? `${weapon.name} (Privilege ${weapon.unlockPrivilege || 2})` : weapon.name;
        elements.weaponSelect.append(option);
      }
      elements.armorSelect.innerHTML = "";
      for (const meta of deps.armorOptions) {
        const armor = armors.get(meta.id);
        if (!armor) continue;
        const option = document.createElement("option");
        option.value = armor.id;
        const locked = isLockedForOperator(armor.id, armor);
        option.disabled = locked;
        option.textContent = locked ? `${armor.name} (Privilege 2)` : armor.name;
        elements.armorSelect.append(option);
      }
      elements.backpackSelect.innerHTML = "";
      for (const meta of deps.backpackOptions) {
        const backpack = backpacks.get(meta.id);
        if (!backpack) continue;
        const option = document.createElement("option");
        option.value = backpack.id;
        option.textContent = backpack.name;
        elements.backpackSelect.append(option);
      }
    }

    // Renders enemy weapon and armor controls in the settings panel.
    function renderEnemyLoadouts() {
      const state = runtime.state;
      if (!state) {
        if (lastEnemyLoadoutHtml) {
          elements.enemyLoadoutList.innerHTML = "";
          lastEnemyLoadoutHtml = "";
        }
        return;
      }

      const savedWeapons = currentLevelWeaponLoadouts();
      const savedArmors = currentLevelArmorLoadouts();
      const html = state.level.enemies.map((enemy) => {
        const selectedWeaponId = validWeaponId(savedWeapons[enemy.id] || enemy.weaponId || "rifle");
        const selectedArmorId = validArmorId(savedArmors[enemy.id] || enemy.armorId || "light-armor");
        const weapon = weaponById(selectedWeaponId);
        const armor = armorById(selectedArmorId);
        return `
          <div class="enemy-loadout-row">
            <strong>${enemy.id}</strong>
            <label class="plain-select-row">
              <select data-enemy-weapon-id="${enemy.id}" aria-label="${enemy.id} weapon">
                ${weaponOptionsHtml(selectedWeaponId)}
              </select>
            </label>
            <label class="plain-select-row">
              <select data-enemy-armor-id="${enemy.id}" aria-label="${enemy.id} armor">
                ${armorOptionsHtml(selectedArmorId)}
              </select>
            </label>
          </div>
        `;
      }).join("");

      if (html !== lastEnemyLoadoutHtml) {
        elements.enemyLoadoutList.innerHTML = html || "<p class=\"empty-note\">No enemies in this level.</p>";
        lastEnemyLoadoutHtml = html;
      }
    }

    // Renders per-enemy personality controls in the Dev Setting page.
    function renderEnemyPersonalities() {
      const state = runtime.state;
      if (!elements.enemyPersonalityList) return;
      if (!state) {
        const emptyHtml = "<p class=\"empty-note\">No enemies in this level.</p>";
        if (lastEnemyPersonalityHtml !== emptyHtml) {
          elements.enemyPersonalityList.innerHTML = emptyHtml;
          lastEnemyPersonalityHtml = emptyHtml;
        }
        return;
      }

      const savedPersonalities = currentLevelPersonalityLoadouts();
      const html = state.level.enemies.map((enemy) => {
        const enemyLabel = enemy.name || enemy.id || "Enemy";
        const selectedPersonality = validEnemyPersonality(savedPersonalities[enemy.id] || enemy.personality || "calm");
        const description = enemyPersonalities[selectedPersonality];
        return `
          <div class="enemy-personality-row">
            <strong>${escapeText(enemyLabel)}</strong>
            <label class="plain-select-row enemy-personality-picker" title="${escapeAttr(description)}">
              <select data-enemy-personality-id="${escapeAttr(enemy.id)}" aria-label="${escapeAttr(enemyLabel)} enemy type" title="${escapeAttr(description)}">
                ${enemyPersonalityOptionsHtml(selectedPersonality)}
              </select>
            </label>
            <span class="enemy-personality-hint" title="${escapeAttr(description)}">${escapeText(description)}</span>
          </div>
        `;
      }).join("");

      const output = html || "<p class=\"empty-note\">No enemies in this level.</p>";
      if (output !== lastEnemyPersonalityHtml) {
        elements.enemyPersonalityList.innerHTML = output;
        lastEnemyPersonalityHtml = output;
      }
    }

    // Applies an enemy weapon choice and resets its firing timers.
    function applyEnemyWeapon(enemyId, weaponId) {
      const selectedWeaponId = validWeaponId(weaponId);
      currentLevelWeaponLoadouts()[enemyId] = selectedWeaponId;
      const state = runtime.state;
      if (!state) return;
      const enemy = state.level.enemies.find((item) => item.id === enemyId);
      if (!enemy) return;
      enemy.weaponId = selectedWeaponId;
      enemy.fireTimer = 0;
      enemy.reaction = 0;
      enemy.sightRange = Math.max(190, weaponById(selectedWeaponId).range);
      state.message = `${enemy.id} equipped ${weaponById(selectedWeaponId).name}`;
      deps.updateHud();
    }

    // Applies enemy armor values and speed effects.
    function applyEnemyArmor(enemyId, armorId) {
      const selectedArmorId = validArmorId(armorId);
      currentLevelArmorLoadouts()[enemyId] = selectedArmorId;
      const state = runtime.state;
      if (!state) return;
      const enemy = state.level.enemies.find((item) => item.id === enemyId);
      if (!enemy) return;
      const armor = armorById(selectedArmorId);
      enemy.armorId = selectedArmorId;
      enemy.maxArmor = armor.armor;
      enemy.armor = armor.armor;
      enemy.speed = (enemy.baseSpeed || 34) * armor.speedMultiplier;
      state.message = `${enemy.id} equipped ${armor.name}`;
      deps.updateHud();
    }

    // Applies an enemy personality immediately and stores it for this level.
    function applyEnemyPersonality(enemyId, personalityId) {
      const selectedPersonality = validEnemyPersonality(personalityId);
      currentLevelPersonalityLoadouts()[enemyId] = selectedPersonality;
      const state = runtime.state;
      if (!state) return;
      const enemy = state.level.enemies.find((item) => item.id === enemyId);
      if (!enemy) return;
      enemy.personality = selectedPersonality;
      if (selectedPersonality === "calm" && enemy.status === "suspicious") {
        enemy.suspicionTimer = Math.min(enemy.suspicionTimer || 0, 4.5);
      }
      state.message = `${enemy.id} type set to ${selectedPersonality.toUpperCase()}`;
      lastEnemyPersonalityHtml = "";
      renderEnemyPersonalities();
      deps.updateHud();
    }

    // Applies operator armor values, speed effects, and saved loadout state.
    function applyOperatorArmor(op, armorId) {
      const selectedArmorId = validArmorId(armorId);
      const armor = armorById(selectedArmorId);
      if (isLockedForOperator(selectedArmorId, armor)) {
        runtime.state.message = `${armor.name} requires privilege 2`;
        elements.armorSelect.value = validArmorId(op.armorId);
        deps.updateHud();
        return;
      }
      op.armorId = selectedArmorId;
      op.maxArmor = armor.armor;
      op.armor = armor.armor;
      const backpack = backpackById(op.backpackId);
      op.speed = (op.baseSpeed || 92) * armor.speedMultiplier * (backpack.speedMultiplier || 1);
      if (!runtime.state.level.forceLoadouts) operatorArmorLoadouts[op.id] = selectedArmorId;
      runtime.state.message = `${op.id} equipped ${armor.name}`;
      deps.updateHud();
    }

    // Applies an operator weapon choice and refreshes ammunition.
    function applyOperatorWeapon(op, weaponId) {
      const selectedWeaponId = validWeaponId(weaponId);
      const weapon = weaponById(selectedWeaponId);
      if (isLockedForOperator(selectedWeaponId, weapon)) {
        runtime.state.message = `${weapon.name} requires privilege ${weapon.unlockPrivilege || 2}`;
        elements.weaponSelect.value = validWeaponId(op.weaponId);
        deps.updateHud();
        return;
      }
      op.weaponId = selectedWeaponId;
      op.fireTimer = 0;
      op.reaction = 0;
      if (!runtime.state.level.forceLoadouts) operatorLoadouts[op.id] = selectedWeaponId;
      deps.shooting.resetAmmo(op);
      runtime.state.message = `${op.id} equipped ${weaponById(op.weaponId).name}`;
      deps.updateHud();
    }

    // Applies an operator backpack choice and refreshes ammo and storage.
    function applyOperatorBackpack(op, backpackId) {
      const selectedBackpackId = validBackpackId(backpackId);
      const backpack = backpackById(selectedBackpackId);
      const armor = armorById(op.armorId);
      const carried = (op.inventory.items || []).filter(Boolean);
      if (carried.length > backpack.slots) {
        runtime.state.message = "Backpack too full";
        elements.backpackSelect.value = validBackpackId(op.backpackId);
        deps.updateHud();
        return;
      }
      op.backpackId = selectedBackpackId;
      op.speed = (op.baseSpeed || 92) * armor.speedMultiplier * (backpack.speedMultiplier || 1);
      op.inventory.slots = backpack.slots;
      op.inventory.items = Array.from({ length: backpack.slots }, (_, index) => carried[index] || null);
      if (!runtime.state.level.forceLoadouts) operatorBackpackLoadouts[op.id] = selectedBackpackId;
      deps.shooting.resetAmmo(op);
      runtime.state.message = `${op.id} equipped ${backpack.name}`;
      deps.updateHud();
    }

    // Reports whether an operator loadout choice is locked by privilege.
    function isLockedForOperator(id, item) {
      if (!deps.progression) return false;
      return !deps.progression.isEquipmentUnlocked(id, item);
    }

    // Updates the selected operator loadout panel and equipment stats.
    function renderLoadoutPanel() {
      const state = runtime.state;
      if (!state) {
        elements.weaponSelect.disabled = true;
        elements.armorSelect.disabled = true;
        elements.backpackSelect.disabled = true;
        elements.selectedOperatorLabel.textContent = "Selected Operator";
        if (elements.settingsSelectedOperatorLabel) elements.settingsSelectedOperatorLabel.textContent = "Selected Operator Weapon";
        elements.weaponStats.textContent = "Loading...";
        renderWeaponPixelPreview(null);
        renderAmmoBoard(null);
        return;
      }
      const op = deps.selectedOperator();
      elements.weaponSelect.disabled = !op || op.down || state.gameOver;
      elements.armorSelect.disabled = !op || op.down || state.gameOver;
      elements.backpackSelect.disabled = !op || op.down || state.gameOver;
      elements.selectedOperatorLabel.textContent = op ? `${op.id} Weapon` : "Selected Operator";
      if (elements.settingsSelectedOperatorLabel) elements.settingsSelectedOperatorLabel.textContent = op ? `${op.id} Weapon` : "Selected Operator Weapon";

      if (!op) {
        elements.weaponStats.textContent = "No operator selected.";
        renderWeaponPixelPreview(null);
        renderAmmoBoard(null);
        return;
      }

      elements.weaponSelect.value = validWeaponId(op.weaponId);
      elements.armorSelect.value = validArmorId(op.armorId);
      elements.backpackSelect.value = validBackpackId(op.backpackId);
      const weapon = weaponById(op.weaponId);
      const armor = armorById(op.armorId);
      const backpack = backpackById(op.backpackId);
      if (!weapon || !armor || !backpack) {
        elements.weaponStats.textContent = "Equipment data unavailable.";
        renderWeaponPixelPreview(null);
        renderAmmoBoard(null);
        return;
      }

      renderWeaponPixelPreview(weapon.id);
      renderWeaponTooltip(op, weapon, armor, backpack);
      renderAmmoBoard(op);
      elements.weaponStats.innerHTML = `
        <div class="loadout-text-strip" aria-label="Selected equipment">
          <span>Weapon: <strong>${weapon.name}</strong></span>
          <span>Armor: <strong>${armor.name}</strong></span>
          <span>Backpack: <strong>${backpack.name}</strong></span>
        </div>
        <div>${weapon.role}</div>
        <div class="empty-note">Hover weapon art for equipment details.</div>
      `;
    }

    // Adds hidden hover details to the weapon pixel preview.
    function renderWeaponTooltip(op, weapon, armor, backpack) {
      if (!elements.weaponPixelPreview || !op || !weapon || !armor || !backpack) return;
      const details = `
        <div class="weapon-tooltip" role="tooltip">
          <div class="weapon-stat-row"><span>Range</span><strong>${weapon.range}</strong></div>
          <div class="weapon-stat-row"><span>Damage</span><strong>${weapon.damage}</strong></div>
          <div class="weapon-stat-row"><span>Fire Rate</span><strong>${weapon.canFire === false ? "None" : `${(1 / weapon.fireInterval).toFixed(1)}/s`}</strong></div>
          <div class="weapon-stat-row"><span>Magazine</span><strong>${weapon.magSize}</strong></div>
          <div class="weapon-stat-row"><span>Armor</span><strong>${armor.armor}</strong></div>
          <div class="weapon-stat-row"><span>Backpack</span><strong>${backpack.slots} slots</strong></div>
          <div class="weapon-stat-row"><span>Mobility</span><strong>${Math.round(armor.speedMultiplier * (backpack.speedMultiplier || 1) * 100)}%</strong></div>
        </div>
      `;
      elements.weaponPixelPreview.innerHTML += details;
    }

    // Renders magazine and carried bullet indicators for the selected operator.
    function renderAmmoBoard(op) {
      if (!elements.ammoBoard) return;
      if (!op || !op.ammo) {
        elements.ammoBoard.innerHTML = "<span>No ammo data</span>";
        return;
      }
      const weapon = weaponById(op.weaponId);
      if (weapon.canFire === false || weapon.attackType === "melee") {
        elements.ammoBoard.innerHTML = `
          <div class="ammo-count">${weapon.attackType === "melee" ? "Melee weapon" : "Unarmed"}</div>
        `;
        return;
      }
      const bullets = Array.from({ length: weapon.magSize || 20 }, (_, index) => {
        const filled = index < op.ammo.magazine ? " filled" : "";
        return `<span class="bullet${filled}" aria-hidden="true"></span>`;
      }).join("");
      elements.ammoBoard.innerHTML = `
        <div class="bullet-grid">${bullets}</div>
        <div class="ammo-count">${weapon.canFire === false ? "Unarmed" : `${op.ammo.magazine}/${weapon.magSize} | Reserve ${op.ammo.reserve}`}</div>
        ${op.ammo.reloading ? "<div class=\"reload-label\">Reloading</div>" : ""}
      `;
    }

    // Renders the selected weapon with static pixel-art image assets.
    function renderWeaponPixelPreview(weaponId) {
      if (!weaponId || !elements.weaponPixelPreview) {
        elements.weaponPixelPreview.innerHTML = "<span class=\"weapon-pixel-empty\">No Weapon</span>";
        elements.weaponPixelPreview.classList.add("empty");
        return;
      }
      const weapon = weaponById(weaponId);
      const art = weaponPixelBlockHtml(weaponId, weapon);
      elements.weaponPixelPreview.classList.remove("empty");
      elements.weaponPixelPreview.innerHTML = `
        <div class="weapon-image-frame" role="img" aria-label="${weapon ? weapon.name : weaponId} pixel preview">
          ${art}
        </div>
      `;
    }

    // Renders operator armor, health, weapon, and alive/down state cards.
    function renderHealthBoard() {
      const state = runtime.state;
      if (!state) {
        if (lastHealthBoardHtml) {
          elements.operatorHealthBoard.innerHTML = "";
          lastHealthBoardHtml = "";
        }
        return;
      }

      const selected = deps.selectedOperator();
      const visibleOperators = runtime.showAllHealth
        ? state.level.operators
        : state.level.operators.filter((op) => op.id === state.selectedId || op.movedBefore);
      const html = visibleOperators.map((op) => {
        const weapon = weaponById(op.weaponId);
        const health = Math.max(0, Math.min(100, op.health));
        const armorPercent = op.maxArmor > 0 ? Math.max(0, Math.min(100, (op.armor / op.maxArmor) * 100)) : 0;
        const classes = [
          "operator-card",
          op.id === state.selectedId ? "selected" : "",
          op.down ? "down" : ""
        ].filter(Boolean).join(" ");
        return `
          <button class="${classes}" type="button" data-operator-id="${op.id}">
            <span class="operator-row">
              <strong>${op.id}</strong>
              <span>${op.down ? "Down" : "Alive"}</span>
            </span>
            <span class="health-meter" aria-hidden="true">
              <span class="armor-fill" style="width: ${armorPercent}%"></span>
            </span>
            <span class="operator-row">
              <span class="operator-equipment-label">${armorById(op.armorId).name}</span>
              <span>${op.armor.toFixed(0)} AR</span>
            </span>
            <span class="health-meter" aria-hidden="true">
              <span class="health-fill" style="width: ${health}%"></span>
            </span>
            <span class="operator-row">
              <span class="operator-equipment-label">${weapon ? weapon.name : "Rifle"}</span>
              <span>${health.toFixed(0)} HP</span>
            </span>
          </button>
        `;
      }).join("");

      if (html !== lastHealthBoardHtml) {
        elements.operatorHealthBoard.innerHTML = html || (selected ? "" : "<p class=\"empty-note\">No operator selected.</p>");
        lastHealthBoardHtml = html;
      }
      if (elements.showAllHealthButton) {
        elements.showAllHealthButton.textContent = runtime.showAllHealth ? "Selected" : "Show All";
      }
    }

    return {
      weaponById,
      validWeaponId,
      armorById,
      validArmorId,
      backpackById,
      validBackpackId,
      validEnemyPersonality,
      currentLevelWeaponLoadouts,
      currentLevelArmorLoadouts,
      currentLevelPersonalityLoadouts,
      equipmentImagePath,
      equipmentIconHtml,
      weaponOptionsHtml,
      armorOptionsHtml,
      backpackOptionsHtml,
      loadEquipment,
      populateEquipmentSelects,
      renderEnemyLoadouts,
      renderEnemyPersonalities,
      applyEnemyWeapon,
      applyEnemyArmor,
      applyEnemyPersonality,
      applyOperatorWeapon,
      applyOperatorArmor,
      applyOperatorBackpack,
      renderLoadoutPanel,
      renderHealthBoard,
      renderWeaponPixelPreview,
      renderWeaponTooltip,
      renderAmmoBoard
    };

    // Builds CSS pixel-block weapon art without PNG assets.
    function weaponPixelBlockHtml(id, weapon) {
      const type = pixelWeaponType(id, weapon);
      const label = escapeAttr(weapon ? weapon.name : id || "Weapon");
      if (type === "none") {
        return `<div class="weapon-pixel-art weapon-pixel-art-none" aria-label="${label}"><span>No weapon</span></div>`;
      }
      return `
        <div class="weapon-pixel-art weapon-pixel-art-${type}" aria-label="${label}">
          ${Array.from({ length: 60 }, (_, index) => `<span class="weapon-pixel-cell weapon-pixel-cell-${index}" aria-hidden="true"></span>`).join("")}
        </div>
      `;
    }

    // Maps equipment ids to CSS pixel-block weapon art classes.
    function pixelWeaponType(id, weapon) {
      if (!id || id === "no-weapon" || weapon?.canFire === false && weapon?.attackType !== "melee") return "none";
      if (weapon?.attackType === "melee" || id === "melee") return "melee";
      if (id.includes("smg") || id.includes("pdw")) return "smg";
      if (id.includes("pistol")) return "pistol";
      return "rifle";
    }

    /*
    Geometry weapon group disabled.
    // Builds a CSS-only tactical weapon silhouette for the selected loadout.
    function weaponGeometryHtml(id, weapon) {
      const type = weaponGeometryType(id, weapon);
      const label = escapeAttr(weapon ? weapon.name : id || "Weapon");
      if (type === "none") {
        return `<div class="weapon-geometry weapon-geometry-none" aria-label="${label}"><span>No weapon</span></div>`;
      }
      return `
        <div class="weapon-geometry weapon-geometry-${type}" aria-label="${label}">
          <span class="weapon-part weapon-stock"></span>
          <span class="weapon-part weapon-body"></span>
          <span class="weapon-part weapon-barrel"></span>
          <span class="weapon-part weapon-grip"></span>
          <span class="weapon-part weapon-magazine"></span>
          <span class="weapon-part weapon-blade"></span>
          <span class="weapon-part weapon-guard"></span>
        </div>
      `;
    }

    // Maps equipment ids to reusable CSS geometry classes.
    function weaponGeometryType(id, weapon) {
      if (!id || id === "no-weapon" || weapon?.canFire === false && weapon?.attackType !== "melee") return "none";
      if (weapon?.attackType === "melee" || id === "melee") return "melee";
      if (id.includes("smg") || id.includes("pdw")) return "smg";
      if (id.includes("pistol")) return "pistol";
      return "rifle";
    }
    */
  }

  // Escapes text for safe use inside HTML attributes.
  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Escapes text for safe HTML content.
  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Returns a compact fallback character for missing image assets.
  function fallbackInitial(value) {
    return escapeAttr(String(value || "?").trim().slice(0, 1).toUpperCase() || "?");
  }

  window.EquipmentSystem = { create };
}());
