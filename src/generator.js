/**
 * generator.js
 * Generates random valid Patches puzzles using recursive guillotine cuts.
 * Each puzzle is a list of non-overlapping rectangles that together fill an N×N grid.
 */

const PALETTE = [
  "#E40101", // red
  "#C49000", // gold
  "#7C4DFF", // purple
  "#00A651", // green
  "#0097A7", // teal
  "#E48000", // orange
  "#D4537E", // pink
  "#5B7FDB", // blue
  "#8D4E2A", // brown
  "#2E8B57", // forest green
];

/**
 * Returns the shape symbol for a patch.
 * ■ = square, ▬ = wide rectangle, ▮ = tall rectangle
 * @param {number} rows
 * @param {number} cols
 * @returns {string}
 */
function shapeLabel(rows, cols) {
  if (rows === cols) return "■";
  if (cols > rows)  return "▬";
  return "▮";
}

/**
 * Returns a human-readable shape name.
 * @param {number} rows
 * @param {number} cols
 * @returns {string}
 */
function shapeName(rows, cols) {
  if (rows === cols) return "square";
  if (cols > rows)  return "wide rectangle";
  return "tall rectangle";
}

/**
 * Attempts to partition an N×N grid into rectangles using random guillotine cuts.
 * Returns an array of patch objects, or null if the attempt fails.
 *
 * @param {number} g  Grid size (e.g. 4, 5, 6)
 * @returns {Array|null}
 */
function attempt(g) {
  const rects = [];
  const colors = [...PALETTE].sort(() => Math.random() - 0.5);

  function cut(r0, c0, rows, cols, depth) {
    const area = rows * cols;
    if (area < 2) return false;
    const maxDepth = g === 4 ? 3 : g === 5 ? 4 : 5;

    // Probability of stopping and creating a patch here
    const stopChance =
      depth >= maxDepth ? 1 :
      area <= 2          ? 0.9 :
      area <= 4          ? 0.6 :
      area <= 6          ? 0.35 :
                           0.15;

    if (Math.random() < stopChance || !(rows > 1 || cols > 1)) {
      if (rects.length >= PALETTE.length) return false;
      rects.push({
        r:     r0,
        c:     c0,
        rows,
        cols,
        color: colors[rects.length % colors.length],
        cells: rows * cols,
        // Clue is shown in the top-left cell of the patch
        clueR: r0,
        clueC: c0,
      });
      return true;
    }

    const canH = rows > 1;
    const canV = cols > 1;
    const doH  = canH && canV ? Math.random() < 0.5 : canH;

    if (doH) {
      const sp = 1 + Math.floor(Math.random() * (rows - 1));
      return (
        cut(r0, c0, sp, cols, depth + 1) &&
        cut(r0 + sp, c0, rows - sp, cols, depth + 1)
      );
    } else {
      const sp = 1 + Math.floor(Math.random() * (cols - 1));
      return (
        cut(r0, c0, rows, sp, depth + 1) &&
        cut(r0, c0 + sp, rows, cols - sp, depth + 1)
      );
    }
  }

  return cut(0, 0, g, g, 0) && rects.length >= 2 ? rects : null;
}

/**
 * Fallback generator: fills grid row-by-row with random-width strips.
 * Always succeeds.
 *
 * @param {number} g  Grid size
 * @returns {Array}
 */
function rowStrips(g) {
  const rects = [];
  const colors = [...PALETTE].sort(() => Math.random() - 0.5);

  for (let r = 0; r < g; r++) {
    let c = 0;
    while (c < g) {
      const maxW = g - c;
      let w = maxW <= 2 ? maxW : 2 + Math.floor(Math.random() * Math.min(maxW - 2, 2));
      if (maxW - w === 1) w++; // never leave a single-cell remainder
      rects.push({
        r,
        c,
        rows:  1,
        cols:  w,
        color: colors[rects.length % colors.length],
        cells: w,
        clueR: r,
        clueC: c,
      });
      c += w;
    }
  }
  return rects;
}

/**
 * Generates a valid puzzle for an N×N grid.
 * Tries the guillotine approach up to 300 times, then falls back to row strips.
 *
 * @param {number} g  Grid size (4 | 5 | 6)
 * @returns {Array}   Array of patch objects
 */
function generatePuzzle(g) {
  for (let t = 0; t < 300; t++) {
    const result = attempt(g);
    if (result) return result;
  }
  return rowStrips(g);
}
