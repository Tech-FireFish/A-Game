"use strict";

(function () {
  // Builds inventory overlays, paper pickup, and equipment-table behavior.
  function create(deps) {
    let openTableId = null;
    let draggedSlot = null;

    if (deps.elements.inventoryDetails) {
      deps.elements.inventoryDetails.addEventListener("dragstart", handleDragStart);
      deps.elements.inventoryDetails.addEventListener("dragover", handleDragOver);
      deps.elements.inventoryDetails.addEventListener("dragleave", handleDragLeave);
      deps.elements.inventoryDetails.addEventListener("drop", handleDrop);
      deps.elements.inventoryDetails.addEventListener("dragend", handleDragEnd);
    }

    // Opens the selected operator inventory overlay.
    function openInventory() {
      const op = deps.selectedOperator();
      if (!op) return;
      ensureSlots(op);
      deps.runtime.inventoryOpen = true;
      deps.runtime.inventoryResumeRunning = Boolean(deps.runtime.state && deps.runtime.state.running);
      if (deps.runtime.state) deps.runtime.state.running = false;
      deps.keysDown.clear();
      deps.elements.inventoryOverlay.classList.remove("hidden");
      if (deps.audio) deps.audio.play("inventory-open");
      renderInventory();
      deps.updateHud();
    }

    // Closes the inventory overlay and restores execution if needed.
    function closeInventory() {
      if (!deps.runtime.inventoryOpen) return;
      deps.runtime.inventoryOpen = false;
      deps.elements.inventoryOverlay.classList.add("hidden");
      if (deps.runtime.inventoryResumeRunning && deps.runtime.state && !deps.runtime.state.gameOver) {
        deps.runtime.state.running = true;
      }
      deps.runtime.inventoryResumeRunning = false;
      if (deps.audio) deps.audio.play("inventory-close");
      deps.updateHud();
    }

    // Renders full inventory details for the selected operator.
    function renderInventory() {
      const op = deps.selectedOperator();
      if (!op) return;
      ensureSlots(op);
      const weapon = deps.equipment.weaponById(op.weaponId);
      const armor = deps.equipment.armorById(op.armorId);
      const backpack = deps.equipment.backpackById(op.backpackId);
      const slots = op.inventory.items.map((item, index) => renderSlot(item, index)).join("");
      const selectedItem = firstCarriedItem(op);
      deps.elements.inventoryTitle.textContent = `${op.id} Inventory`;
      deps.elements.inventoryDetails.innerHTML = `
        <div class="inventory-grid">
          <div><span>Weapon</span><strong>${deps.equipment.equipmentIconHtml(weapon.id, weapon.name, "equipment-icon-small")}${weapon.name}</strong></div>
          <div><span>Armor</span><strong>${deps.equipment.equipmentIconHtml(armor.id, armor.name, "equipment-icon-small")}${armor.name}</strong></div>
          <div><span>Backpack</span><strong>${deps.equipment.equipmentIconHtml(backpack.id, backpack.name, "equipment-icon-small")}${backpack.name}</strong></div>
          <div><span>Ammo</span><strong>${op.ammo.magazine}/${weapon.magSize} + ${op.ammo.reserve}</strong></div>
          <div><span>Slots</span><strong>${occupiedSlots(op)}/${op.inventory.slots}</strong></div>
        </div>
        <div class="inventory-slot-grid" style="--inventory-cols: ${gridColumns(op.inventory.slots)}" aria-label="${op.id} backpack slots">
          ${slots}
        </div>
        <div class="inventory-item-detail">
          ${selectedItem ? `<strong>${selectedItem.name}</strong><br>${selectedItem.text || selectedItem.type}` : "Empty slots can hold paper clues and future items."}
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
        maxStack: Math.max(1, Number(item.maxStack) || (item.type === "paper" ? 1 : 99))
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
        maxStack: item.maxStack || (item.type === "paper" ? 1 : 99)
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
      const preview = escapeAttr(firstTwoSentences(item.text || item.name));
      return `
        <div class="inventory-slot" draggable="true" data-inventory-slot="${index}" title="${preview}" data-slot-tip="${preview}">
          <span class="inventory-item-icon">${itemIcon(item)}</span>
          <span class="inventory-item-name">${item.name}</span>
          ${count}
        </div>
      `;
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

    // Picks a short cell marker for an item type.
    function itemIcon(item) {
      if (item.type === "paper") return "P";
      return (item.name || item.type || "?").slice(0, 1).toUpperCase();
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
      const index = Number(slot.dataset.inventorySlot);
      ensureSlots(op);
      if (!op.inventory.items[index]) {
        event.preventDefault();
        return;
      }
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
      renderInventory();
      renderSummary();
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
      pickItem,
      ensureSlots,
      carriedItems,
      occupiedSlots,
      canAddStack,
      openEquipmentTable,
      closeEquipmentTable,
      renderEquipmentTable,
      equipFromTable,
      currentTable
    };
  }

  window.InventorySystem = { create };
}());
