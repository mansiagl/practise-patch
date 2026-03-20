/**
 * renderer.js
 * Handles all SVG drawing for the Patches board.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const PAD    = 4;   // board padding (px inside the 420×420 viewBox)
const GAP    = 2;   // gap between cells (px)
const SZ     = 420; // SVG viewBox size

// ── Geometry helpers ──────────────────────────────────────────────────────────

function cellSize(g) {
  return Math.floor((SZ - PAD * 2 - GAP * (g - 1)) / g);
}

function cellX(g, c) {
  return PAD + c * (cellSize(g) + GAP);
}

function cellY(g, r) {
  return PAD + r * (cellSize(g) + GAP);
}

function patchRect(g, r, c, rows, cols) {
  const cs = cellSize(g);
  return {
    x: cellX(g, c),
    y: cellY(g, r),
    w: cols * (cs + GAP) - GAP,
    h: rows * (cs + GAP) - GAP,
  };
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexRgba(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── SVG element factory ───────────────────────────────────────────────────────

function svgE(tag, attrs, events = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const [k, v] of Object.entries(events)) el.addEventListener(k, v);
  return el;
}

// ── Coordinate conversion ─────────────────────────────────────────────────────

/** Converts client (viewport) coordinates to SVG coordinate space. */
function clientToSVGCoords(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/** Converts SVG coordinates to a grid {r, c}, clamped to the board. */
function svgCoordsToCell(g, svgX, svgY) {
  const step = cellSize(g) + GAP;
  return {
    r: Math.max(0, Math.min(g - 1, Math.floor((svgY - PAD) / step))),
    c: Math.max(0, Math.min(g - 1, Math.floor((svgX - PAD) / step))),
  };
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawBadge(svg, x, y, label, color) {
  svg.appendChild(svgE("rect", { x, y, width: 24, height: 24, fill: color, rx: 5 }));
  const t = svgE("text", {
    x: x + 12, y: y + 17,
    "text-anchor": "middle", "font-size": 13, "font-weight": 700,
    fill: "white", "pointer-events": "none",
  });
  t.textContent = label;
  svg.appendChild(t);
}

// ── Patch drawing ─────────────────────────────────────────────────────────────

/**
 * Draws a confirmed (win-verified) patch. Solid fill, no interaction.
 */
function drawPlacedPatch(svg, g, patch) {
  const rect = patchRect(g, patch.r, patch.c, patch.rows, patch.cols);
  svg.appendChild(svgE("rect", {
    x: rect.x, y: rect.y, width: rect.w, height: rect.h,
    fill: hexRgba(patch.color, 0.88), rx: 8,
  }));
  drawBadge(svg, rect.x + 7, rect.y + 7, patch.cells, patch.color);
}

/**
 * Draws a tentatively placed patch (player's guess — not yet verified).
 * Uses a dashed border and semi-transparent fill to signal it's still movable.
 * The whole area acts as a drag handle for repositioning.
 *
 * @param {SVGElement} svg
 * @param {number}     g          Grid size
 * @param {Object}     pos        Tentative position { r, c, rows, cols }
 * @param {Object}     patch      Patch data (for color, cells count)
 * @param {number}     patchIndex
 * @param {Function}   onDragStart  Called with (patchIndex, r, c) on mousedown
 */
function drawTentativePatch(svg, g, pos, patch, patchIndex, onDragStart) {
  const rect = patchRect(g, pos.r, pos.c, pos.rows, pos.cols);

  // Semi-transparent dashed fill — signals "pending, can be moved"
  svg.appendChild(svgE("rect", {
    x: rect.x, y: rect.y, width: rect.w, height: rect.h,
    fill:             hexRgba(patch.color, 0.45),
    rx:               8,
    stroke:           hexRgba(patch.color, 0.85),
    "stroke-width":   2,
    "stroke-dasharray": "6,3",
  }));

  // Badge pinned to clue cell — never moves regardless of tentative rect position
  drawBadge(svg, cellX(g, patch.clueC) + 7, cellY(g, patch.clueR) + 7, patch.cells, patch.color);

  // Transparent drag handle on top
  svg.appendChild(svgE("rect", {
    x: rect.x, y: rect.y, width: rect.w, height: rect.h,
    fill: "transparent", cursor: "grab", rx: 8,
  }, {
    mousedown: (e) => {
      e.preventDefault();
      const svgEl = document.getElementById("board-svg");
      const pt    = clientToSVGCoords(svgEl, e.clientX, e.clientY);
      const cell  = svgCoordsToCell(g, pt.x, pt.y);
      onDragStart(patchIndex, cell.r, cell.c);
    },
  }));
}

/**
 * Draws an unplaced patch. Only the clue cell is visible — the rest of the
 * region is hidden so the player must discover the shape's location.
 * The clue cell is the drag anchor.
 *
 * @param {SVGElement} svg
 * @param {number}     g          Grid size
 * @param {Object}     patch      Patch data
 * @param {number}     patchIndex
 * @param {Function}   onDragStart  Called with (patchIndex, r, c) on mousedown
 */
function drawUnplacedPatch(svg, g, patch, patchIndex, onDragStart) {
  const cs = cellSize(g);
  const cx = cellX(g, patch.clueC);
  const cy = cellY(g, patch.clueR);

  // Clue cell — tinted background with border
  svg.appendChild(svgE("rect", {
    x: cx, y: cy, width: cs, height: cs,
    fill:           hexRgba(patch.color, 0.18),
    rx:             3,
    stroke:         hexRgba(patch.color, 0.55),
    "stroke-width": 1.5,
    cursor:         "crosshair",
  }));

  // Count label
  const numFz   = cs > 55 ? 15 : cs > 40 ? 12 : 10;
  const shapeFz = cs > 55 ? 11 : cs > 40 ? 9 : 8;

  const numEl = svgE("text", {
    x: cx + cs / 2, y: cy + cs * 0.42,
    "text-anchor": "middle", "font-size": numFz, "font-weight": 600,
    fill: hexRgba(patch.color, 0.9), "pointer-events": "none",
  });
  numEl.textContent = patch.cells;
  svg.appendChild(numEl);

  // Shape symbol
  const symEl = svgE("text", {
    x: cx + cs / 2, y: cy + cs * 0.42 + shapeFz + 3,
    "text-anchor": "middle", "font-size": shapeFz,
    fill: hexRgba(patch.color, 0.72), "pointer-events": "none",
  });
  symEl.textContent = shapeLabel(patch.rows, patch.cols);
  svg.appendChild(symEl);

  // Transparent full-cell drag handle (on top of text)
  svg.appendChild(svgE("rect", {
    x: cx, y: cy, width: cs, height: cs,
    fill: "transparent", cursor: "crosshair",
  }, {
    mousedown: (e) => {
      e.preventDefault();
      onDragStart(patchIndex, patch.clueR, patch.clueC);
    },
  }));
}

// ── Board render ──────────────────────────────────────────────────────────────

/**
 * Fully re-renders the board SVG.
 *
 * @param {number}   g          Grid size
 * @param {Array}    patches    Patch objects from generator
 * @param {Object}   placed     patchIndex → boolean (confirmed on win)
 * @param {Object}   tentative  patchIndex → { r, c, rows, cols } | null
 * @param {Function} onDragStart Called with (patchIndex, r, c) when a drag begins
 */
function renderBoard(g, patches, placed, tentative, onDragStart) {
  const svg = document.getElementById("board-svg");
  svg.innerHTML        = "";
  svg.style.userSelect = "none";

  // Board background
  svg.appendChild(svgE("rect", { x: 0, y: 0, width: SZ, height: SZ, fill: "#e8e6e0" }));

  // Empty grid cells (base layer — no interaction)
  const cs = cellSize(g);
  for (let r = 0; r < g; r++) {
    for (let c = 0; c < g; c++) {
      svg.appendChild(svgE("rect", {
        x: cellX(g, c), y: cellY(g, r), width: cs, height: cs,
        fill: "#f5f3ef", rx: 3,
      }));
    }
  }

  // Patches — three possible states per patch
  patches.forEach((patch, i) => {
    if (placed[i]) {
      drawPlacedPatch(svg, g, patch);
    } else if (tentative[i]) {
      drawTentativePatch(svg, g, tentative[i], patch, i, onDragStart);
    } else {
      drawUnplacedPatch(svg, g, patch, i, onDragStart);
    }
  });

  // Drag overlay rect — hidden by default, updated live during drag
  svg.appendChild(svgE("rect", {
    id: "drag-overlay", display: "none",
    fill: "transparent", rx: 8, "pointer-events": "none",
  }));
}
