"use strict";

(function () {
  const palette = {
    black: "#101719",
    dark: "#1d2629",
    shadow: "#2b3437",
    steel: "#9ca79f",
    white: "#d9e2db",
    cyan: "#72b7ce",
    green: "#60c689",
    amber: "#e0af56",
    gold: "#f0c36a",
    teal: "#77df9a",
    red: "#c96f67",
    gray: "#596369"
  };

  const definitions = {
    "operator-profile": icon("Operator Profile Avatar", "profile", [
      b("cyan", 6, 1, 8, 2), b("cyan", 5, 3, 10, 2),
      b("white", 7, 5, 6, 1), b("black", 6, 6, 8, 5),
      b("white", 8, 7, 2, 1), b("white", 11, 7, 2, 1),
      b("green", 7, 12, 6, 2), b("green", 5, 14, 10, 3),
      b("dark", 4, 17, 12, 2), b("shadow", 7, 15, 2, 3), b("shadow", 11, 15, 2, 3)
    ]),
    "no-weapon": icon("No Weapon Full Figure Icon", "weapon", [
      b("steel", 5, 3, 10, 2), b("steel", 7, 5, 6, 2),
      b("black", 9, 7, 2, 6), b("steel", 4, 9, 12, 2),
      b("steel", 5, 13, 10, 2), b("dark", 7, 16, 6, 2)
    ]),
    rifle: icon("Full Rifle Store Icon", "weapon", [
      b("amber", 1, 8, 4, 3), b("amber", 2, 11, 3, 2),
      b("cyan", 5, 7, 9, 4), b("cyan", 14, 6, 4, 2), b("cyan", 18, 5, 1, 1),
      b("steel", 14, 9, 4, 1), b("dark", 8, 11, 3, 5),
      b("black", 10, 11, 2, 2), b("shadow", 3, 16, 13, 2)
    ]),
    "advanced-carbine": icon("Full Advanced Carbine Store Icon", "weapon", [
      b("green", 1, 8, 4, 4), b("green", 4, 7, 10, 4),
      b("white", 7, 6, 4, 1), b("cyan", 13, 6, 5, 2), b("cyan", 18, 5, 1, 1),
      b("steel", 12, 10, 5, 1), b("green", 8, 11, 3, 5),
      b("dark", 5, 11, 3, 2), b("shadow", 2, 16, 14, 2)
    ]),
    smg: icon("Full SMG Store Icon", "weapon", [
      b("cyan", 2, 9, 4, 3), b("green", 5, 7, 9, 4),
      b("green", 13, 6, 4, 2), b("steel", 16, 5, 2, 1),
      b("green", 7, 11, 3, 2), b("cyan", 8, 13, 3, 4),
      b("dark", 11, 11, 2, 2), b("shadow", 4, 17, 10, 2)
    ]),
    "compact-pdw": icon("Full Compact PDW Store Icon", "weapon", [
      b("amber", 1, 9, 4, 3), b("green", 4, 7, 10, 4),
      b("white", 6, 6, 3, 1), b("green", 13, 6, 4, 2), b("steel", 17, 5, 2, 1),
      b("amber", 8, 11, 3, 5), b("dark", 11, 11, 3, 2),
      b("shadow", 3, 16, 12, 2)
    ]),
    pistol: icon("Full Pistol Store Icon", "weapon", [
      b("amber", 5, 6, 10, 3), b("amber", 14, 7, 3, 1),
      b("dark", 5, 9, 4, 2), b("cyan", 9, 9, 4, 2),
      b("cyan", 10, 11, 3, 5), b("black", 11, 10, 2, 1),
      b("shadow", 6, 16, 8, 2)
    ]),
    "marksman-pistol": icon("Full Marksman Pistol Store Icon", "weapon", [
      b("gold", 4, 6, 11, 3), b("white", 7, 5, 4, 1), b("gold", 14, 6, 4, 1),
      b("dark", 4, 9, 4, 2), b("cyan", 8, 9, 5, 2),
      b("cyan", 9, 11, 4, 5), b("steel", 13, 9, 2, 2),
      b("shadow", 5, 16, 10, 2)
    ]),
    melee: icon("Full Melee Store Icon", "weapon", [
      b("white", 13, 1, 2, 5), b("white", 11, 5, 4, 3),
      b("white", 9, 8, 4, 3), b("white", 7, 11, 4, 3),
      b("amber", 5, 14, 4, 4), b("dark", 4, 17, 6, 2),
      b("shadow", 9, 16, 4, 2)
    ]),
    "no-armor": icon("No Armor Full Figure Icon", "armor", [
      b("gray", 6, 2, 8, 2), b("gray", 5, 4, 10, 3),
      b("black", 8, 6, 4, 6), b("gray", 4, 8, 3, 5),
      b("gray", 13, 8, 3, 5), b("gray", 6, 13, 8, 2),
      b("dark", 5, 17, 10, 2)
    ]),
    "light-armor": icon("Full Light Armor Store Icon", "armor", [
      b("white", 6, 2, 8, 2), b("white", 4, 4, 12, 3),
      b("cyan", 6, 6, 8, 8), b("white", 3, 7, 3, 6),
      b("white", 14, 7, 3, 6), b("cyan", 7, 14, 6, 2),
      b("dark", 5, 17, 10, 2)
    ]),
    "medium-armor": icon("Full Medium Armor Store Icon", "armor", [
      b("cyan", 5, 2, 10, 3), b("cyan", 3, 5, 14, 3),
      b("green", 5, 7, 10, 8), b("cyan", 2, 8, 3, 6),
      b("cyan", 15, 8, 3, 6), b("green", 7, 15, 6, 2),
      b("dark", 4, 18, 12, 1)
    ]),
    "heavy-armor": icon("Full Heavy Armor Store Icon", "armor", [
      b("amber", 4, 1, 12, 3), b("amber", 2, 4, 16, 4),
      b("white", 5, 7, 10, 8), b("amber", 1, 8, 4, 7),
      b("amber", 15, 8, 4, 7), b("white", 7, 15, 6, 2),
      b("dark", 4, 18, 12, 1)
    ]),
    "no-backpack": icon("No Backpack Full Figure Icon", "backpack", [
      b("gray", 6, 3, 8, 3), b("gray", 5, 6, 10, 7),
      b("black", 8, 7, 4, 4), b("gray", 6, 13, 8, 2),
      b("dark", 5, 17, 10, 2)
    ]),
    "small-backpack": icon("Full Small Backpack Store Icon", "backpack", [
      b("white", 7, 2, 6, 2), b("green", 5, 4, 10, 10),
      b("green", 4, 6, 2, 7), b("green", 14, 6, 2, 7),
      b("dark", 7, 6, 6, 2), b("dark", 7, 11, 6, 2),
      b("shadow", 5, 16, 10, 2)
    ]),
    "medium-backpack": icon("Full Medium Backpack Store Icon", "backpack", [
      b("white", 6, 1, 8, 2), b("cyan", 4, 3, 12, 12),
      b("cyan", 3, 6, 2, 8), b("cyan", 15, 6, 2, 8),
      b("dark", 6, 5, 8, 3), b("dark", 6, 11, 8, 3),
      b("shadow", 4, 17, 12, 2)
    ]),
    "large-backpack": icon("Full Large Backpack Store Icon", "backpack", [
      b("white", 5, 1, 10, 2), b("amber", 3, 3, 14, 13),
      b("amber", 2, 6, 2, 8), b("amber", 16, 6, 2, 8),
      b("dark", 5, 5, 10, 3), b("dark", 5, 12, 10, 3),
      b("shadow", 4, 17, 12, 2)
    ])
  };

  const aliases = {
    none: "no-weapon"
  };

  function b(color, x, y, w, h) {
    return { color, x, y, w, h };
  }

  function icon(name, type, blocks, cols = 20, rows = 20) {
    return {
      name,
      type,
      cols,
      rows,
      blocks,
      cells: blocks.flatMap((block) => {
        const cells = [];
        for (let y = block.y; y < block.y + block.h; y += 1) {
          for (let x = block.x; x < block.x + block.w; x += 1) {
            cells.push({ key: block.color, x, y });
          }
        }
        return cells;
      })
    };
  }

  function render(id, options = {}) {
    const key = aliases[id] || id;
    const definition = definitions[key] || definitions["no-weapon"];
    const label = escapeHtml(options.label || definition.name);
    const sizeClass = options.size === "detail" ? " css-pixel-art--detail" : "";
    const cells = definition.cells.map((cell) => {
      const color = palette[cell.key] || cell.key || palette.white;
      return `<span class="css-pixel-art__cell" style="--x:${cell.x};--y:${cell.y};--c:${color}"></span>`;
    }).join("");
    return `<span class="css-pixel-art css-pixel-art--${escapeAttr(key)} css-pixel-art--${escapeAttr(definition.type)}${sizeClass}" style="--cols:${definition.cols};--rows:${definition.rows}" role="img" aria-label="${label}" title="${label}">${cells}</span>`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return String(value || "").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  }

  window.StorePixelArt = {
    definitions,
    render
  };
}());
