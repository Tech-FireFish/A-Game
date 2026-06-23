"use strict";

(function () {
  // Builds inventory overlays, paper pickup, and equipment-table behavior.
  function create(deps) {
    let openTableId = null;
    let draggedSlot = null;
    let selectedInventorySlot = null;

    if (deps.elements.inventoryDetails) {
      deps.elements.inventoryDetails.addEventListener("click", handleInventoryClick);
      deps.elements.inventoryDetails.addEventListener("dragstart", handleDragStart);
      deps.elements.inventoryDetails.addEventListener("dragover", handleDragOver);
      deps.elements.inventoryDetails.addEventListener("dragleave", handleDragLeave);
      deps.elements.inventoryDetails.addEventListener("drop", handleDrop);
      deps.elements.inventoryDetails.addEventListener("dragend", handleDragEnd);
    }

    // Opens the selected operator inventory overlay.
    function openInventory(options = {}) {
      const op = deps.selectedOperator();
      if (!op) return;
      ensureSlots(op);
      const requestedSlot = Number(options.selectedSlot);
      selectedInventorySlot = Number.isInteger(requestedSlot) && Boolean(op.inventory.items[requestedSlot])
        ? requestedSlot
        : null;
      deps.runtime.inventoryOpen = true;
      deps.runtime.inventoryResumeRunning = Boolean(deps.runtime.state && deps.runtime.state.running);
      if (deps.runtime.state) deps.runtime.state.running = false;
      deps.keysDown.clear();
      deps.elements.inventoryOverlay.classList.remove("hidden");
      if (deps.audio) deps.audio.play("inventory-open");
      renderInventory();
      renderExpandedHotbar();
      deps.updateHud();
    }

    // Closes the inventory overlay and restores execution if needed.
    function closeInventory() {
      if (!deps.runtime.inventoryOpen) return;
      selectedInventorySlot = null;
      deps.runtime.inventoryOpen = false;
      deps.elements.inventoryOverlay.classList.add("hidden");
      if (deps.runtime.inventoryResumeRunning && deps.runtime.state && !deps.runtime.state.gameOver) {
        deps.runtime.state.running = true;
      }
      deps.runtime.inventoryResumeRunning = false;
      if (deps.audio) deps.audio.play("inventory-close");
      renderExpandedHotbar();
      deps.updateHud();
    }

    // Renders full inventory details for the selected operator.
    function renderInventory() {
      const op = deps.selectedOperator();
      if (!op) return;
      ensureSlots(op);
      /*
      Inventory equipment summary disabled; the active inventory view is slot grid plus item detail.
      const weapon = deps.equipment.weaponById(op.weaponId);
      const armor = deps.equipment.armorById(op.armorId);
      const backpack = deps.equipment.backpackById(op.backpackId);
      */
      const columns = gridColumns(op.inventory.slots);
      const slots = op.inventory.items.map((item, index) => renderSlot(item, index)).join("");
      const actionMenu = renderInventoryActionMenu(op, columns);
      const selectedItem = selectedInventorySlot !== null && op.inventory.items[selectedInventorySlot]
        ? op.inventory.items[selectedInventorySlot]
        : firstCarriedItem(op);
      const selectedDetail = selectedItem
        ? `<strong>${escapeHtml(selectedItem.name)}</strong><span>${escapeHtml(selectedItem.text || selectedItem.type)}</span>`
        : "Empty slots can hold paper clues and future items.";
      if (deps.elements.inventoryTitle) deps.elements.inventoryTitle.textContent = `${op.id} Inventory`;
      deps.elements.inventoryDetails.innerHTML = `
        <!--
        Inventory grid summary disabled; preserve slot grid and item detail as the active inventory layout.
        Previous content: .inventory-grid equipment/ammo/slots summary.
        -->
        <div class="inventory-slot-grid${selectedInventorySlot === null ? "" : " action-menu-open"}" style="--inventory-cols: ${columns}" aria-label="${op.id} backpack slots">
          ${slots}
          ${actionMenu}
        </div>
        <div class="inventory-item-detail">
          ${selectedDetail}
        </div>
      `;
    }

    // Renders the compact sidebar inventory summary.
    function renderSummary() {
      const op = deps.selectedOperator();
      if (!op || !deps.elements.inventorySummary) {
        deps.elements.inventorySummary.innerHTML = "<p>No operator selected.</p>";
        return;
      }
      ensureSlots(op);
      const backpack = deps.equipment.backpackById(op.backpackId);
      const papers = carriedItems(op)
        .filter((item) => item.type === "paper")
        .reduce((count, item) => count + item.quantity, 0);
      deps.elements.inventorySummary.innerHTML = `
        <div class="summary-row"><span>Backpack</span><strong>${deps.equipment.equipmentIconHtml(backpack.id, backpack.name, "equipment-icon-tiny")}${backpack.name}</strong></div>
        <div class="summary-row"><span>Items</span><strong>${occupiedSlots(op)}/${op.inventory.slots}</strong></div>
        <div class="summary-row"><span>Papers</span><strong>${papers}</strong></div>
      `;
    }

    // Renders expanded-mode hotbar slots from the selected operator backpack.
    function renderExpandedHotbar() {
      if (!deps.elements.expandedHotbarSlots) return;
      const op = deps.selectedOperator();
      if (!op) {
        deps.elements.expandedHotbarSlots.innerHTML = "";
        return;
      }
      ensureSlots(op);
      const slots = op.inventory.items
        .slice(0, Math.min(4, op.inventory.slots))
        .map((item, index) => renderHotbarSlot(item, index))
        .join("");
      deps.elements.expandedHotbarSlots.innerHTML = slots || "<span class=\"expanded-hotbar-empty\">No Pack</span>";
    }

    // Attempts to pick up an item into the selected operator inventory.
    function pickItem(op, item) {
      const state = deps.runtime.state;
      if (!op || !item || item.picked) return false;
      ensureSlots(op);
      const stack = stackFromItem(item);
      if (!canAddStack(op, stack)) {
        state.message = "Backpack full";
        deps.updateHud();
        return true;
      }
      addStack(op, stack);
      item.picked = true;
      if (deps.audio) deps.audio.play(item.type === "paper" ? "paper-pickup" : "store-select");
      state.message = `${op.id} picked up ${item.name || item.id}`;
      if (deps.runtime.inventoryOpen) renderInventory();
      renderSummary();
      renderExpandedHotbar();
      deps.updateHud();
      return true;
    }

    // Opens an equipment table overlay for nearby table data.
    function openEquipmentTable(table) {
      if (!table) return;
      openTableId = table.id;
      deps.runtime.equipmentTableOpen = true;
      deps.runtime.equipmentTableResumeRunning = Boolean(deps.runtime.state && deps.runtime.state.running);
      if (deps.runtime.state) deps.runtime.state.running = false;
      deps.keysDown.clear();
      deps.elements.equipmentTableTitle.textContent = table.name || "Equipment Table";
      deps.elements.equipmentTableOverlay.classList.remove("hidden");
      renderEquipmentTable(table);
      deps.updateHud();
    }

    // Closes the equipment table overlay.
    function closeEquipmentTable() {
      if (!deps.runtime.equipmentTableOpen) return;
      deps.runtime.equipmentTableOpen = false;
      deps.elements.equipmentTableOverlay.classList.add("hidden");
      openTableId = null;
      if (deps.runtime.equipmentTableResumeRunning && deps.runtime.state && !deps.runtime.state.gameOver) {
        deps.runtime.state.running = true;
      }
      deps.runtime.equipmentTableResumeRunning = false;
      deps.updateHud();
    }

    // Renders buttons for equipment available at a table.
    function renderEquipmentTable(table) {
      const weaponButtons = deps.weaponOptions.map((meta) => deps.equipment.weaponById(meta.id)).map((weapon) => `
        <button class="equipment-table-button" type="button" data-table-equip="weapon" data-equip-id="${weapon.id}">
          ${deps.equipment.equipmentIconHtml(weapon.id, weapon.name, "equipment-icon-small")}
          <span>${weapon.name}</span>
        </button>
      `).join("");
      const armorButtons = deps.armorOptions.map((meta) => deps.equipment.armorById(meta.id)).map((armor) => `
        <button class="equipment-table-button" type="button" data-table-equip="armor" data-equip-id="${armor.id}">
          ${deps.equipment.equipmentIconHtml(armor.id, armor.name, "equipment-icon-small")}
          <span>${armor.name}</span>
        </button>
      `).join("");
      const backpackButtons = deps.backpackOptions.map((meta) => deps.equipment.backpackById(meta.id)).map((pack) => `
        <button class="equipment-table-button" type="button" data-table-equip="backpack" data-equip-id="${pack.id}">
          ${deps.equipment.equipmentIconHtml(pack.id, pack.name, "equipment-icon-small")}
          <span>${pack.name}</span>
        </button>
      `).join("");
      deps.elements.equipmentTableOptions.innerHTML = `
        <section><h3>Weapons</h3>${weaponButtons}</section>
        <section><h3>Armor</h3>${armorButtons}</section>
        <section><h3>Backpacks</h3>${backpackButtons}</section>
      `;
    }

    // Equips the selected operator from a table button.
    function equipFromTable(type, id) {
      const op = deps.selectedOperator();
      if (!op) return;
      if (type === "weapon") {
        deps.equipment.applyOperatorWeapon(op, id);
      } else if (type === "armor") {
        deps.equipment.applyOperatorArmor(op, id);
      } else if (type === "backpack") {
        deps.equipment.applyOperatorBackpack(op, id);
      }
      if (deps.audio) deps.audio.play("gear-equip");
      renderInventory();
      renderSummary();
    }

    // Finds the currently open equipment table.
    function currentTable() {
      const state = deps.runtime.state;
      return state && openTableId ? (state.level.equipmentTables || []).find((table) => table.id === openTableId) : null;
    }

    // Ensures an operator inventory uses fixed backpack slots.
    function ensureSlots(op) {
      if (!op.inventory) op.inventory = { slots: 0, items: [] };
      const slots = Math.max(0, Number(op.inventory.slots) || 0);
      const current = (op.inventory.items || []).map((item) => item ? normalizeStack(item) : null);
      if (current.length > slots) {
        const compacted = current.filter(Boolean);
        op.inventory.items = Array.from({ length: slots }, (_, index) => compacted[index] || null);
        return;
      }
      op.inventory.items = Array.from({ length: slots }, (_, index) => current[index] || null);
    }

    // Normalizes any carried item into a stack record.
    function normalizeStack(item) {
      return {
        id: item.id,
        type: item.type || "item",
        name: item.name || item.id || "Item",
        text: item.text || "",
        quantity: Math.max(1, Number(item.quantity) || 1),
        maxStack: Math.max(1, Number(item.maxStack) || (item.type === "paper" ? 1 : 99)),
        effect: item.effect || "",
        healPercent: Number(item.healPercent) || 0,
        sightBoost: Number(item.sightBoost) || 0,
        consumable: Boolean(item.consumable),
        sourceEnemyId: item.sourceEnemyId || ""
      };
    }

    // Converts a map item into an inventory stack.
    function stackFromItem(item) {
      return normalizeStack({
        id: item.id,
        type: item.type,
        name: item.name || item.id,
        text: item.text || "",
        quantity: item.quantity || 1,
        maxStack: item.maxStack || (item.type === "paper" ? 1 : 99),
        effect: item.effect || "",
        healPercent: item.healPercent || 0,
        sightBoost: item.sightBoost || 0,
        consumable: Boolean(item.consumable),
        sourceEnemyId: item.sourceEnemyId || ""
      });
    }

    // Returns non-empty inventory stacks.
    function carriedItems(op) {
      ensureSlots(op);
      return op.inventory.items.filter(Boolean);
    }

    // Returns the first carried stack for the detail panel.
    function firstCarriedItem(op) {
      return carriedItems(op)[0] || null;
    }

    // Counts occupied slots.
    function occupiedSlots(op) {
      return carriedItems(op).length;
    }

    // Determines whether two stacks may merge.
    function compatibleStacks(a, b) {
      return Boolean(a && b && a.id === b.id && a.type === b.type && (a.text || "") === (b.text || "") && a.maxStack > 1);
    }

    // Checks whether the operator can accept the full incoming stack.
    function canAddStack(op, stack) {
      ensureSlots(op);
      let remaining = stack.quantity;
      for (const item of op.inventory.items) {
        if (compatibleStacks(item, stack)) remaining -= Math.max(0, item.maxStack - item.quantity);
        if (remaining <= 0) return true;
      }
      const emptySlots = op.inventory.items.filter((item) => !item).length;
      return emptySlots * stack.maxStack >= remaining;
    }

    // Adds a stack by merging first and filling empty slots second.
    function addStack(op, stack) {
      ensureSlots(op);
      let remaining = stack.quantity;
      for (const item of op.inventory.items) {
        if (!compatibleStacks(item, stack)) continue;
        const moved = Math.min(remaining, item.maxStack - item.quantity);
        item.quantity += moved;
        remaining -= moved;
        if (remaining <= 0) return true;
      }
      for (let index = 0; index < op.inventory.items.length && remaining > 0; index += 1) {
        if (op.inventory.items[index]) continue;
        const moved = Math.min(remaining, stack.maxStack);
        op.inventory.items[index] = { ...stack, quantity: moved };
        remaining -= moved;
      }
      return remaining <= 0;
    }

    // Renders one square inventory slot.
    function renderSlot(item, index) {
      if (!item) {
        return `<div class="inventory-slot empty" data-inventory-slot="${index}" aria-label="Empty slot ${index + 1}"></div>`;
      }
      const count = item.quantity > 1 ? `<span class="inventory-item-count">${item.quantity}</span>` : "";
      const selected = selectedInventorySlot === index && item;
      const preview = escapeAttr(firstTwoSentences(item.text || item.name));
      return `
        <div class="inventory-slot${selected ? " selected-action" : ""}" draggable="true" data-inventory-slot="${index}" title="${preview}" data-slot-tip="${preview}">
          <span class="inventory-item-icon">${itemIcon(item)}</span>
          <span class="inventory-item-name">${escapeHtml(item.name)}</span>
          ${count}
        </div>
      `;
    }

    // Renders one compact expanded-mode hotbar cell.
    function renderHotbarSlot(item, index) {
      if (!item) {
        return `<button class="expanded-hotbar-slot empty" type="button" data-expanded-hotbar-slot="${index}" aria-label="Empty hotbar slot ${index + 1}"></button>`;
      }
      const count = item.quantity > 1 ? `<span class="expanded-hotbar-count">${item.quantity}</span>` : "";
      return `
        <button class="expanded-hotbar-slot" type="button" data-expanded-hotbar-slot="${index}" aria-label="${escapeAttr(item.name)}">
          <span class="expanded-hotbar-icon">${itemIcon(item)}</span>
          ${count}
        </button>
      `;
    }

    // Renders a floating context menu for the selected usable item.
    function renderInventoryActionMenu(op, columns) {
      if (selectedInventorySlot === null) return "";
      ensureSlots(op);
      const item = op.inventory.items[selectedInventorySlot];
      if (!item) {
        selectedInventorySlot = null;
        return "";
      }
      const position = actionMenuPosition(selectedInventorySlot, columns);
      const useButton = canUseItem(item)
        ? `<button type="button" data-use-inventory-slot="${selectedInventorySlot}">Use</button>`
        : "";
      return `
        <div class="inventory-use-selector" role="menu" aria-label="${escapeAttr(item.name)} actions" style="--menu-x: ${position.x}px; --menu-y: ${position.y}px; --menu-width: ${position.width}px;">
          ${useButton}
          <button type="button" data-drop-inventory-slot="${selectedInventorySlot}">Drop</button>
          <button type="button" data-cancel-inventory-use>Cancel</button>
        </div>
      `;
    }

    // Places the inventory action menu below the clicked slot.
    function actionMenuPosition(slotIndex, columns) {
      const slot = 38;
      const gap = 6;
      const menuWidth = 96;
      const col = slotIndex % Math.max(1, columns);
      const row = Math.floor(slotIndex / Math.max(1, columns));
      const gridWidth = columns * slot + Math.max(0, columns - 1) * gap;
      const centerX = col * (slot + gap) + slot / 2;
      const minX = menuWidth / 2;
      const maxX = Math.max(minX, gridWidth - menuWidth / 2);
      return {
        x: Math.max(minX, Math.min(maxX, centerX)),
        y: row * (slot + gap) + slot + gap,
        width: menuWidth
      };
    }

    // Reports whether a stack has an active inventory action.
    function canUseItem(item) {
      return Boolean(item && (item.effect === "heal" || item.effect === "disguise"));
    }

    // Uses an actionable inventory item from a backpack slot.
    function useItemSlot(slotIndex) {
      const state = deps.runtime.state;
      const op = deps.selectedOperator();
      if (!state || !op || op.down) return false;
      ensureSlots(op);
      const item = op.inventory.items[slotIndex];
      if (!canUseItem(item)) return false;
      if (item.effect === "heal") {
        const before = op.health;
        if (before >= 100) {
          state.message = `${op.id} is already healthy`;
          deps.updateHud();
          return true;
        }
        const amount = Math.max(1, Math.round(100 * (item.healPercent || 0) / 100));
        op.health = Math.min(100, op.health + amount);
        consumeSlotItem(op, slotIndex);
        selectedInventorySlot = null;
        state.message = `${op.id} used ${item.name}`;
      } else if (item.effect === "disguise") {
        op.disguised = true;
        op.disguiseSourceEnemyId = item.sourceEnemyId || "";
        consumeSlotItem(op, slotIndex);
        selectedInventorySlot = null;
        state.message = `${op.id} switched into enemy clothes`;
      }
      renderInventory();
      renderSummary();
      renderExpandedHotbar();
      deps.updateHud();
      return true;
    }

    // Drops one item from a backpack slot back onto the map as a pickable object.
    function dropItemSlot(slotIndex) {
      const state = deps.runtime.state;
      const op = deps.selectedOperator();
      if (!state || !state.level || !op || op.down) return false;
      ensureSlots(op);
      const item = op.inventory.items[slotIndex];
      if (!item) return false;
      const dropped = droppedItemFromStack(item, op, state.level);
      consumeSlotItem(op, slotIndex);
      if (!Array.isArray(state.level.items)) state.level.items = [];
      state.level.items.push(dropped);
      selectedInventorySlot = null;
      state.message = `${op.id} dropped ${item.name}`;
      renderInventory();
      renderSummary();
      renderExpandedHotbar();
      deps.updateHud();
      return true;
    }

    // Removes one item from a slot, clearing it when quantity reaches zero.
    function consumeSlotItem(op, slotIndex) {
      const item = op.inventory.items[slotIndex];
      if (!item) return;
      item.quantity -= 1;
      if (item.quantity <= 0) op.inventory.items[slotIndex] = null;
    }

    // Converts one carried stack unit back into a map pickup near the operator.
    function droppedItemFromStack(item, op, level) {
      const w = 20;
      const h = 18;
      const maxX = Math.max(0, (level.width || 0) - w);
      const maxY = Math.max(0, (level.height || 0) - h);
      const x = Math.max(0, Math.min(maxX, (op.x || 0) + 18));
      const y = Math.max(0, Math.min(maxY, (op.y || 0) + 18));
      return {
        id: `${item.id || item.type || "item"}-drop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: item.type || "item",
        name: item.name || item.id || "Item",
        text: item.text || "",
        effect: item.effect || "",
        healPercent: Number(item.healPercent) || 0,
        sightBoost: Number(item.sightBoost) || 0,
        consumable: Boolean(item.consumable),
        sourceEnemyId: item.sourceEnemyId || "",
        maxStack: Math.max(1, Number(item.maxStack) || 1),
        quantity: 1,
        picked: false,
        x,
        y,
        w,
        h
      };
    }

    // Keeps inventory hover details short enough for compact slots.
    function firstTwoSentences(text) {
      const raw = String(text || "").trim();
      if (!raw) return "";
      const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw];
      return sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
    }

    // Escapes text for safe use inside HTML attributes.
    function escapeAttr(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // Escapes text before it is rendered inside inventory HTML.
    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Picks a short cell marker for an item type.
    function itemIcon(item) {
      if (item.type === "paper") return "P";
      if (item.effect === "heal") return "+";
      if (item.effect === "sight") return "L";
      if (item.effect === "disguise") return "D";
      return (item.name || item.type || "?").slice(0, 1).toUpperCase();
    }

    // Handles inventory button actions without interfering with drag/drop.
    function handleInventoryClick(event) {
      const cancelButton = event.target.closest("[data-cancel-inventory-use]");
      if (cancelButton) {
        event.preventDefault();
        event.stopPropagation();
        selectedInventorySlot = null;
        renderInventory();
        return;
      }
      const button = event.target.closest("[data-use-inventory-slot]");
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        useItemSlot(Number(button.dataset.useInventorySlot));
        return;
      }
      const dropButton = event.target.closest("[data-drop-inventory-slot]");
      if (dropButton) {
        event.preventDefault();
        event.stopPropagation();
        dropItemSlot(Number(dropButton.dataset.dropInventorySlot));
        return;
      }
      const slot = event.target.closest("[data-inventory-slot]");
      const op = deps.selectedOperator();
      if (!slot || !op) {
        selectedInventorySlot = null;
        renderInventory();
        return;
      }
      const index = Number(slot.dataset.inventorySlot);
      ensureSlots(op);
      const item = op.inventory.items[index];
      if (item) {
        selectedInventorySlot = selectedInventorySlot === index ? null : index;
        renderInventory();
        return;
      }
      if (selectedInventorySlot !== null) {
        selectedInventorySlot = null;
        renderInventory();
      }
    }

    // Chooses a compact column count for the inventory grid.
    function gridColumns(slots) {
      return Math.max(2, Math.min(4, Math.ceil(Math.sqrt(slots || 1))));
    }

    // Starts dragging a filled inventory slot.
    function handleDragStart(event) {
      const slot = event.target.closest("[data-inventory-slot]");
      const op = deps.selectedOperator();
      if (!slot || !op) return;
      if (event.target.closest("button")) {
        event.preventDefault();
        return;
      }
      const index = Number(slot.dataset.inventorySlot);
      ensureSlots(op);
      if (!op.inventory.items[index]) {
        event.preventDefault();
        return;
      }
      selectedInventorySlot = null;
      draggedSlot = index;
      slot.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }

    // Allows slot drops and marks the target.
    function handleDragOver(event) {
      const slot = event.target.closest("[data-inventory-slot]");
      if (!slot || draggedSlot === null) return;
      event.preventDefault();
      slot.classList.add("drop-target");
    }

    // Removes transient drop styling.
    function handleDragLeave(event) {
      const slot = event.target.closest("[data-inventory-slot]");
      if (slot) slot.classList.remove("drop-target");
    }

    // Moves, swaps, or merges inventory stacks.
    function handleDrop(event) {
      const slot = event.target.closest("[data-inventory-slot]");
      const op = deps.selectedOperator();
      if (!slot || !op || draggedSlot === null) return;
      event.preventDefault();
      const targetSlot = Number(slot.dataset.inventorySlot);
      moveStack(op, draggedSlot, targetSlot);
      draggedSlot = null;
      selectedInventorySlot = null;
      renderInventory();
      renderSummary();
      renderExpandedHotbar();
      deps.updateHud();
    }

    // Clears drag styling after drag completion.
    function handleDragEnd() {
      draggedSlot = null;
      if (!deps.elements.inventoryDetails) return;
      for (const slot of deps.elements.inventoryDetails.querySelectorAll(".inventory-slot")) {
        slot.classList.remove("dragging", "drop-target");
      }
    }

    // Applies inventory slot movement rules.
    function moveStack(op, fromSlot, toSlot) {
      ensureSlots(op);
      if (fromSlot === toSlot) return;
      const source = op.inventory.items[fromSlot];
      const target = op.inventory.items[toSlot];
      if (!source) return;
      if (!target) {
        op.inventory.items[toSlot] = source;
        op.inventory.items[fromSlot] = null;
        return;
      }
      if (compatibleStacks(target, source) && target.quantity < target.maxStack) {
        const moved = Math.min(source.quantity, target.maxStack - target.quantity);
        target.quantity += moved;
        source.quantity -= moved;
        if (source.quantity <= 0) op.inventory.items[fromSlot] = null;
        return;
      }
      op.inventory.items[toSlot] = source;
      op.inventory.items[fromSlot] = target;
    }

    return {
      openInventory,
      closeInventory,
      renderInventory,
      renderSummary,
      renderExpandedHotbar,
      pickItem,
      ensureSlots,
      carriedItems,
      occupiedSlots,
      canAddStack,
      useItemSlot,
      dropItemSlot,
      openEquipmentTable,
      closeEquipmentTable,
      renderEquipmentTable,
      equipFromTable,
      currentTable
    };
  }

  window.InventorySystem = { create };
}());
