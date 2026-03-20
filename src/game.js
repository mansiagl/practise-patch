/**
 * game.js
 * Game state management and UI wiring for Patches.
 * Depends on: generator.js, renderer.js
 */

// ── State ─────────────────────────────────────────────────────────────────────

let G         = 4;    // current grid size
let currentDiff = null; // set on first difficulty selection
let patches   = [];   // array of patch objects from generator
let tentative = {};   // patchIndex → { r, c, rows, cols } | null  (player's guess)
let placed    = {};   // patchIndex → boolean  (true only after full-board verification)
let dragState = null; // { patchIndex, startR, startC, curR, curC } | null
let undoStack = [];   // { patchIndex, prevPos } — prevPos is the position before the drag
let solved    = false;
let startTime = 0;
let timerInt  = null;

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { id: "d0", label: "Easy 4×4",   grid: 4, complexity: { min: 0, max: 2  } },
  { id: "d1", label: "Medium 5×5", grid: 5, complexity: { min: 2, max: 5  } },
  { id: "d2", label: "Hard 6×6",   grid: 6, complexity: { min: 6, max: Infinity } },
];

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  clearInterval(timerInt);
  startTime = Date.now();
  document.getElementById("timerSpan").textContent = "0:00";
  timerInt = setInterval(() => {
    if (solved) return;
    const s  = Math.floor((Date.now() - startTime) / 1000);
    const m  = Math.floor(s / 60);
    const ss = s % 60;
    document.getElementById("timerSpan").textContent =
      `${m}:${ss < 10 ? "0" : ""}${ss}`;
  }, 1000);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function updateProgress() {
  const total = patches.length;
  const done  = patches.filter((_, i) => tentative[i] || placed[i]).length;
  document.getElementById("progress-bar").style.width =
    (total ? (done / total) * 100 : 0) + "%";
}

// ── Message display ───────────────────────────────────────────────────────────

function setMsg(text, color = "var(--text-muted)") {
  const el        = document.getElementById("msg");
  el.style.color  = color;
  el.textContent  = text;
}

// ── Render helper ─────────────────────────────────────────────────────────────

function render() {
  renderBoard(G, patches, placed, tentative, startDrag);
  updateDragOverlay();
}

// ── Overlap helper ────────────────────────────────────────────────────────────

/**
 * Returns true if the rectangle (r, c, rows, cols) overlaps any occupied cell
 * belonging to a patch other than excludeIdx.
 *
 * "Occupied" means either:
 *   • the patch has a tentative placement (AABB overlap), or
 *   • the patch is still unplaced — its clue cell is a fixed anchor that
 *     cannot be covered by another patch's tentative rectangle.
 */
function overlapsOthers(excludeIdx, r, c, rows, cols) {
  for (let i = 0; i < patches.length; i++) {
    if (i === excludeIdx) continue;
    const t = tentative[i];
    if (t) {
      // AABB overlap with an existing tentative placement
      if (r < t.r + t.rows && r + rows > t.r &&
          c < t.c + t.cols && c + cols > t.c) return true;
    } else if (!placed[i]) {
      // Clue cell of an unplaced patch — treat it as occupied
      const { clueR, clueC } = patches[i];
      if (r <= clueR && clueR < r + rows &&
          c <= clueC && clueC < c + cols) return true;
    }
  }
  return false;
}

// ── Drag interaction ──────────────────────────────────────────────────────────

/**
 * Begins a drag. Called by the renderer on mousedown of a clue cell or a
 * tentatively-placed patch cell.
 *
 * The anchor (fixed corner) is chosen so both ends of the rectangle can be
 * adjusted across separate drags:
 *   • No tentative yet → anchor = clue cell (normal first-drag behaviour).
 *   • Dragging from at/above the clue → anchor = bottom edge of tentative,
 *     so you are adjusting the top while the bottom stays put.
 *   • Dragging from below the clue → anchor = top edge of tentative,
 *     so you are adjusting the bottom while the top stays put.
 * This lets the player extend a patch both upward and downward across two
 * separate drags without losing either extension.
 */
function startDrag(patchIndex, r, c) {
  if (solved) return;
  const { clueR, clueC } = patches[patchIndex];
  const t = tentative[patchIndex];

  // When no tentative exists, anchor at the clue cell.
  // When re-dragging an existing tentative, anchor at the OPPOSITE end so the
  // player can extend the patch in both directions across separate drags:
  //   drag from at/above clue → anchor = bottom edge (adjusting the top)
  //   drag from below clue    → anchor = top  edge (adjusting the bottom)
  const anchorR = t ? ((r <= clueR) ? (t.r + t.rows - 1) : t.r) : clueR;
  const anchorC = t ? ((c <= clueC) ? (t.c + t.cols - 1) : t.c) : clueC;

  dragState = { patchIndex, clueR, clueC, anchorR, anchorC, curR: r, curC: c };
  updateDragOverlay();
}

/**
 * Computes the current drag rectangle, clamping the cursor so the clue cell
 * always remains inside the resulting bounds.
 * @returns {{ r1, r2, c1, c2 }}
 */
function computeDragRect() {
  const { clueR, clueC, anchorR, anchorC, curR, curC } = dragState;

  // Clamp cursor to keep clue inside
  let effR = curR, effC = curC;
  if      (anchorR > clueR) effR = Math.min(effR, clueR);
  else if (anchorR < clueR) effR = Math.max(effR, clueR);
  if      (anchorC > clueC) effC = Math.min(effC, clueC);
  else if (anchorC < clueC) effC = Math.max(effC, clueC);

  return {
    r1: Math.min(anchorR, effR), r2: Math.max(anchorR, effR),
    c1: Math.min(anchorC, effC), c2: Math.max(anchorC, effC),
  };
}

/**
 * Updates the drag overlay rect in-place — no full re-render needed.
 */
function updateDragOverlay() {
  const overlay = document.getElementById("drag-overlay");
  if (!overlay) return;

  if (!dragState) {
    overlay.setAttribute("display", "none");
    return;
  }

  const { patchIndex } = dragState;
  const color = patches[patchIndex].color;
  const { r1, r2, c1, c2 } = computeDragRect();
  const cs = cellSize(G);

  overlay.setAttribute("x",            cellX(G, c1));
  overlay.setAttribute("y",            cellY(G, r1));
  overlay.setAttribute("width",        (c2 - c1 + 1) * (cs + GAP) - GAP);
  overlay.setAttribute("height",       (r2 - r1 + 1) * (cs + GAP) - GAP);
  overlay.setAttribute("fill",         hexRgba(color, 0.35));
  overlay.setAttribute("stroke",       hexRgba(color, 0.85));
  overlay.setAttribute("stroke-width", 2.5);
  overlay.setAttribute("display",      "");
}

// Track mouse across the whole window so drag works even if cursor leaves SVG
window.addEventListener("mousemove", (e) => {
  if (!dragState) return;
  const svg  = document.getElementById("board-svg");
  const pt   = clientToSVGCoords(svg, e.clientX, e.clientY);
  const cell = svgCoordsToCell(G, pt.x, pt.y);
  if (cell.r !== dragState.curR || cell.c !== dragState.curC) {
    dragState.curR = cell.r;
    dragState.curC = cell.c;
    updateDragOverlay();
  }
});

window.addEventListener("mouseup", () => {
  if (!dragState) return;
  const { patchIndex } = dragState;
  const { r1, r2, c1, c2 } = computeDragRect();
  dragState = null;

  const rows = r2 - r1 + 1;
  const cols = c2 - c1 + 1;
  const p    = patches[patchIndex];

  // Reject overlaps with other tentative patches (the dragged patch doesn't block itself)
  if (overlapsOthers(patchIndex, r1, c1, rows, cols)) {
    setMsg("Those cells are already taken", "#c0392b");
    render();
    return;
  }

  // Record previous position for undo, then place tentatively
  const prevPos = tentative[patchIndex] || null;
  tentative[patchIndex] = { r: r1, c: c1, rows, cols };
  undoStack.push({ patchIndex, prevPos });
  setMsg("");

  updateProgress();

  // Verify the whole board once every patch has a tentative position
  if (patches.every((_, i) => tentative[i])) {
    checkAllPlaced();
  } else {
    render();
  }
});

// ── Win verification ──────────────────────────────────────────────────────────

/**
 * Called when every patch has a tentative position.
 * Verifies all positions at once. Correct patches become confirmed; wrong
 * ones are cleared so the player can try again.
 */
function checkAllPlaced() {
  const wrongIdxs = patches.reduce((acc, p, i) => {
    const t = tentative[i];
    if (!t || t.r !== p.r || t.c !== p.c || t.rows !== p.rows || t.cols !== p.cols) acc.push(i);
    return acc;
  }, []);

  if (wrongIdxs.length === 0) {
    // All correct — win!
    patches.forEach((_, i) => { placed[i] = true; });
    solved = true;
    clearInterval(timerInt);
    const s  = Math.floor((Date.now() - startTime) / 1000);
    const m  = Math.floor(s / 60);
    const ss = s % 60;
    setMsg(`🎉 Solved! ${m}:${ss < 10 ? "0" : ""}${ss} · ${undoStack.length} moves · complexity ${patches.score}`, "#0F6E56");
    updateProgress();
    render();
  } else {
    render();
  }
}

// ── Core game actions ─────────────────────────────────────────────────────────

/** Generates a fresh random puzzle for the current grid size. */
function newPuzzle() {
  patches   = generatePuzzle(G, currentDiff ? currentDiff.complexity : undefined);
  tentative = {};
  placed    = {};
  dragState = null;
  undoStack = [];
  solved    = false;
  setMsg("");
  startTimer();
  updateProgress();
  render();
}

/** Resets the current puzzle back to its starting state. */
function resetPuzzle() {
  tentative = {};
  placed    = {};
  dragState = null;
  undoStack = [];
  solved    = false;
  setMsg("");
  startTimer();
  updateProgress();
  render();
}

/**
 * Undoes the most recent tentative placement, restoring the patch to wherever
 * it was before that drag (including null if it was unplaced).
 */
function undoLast() {
  if (!undoStack.length) {
    setMsg("Nothing to undo.");
    return;
  }
  const { patchIndex, prevPos } = undoStack.pop();
  tentative[patchIndex] = prevPos;
  dragState = null;
  solved    = false;
  setMsg("");
  updateProgress();
  render();
}

/** Shows a hint for a random unplaced patch. */
function showHint() {
  const remaining = patches
    .map((_, i) => i)
    .filter(i => !tentative[i] && !placed[i]);

  if (!remaining.length) {
    setMsg("All patches placed!");
    return;
  }

  const i = remaining[Math.floor(Math.random() * remaining.length)];
  const p = patches[i];
  setMsg(
    `Hint: find the ${p.cells}-cell ${p.ambiguous ? "patch (?)" : `${shapeName(p.rows, p.cols)} (${shapeLabel(p.rows, p.cols)})`}`,
    "#185FA5"
  );
}

// ── Difficulty button wiring ──────────────────────────────────────────────────

DIFFICULTIES.forEach((diff) => {
  document.getElementById(diff.id).addEventListener("click", () => {
    document.querySelectorAll(".dbtn").forEach(b => b.classList.remove("active"));
    document.getElementById(diff.id).classList.add("active");
    G = diff.grid;
    currentDiff = diff;
    newPuzzle();
  });
});

// Set default difficulty
currentDiff = DIFFICULTIES[0];

// ── Action button wiring ──────────────────────────────────────────────────────

document.getElementById("btn-new").addEventListener("click",   newPuzzle);
document.getElementById("btn-reset").addEventListener("click", resetPuzzle);
document.getElementById("btn-undo").addEventListener("click",  undoLast);
document.getElementById("btn-hint").addEventListener("click",  showHint);

// ── Start ─────────────────────────────────────────────────────────────────────

newPuzzle();
