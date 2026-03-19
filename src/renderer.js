/**
 * renderer.js
 * Handles all SVG drawing for the Patches board.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const PAD    = 4;   // board padding (px inside the 420×420 viewBox)
const GAP    = 2;   // gap between cells (px)
const SZ     = 420; // SVG viewBox size

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Returns the pixel size of one cell for a given grid dimension.
 * @param {number} g  Grid size
 * @returns {number}
 */
function cellSize(g) {
  return Math.floor((SZ - PAD * 2 - GAP * (g - 1)) / g);
}

/**
 * Returns the SVG x-coordinate of the left edge of column c.
 * @param {number} g  Grid size
 * @param {number} c  Column index
 * @returns {number}
 */
function cellX(g, c) {
  return PAD + c * (cellSize(g) + GAP);
}

/**
 * Returns the SVG y-coordinate of the top edge of row r.
 * @param {number} g  Grid size
 * @param {number} r  Row index
 * @returns {number}
 */
function cellY(g, r) {
  return PAD + r * (cellSize(g) + GAP);
}

/**
 * Returns the bounding rect (x, y, w, h) for a patch in SVG coordinates.
 * @param {number} g     Grid size
 * @param {number} r     Top row of patch
 * @param {number} c     Left column of patch
 * @param {number} rows  Patch height in cells
 * @param {number} cols  Patch width in cells
 * @returns {{x:number, y:number, w:number, h:number}}
 */
function patchRect(g, r, c, rows, cols) {
  const cs = cellSize(g);
  return {
    x: cellX(g, c),
    y: cellY(g, r),
    w: cols * (cs + GAP) - GAP,
    h: rows * (cs + GAP) - GAP,
  };
}

/**
 * Converts a hex colour + alpha to an rgba() string.
 * @param {string} hex   e.g. "#E40101"
 * @param {number} a     Alpha 0–1
 * @returns {string}
 */
function hexRgba(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Creates an SVG element with given attributes and optional event listeners.
 * @param {string} tag
 * @param {Object} attrs
 * @param {Object} [events]
 * @returns {SVGElement}
 */
function svgE(tag, attrs, events = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const [k, v] of Object.entries(events)) el.addEventListener(k, v);
  return el;
}

// ── Drawing functions ─────────────────────────────────────────────────────────

/**
 * Draws the numbered badge in the top-left corner of a placed patch.
 * @param {SVGElement} svg
 * @param {number}     x     Top-left x of badge
 * @param {number}     y     Top-left y of badge
 * @param {number}     label Cell count to display
 * @param {string}     color Hex colour
 */
function drawBadge(svg, x, y, label, color) {
  svg.appendChild(svgE("rect", { x, y, width: 24, height: 24, fill: color, rx: 5 }));
  svg.appendChild(
    svgE("text", {
      x: x + 12,
      y: y + 17,
      "text-anchor":  "middle",
      "font-size":    13,
      "font-weight":  700,
      fill:           "white",
      "pointer-events": "none",
    })
  );
  // Set text content separately to avoid attribute encoding issues
  const t = svg.lastChild;
  t.textContent = label;
}

/**
 * Draws a single patch that has already been placed by the player.
 * Shows a solid filled rectangle with a badge showing the cell count.
 * @param {SVGElement} svg
 * @param {number}     g     Grid size
 * @param {Object}     patch Patch data object
 */
function drawPlacedPatch(svg, g, patch) {
  const rect = patchRect(g, patch.r, patch.c, patch.rows, patch.cols);
  svg.appendChild(
    svgE("rect", {
      x:      rect.x,
      y:      rect.y,
      width:  rect.w,
      height: rect.h,
      fill:   hexRgba(patch.color, 0.88),
      rx:     8,
    })
  );
  drawBadge(svg, rect.x + 7, rect.y + 7, patch.cells, patch.color);
}

/**
 * Draws an unplaced patch region.
 * Each cell in the patch is individually drawn (so they look like ordinary
 * grid cells). The clue cell is tinted and shows the count + shape symbol.
 * @param {SVGElement}   svg
 * @param {number}       g          Grid size
 * @param {Object}       patch      Patch data object
 * @param {Function}     onCellClick  Called when any cell in the patch is clicked
 */
function drawUnplacedPatch(svg, g, patch, onCellClick) {
  const cs = cellSize(g);

  for (let r = patch.r; r < patch.r + patch.rows; r++) {
    for (let c = patch.c; c < patch.c + patch.cols; c++) {
      const cx     = cellX(g, c);
      const cy     = cellY(g, r);
      const isClue = r === patch.clueR && c === patch.clueC;

      // Cell background
      const cell = svgE(
        "rect",
        {
          x:              cx,
          y:              cy,
          width:          cs,
          height:         cs,
          fill:           isClue ? hexRgba(patch.color, 0.18) : "#f5f3ef",
          rx:             3,
          stroke:         isClue ? hexRgba(patch.color, 0.55) : "none",
          "stroke-width": isClue ? 1.5 : 0,
          cursor:         "pointer",
        },
        { click: onCellClick }
      );
      svg.appendChild(cell);

      // Clue text: number + shape symbol
      if (isClue) {
        const sz      = Math.min(cs, cs); // square ref
        const numFz   = sz > 55 ? 15 : sz > 40 ? 12 : 10;
        const shapeFz = sz > 55 ? 11 : sz > 40 ? 9 : 8;

        const numEl = svgE("text", {
          x:                cx + cs / 2,
          y:                cy + cs * 0.42,
          "text-anchor":    "middle",
          "font-size":      numFz,
          "font-weight":    600,
          fill:             hexRgba(patch.color, 0.9),
          "pointer-events": "none",
        });
        numEl.textContent = patch.cells;
        svg.appendChild(numEl);

        const symEl = svgE("text", {
          x:                cx + cs / 2,
          y:                cy + cs * 0.42 + shapeFz + 3,
          "text-anchor":    "middle",
          "font-size":      shapeFz,
          fill:             hexRgba(patch.color, 0.72),
          "pointer-events": "none",
        });
        symEl.textContent = shapeLabel(patch.rows, patch.cols);
        svg.appendChild(symEl);
      }

      // Invisible full-cell click overlay (easier to tap)
      svg.appendChild(
        svgE(
          "rect",
          {
            x:      cx,
            y:      cy,
            width:  cs,
            height: cs,
            fill:   "transparent",
            cursor: "pointer",
          },
          { click: onCellClick }
        )
      );
    }
  }
}

/**
 * Fully re-renders the board SVG.
 * @param {number}   g       Grid size
 * @param {Array}    patches Array of patch objects
 * @param {Object}   placed  Map of patchIndex → boolean
 * @param {Function} onPlace Called with (patchIndex) when a cell is clicked
 */
function renderBoard(g, patches, placed, onPlace) {
  const svg = document.getElementById("board-svg");
  svg.innerHTML = "";

  // Board background
  svg.appendChild(svgE("rect", { x: 0, y: 0, width: SZ, height: SZ, fill: "#e8e6e0" }));

  // Empty grid cells (drawn first as base layer)
  const cs = cellSize(g);
  for (let r = 0; r < g; r++) {
    for (let c = 0; c < g; c++) {
      svg.appendChild(
        svgE("rect", {
          x:      cellX(g, c),
          y:      cellY(g, r),
          width:  cs,
          height: cs,
          fill:   "#f5f3ef",
          rx:     3,
        })
      );
    }
  }

  // Patches
  patches.forEach((patch, i) => {
    if (placed[i]) {
      drawPlacedPatch(svg, g, patch);
    } else {
      drawUnplacedPatch(svg, g, patch, () => onPlace(i));
    }
  });
}
