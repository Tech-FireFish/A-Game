# v1.0.0 — Initial Stable Release

The first stable release of Delta Geometry delivers the complete tactical gameplay loop, progression, customization tools, and standalone demo.

## Features

### Gameplay & Progression

- Added direct operator movement, cursor aiming, automatic/manual shooting, stealth, sprinting, and melee combat
- Added mission briefings, objectives, score rewards, failure states, restart support, and sequential level unlocking
- Added six tutorials and six story missions with persistent completion progress

### Enemy AI

- Added individual suspicion, alert, search, combat, support, and teamwork behavior
- Added aggressive, calm, loyal, and violent enemy personalities
- Added Difficult-mode action learning and adaptive enemy equipment probability

### Equipment & Interaction

- Added weapons, armor, backpacks, healing items, inventory hotbar, item dropping, and Store unlocks
- Added silenced attacks, stealth melee, enemy-clothes disguises, animated doors, windows, stairs, locks, laptops, and cameras

### Interface & Tools

- Added General and Dev Settings, remappable controls, expanded gameplay HUD, mission reports, credits, and saved preferences
- Added the Map Editor, JSON import/export, object editing, and unsaved movement simulation

### Audio & Distribution

- Added layered procedural music and sound effects using the Web Audio API
- Added a Node.js localhost version and a self-contained standalone demo

## Requirements

- Windows 10 or later
- Modern desktop browser
- Node.js LTS for the root localhost version

## Installation

Run `npm start`, then open `http://127.0.0.1:4700/`.

Alternatively, open `demo/index.html` directly for the standalone demo.

## Known Issues

- n/a

Please report bugs through the GitHub Issues page.
