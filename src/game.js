/**
 * game.js
 * Game state management and UI wiring for Patches.
 * Depends on: generator.js, renderer.js
 */

// ── State ─────────────────────────────────────────────────────────────────────

let G         = 4;       // current grid size
let patches   = [];      // array of patch objects from generator
let placed    = {};      // patchIndex → boolean
let undoStack = [];      // ordered list of placed patch indices
let solved    = false;
let startTime = 0;
let timerInt  = null;

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { id: "d0", label: "Easy 4×4",   grid: 4 },
  { id: "d1", label: "Medium 5×5", grid: 5 },
  { id: "d2", label: "Hard 6×6",   grid: 6 },
];

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  clearInterval(timerInt);
  startTime = Date.now();
  document.getElementById("timerSpan").textContent = "0:00";
  timerInt = setInterval(() => {
    if (solved) return;
    const s = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    document.getElementById("timerSpan").textContent =
      `${m}:${ss < 10 ? "0" : ""}${ss}`;
  }, 1000);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function updateProgress() {
  const total = patches.length;
  const done  = patches.filter((_, i) => placed[i]).length;
  document.getElementById("progress-bar").style.width =
    (total ? (done / total) * 100 : 0) + "%";
}

// ── Message display ───────────────────────────────────────────────────────────

function setMsg(text, color = "var(--text-muted)") {
  const el = document.getElementById("msg");
  el.style.color   = color;
  el.textContent   = text;
}

// ── Core game actions ─────────────────────────────────────────────────────────

/**
 * Places a patch on the board (called when the player clicks a cell).
 * @param {number} i  Patch index
 */
function placePatch(i) {
  if (solved || placed[i]) return;
  placed[i] = true;
  undoStack.push(i);
  updateProgress();
  renderBoard(G, patches, placed, placePatch);
  checkWin();
}

/** Checks whether all patches have been placed and triggers the win state. */
function checkWin() {
  if (!patches.every((_, i) => placed[i])) return;
  solved = true;
  clearInterval(timerInt);
  const s  = Math.floor((Date.now() - startTime) / 1000);
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  setMsg(`🎉 Solved! ${m}:${ss < 10 ? "0" : ""}${ss} · ${undoStack.length} moves`, "#0F6E56");
}

/** Generates a fresh random puzzle for the current grid size. */
function newPuzzle() {
  patches   = generatePuzzle(G);
  placed    = {};
  undoStack = [];
  solved    = false;
  setMsg("");
  startTimer();
  updateProgress();
  renderBoard(G, patches, placed, placePatch);
}

/** Resets the current puzzle back to its starting state. */
function resetPuzzle() {
  placed    = {};
  undoStack = [];
  solved    = false;
  setMsg("");
  startTimer();
  updateProgress();
  renderBoard(G, patches, placed, placePatch);
}

/** Undoes the most recent patch placement. */
function undoLast() {
  if (!undoStack.length) {
    setMsg("Nothing to undo.");
    return;
  }
  const last  = undoStack.pop();
  placed[last] = false;
  solved       = false;
  setMsg("");
  updateProgress();
  renderBoard(G, patches, placed, placePatch);
}

/** Shows a hint for a random unplaced patch. */
function showHint() {
  const remaining = patches
    .map((_, i) => i)
    .filter(i => !placed[i]);

  if (!remaining.length) {
    setMsg("All patches placed!");
    return;
  }

  const i = remaining[Math.floor(Math.random() * remaining.length)];
  const p = patches[i];
  setMsg(
    `Hint: find the ${p.cells}-cell ${shapeName(p.rows, p.cols)} (${shapeLabel(p.rows, p.cols)})`,
    "#185FA5"
  );
}

// ── Difficulty button wiring ──────────────────────────────────────────────────

DIFFICULTIES.forEach(({ id, grid }) => {
  document.getElementById(id).addEventListener("click", () => {
    // Update active state
    document.querySelectorAll(".dbtn").forEach(b => b.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    G = grid;
    newPuzzle();
  });
});

// ── Action button wiring ──────────────────────────────────────────────────────

document.getElementById("btn-new").addEventListener("click",   newPuzzle);
document.getElementById("btn-reset").addEventListener("click", resetPuzzle);
document.getElementById("btn-undo").addEventListener("click",  undoLast);
document.getElementById("btn-hint").addEventListener("click",  showHint);

// ── Start ─────────────────────────────────────────────────────────────────────

newPuzzle();
