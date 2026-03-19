# Patches

A browser-based puzzle game inspired by LinkedIn's Patches daily game.

## How to play

Each region on the grid contains a **clue cell** showing:
- A **number** — how many cells the patch covers
- A **shape symbol** — ■ square · ▬ wide rectangle · ▮ tall rectangle

Click any cell in a region to fill it with colour. Fill every region to win!

## Features

- 🎲 **Infinite random puzzles** — generated fresh every time
- 3 difficulty levels: **Easy (4×4)**, **Medium (5×5)**, **Hard (6×6)**
- ↩ **Undo** — step back one move at a time
- 💡 **Hint** — reveals the shape of a random unplaced patch
- ↺ **Reset** — restart the current puzzle
- ⏱ **Timer** — tracks how long you take
- 🌙 **Dark mode** — respects your system preference

## Running locally

No build step required — it's plain HTML, CSS, and JS.

```bash
git clone https://github.com/YOUR_USERNAME/patches-game.git
cd patches-game
# Open index.html in your browser, or serve with any static server:
npx serve .
# or
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Project structure

```
patches-game/
├── index.html        # Entry point and markup
└── src/
    ├── style.css     # All styles (light + dark mode)
    ├── generator.js  # Random puzzle generation (guillotine cuts)
    ├── renderer.js   # SVG board rendering
    └── game.js       # Game state, controls, and UI wiring
```

## How puzzles are generated

Puzzles use a **recursive guillotine cut** algorithm:

1. Start with the full N×N grid as one rectangle
2. Randomly decide to either **stop** (create a patch here) or **split** horizontally / vertically
3. Recurse on each sub-rectangle
4. If generation fails after 300 attempts, fall back to row-strip mode

This guarantees every generated puzzle has a unique, valid solution where all patches tile the grid perfectly with no gaps or overlaps.

## License

MIT
