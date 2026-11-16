// M34 P3: the contact sheet's geometry (pure). N ≤ 10 crops in one grid of equal cells, each
// with a band for its number above it; the sheet's long edge stays within the tier's target.

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  x: number;
  y: number;
}

export interface SheetCell {
  /** The cell's number, 1…N, in input order. */
  n: number;
  frame: Box;
  label: Box;
  image: Box;
}

export interface SheetLayout extends Size {
  cells: SheetCell[];
}

/** P0: one closed question over ≤10 crops per sheet; single crops were worse and dearer. */
export const SHEET_LIMIT = 10;
/** The long edge per model tier: the light model reads 1000 px; the strong one is dearer per pixel. */
export const SHEET_LONG_EDGE = { light: 1000, strong: 700 } as const;
/** Small crops (a ticked letter) are enlarged at most this much. */
const MAX_UPSCALE = 2;
/** Space between the frame and the picture. */
const PAD = 4;
const MIN_BOX = 8;

const bandFor = (longEdge: number) => Math.max(16, Math.round(longEdge * 0.045));

interface Grid {
  cols: number;
  rows: number;
  scales: number[];
}

/** Every crop's scale for a grid of `cols` columns, or null when the cells would be too small. */
function gridOf(sizes: readonly Size[], cols: number, longEdge: number): Grid | null {
  const rows = Math.ceil(sizes.length / cols);
  const boxWidth = Math.floor(longEdge / cols) - 2 * PAD;
  const boxHeight = Math.floor(longEdge / rows) - bandFor(longEdge) - PAD;
  if (boxWidth < MIN_BOX || boxHeight < MIN_BOX) return null;
  const scales = sizes.map((size) =>
    Math.min(boxWidth / size.width, boxHeight / size.height, MAX_UPSCALE),
  );
  return { cols, rows, scales };
}

/** The grid whose smallest crop is shown largest (the crop the model would read worst). */
function bestGrid(sizes: readonly Size[], longEdge: number): Grid {
  let best: Grid | null = null;
  for (let cols = 1; cols <= sizes.length; cols++) {
    const grid = gridOf(sizes, cols, longEdge);
    if (grid && (!best || Math.min(...grid.scales) > Math.min(...best.scales) + 1e-9)) best = grid;
  }
  if (!best) throw new Error('the sheet is too small for its cells');
  return best;
}

function checkSizes(sizes: readonly Size[]): void {
  if (sizes.length === 0 || sizes.length > SHEET_LIMIT) {
    throw new Error(`a sheet holds 1…${SHEET_LIMIT} cells, not ${sizes.length}`);
  }
  if (sizes.some((size) => size.width < 1 || size.height < 1)) {
    throw new Error('every cell needs a picture of at least 1×1 px');
  }
}

/**
 * Lays out N ≤ 10 pictures (sizes only) in equal cells: frame, a number band on top, and the
 * picture scaled to fit and centered. Width and height never exceed `longEdge`.
 */
export function layoutSheet(
  sizes: readonly Size[],
  longEdge: number = SHEET_LONG_EDGE.light,
): SheetLayout {
  checkSizes(sizes);
  const band = bandFor(longEdge);
  const grid = bestGrid(sizes, longEdge);
  const scaled = sizes.map((size, index) => {
    const scale = grid.scales[index] ?? 1;
    return {
      width: Math.max(1, Math.floor(size.width * scale)),
      height: Math.max(1, Math.floor(size.height * scale)),
    };
  });
  const cellWidth = Math.max(...scaled.map((size) => size.width)) + 2 * PAD;
  const cellHeight = band + Math.max(...scaled.map((size) => size.height)) + PAD;
  const cells = scaled.map((size, index): SheetCell => {
    const x = (index % grid.cols) * cellWidth;
    const y = Math.floor(index / grid.cols) * cellHeight;
    return {
      n: index + 1,
      frame: { x, y, width: cellWidth, height: cellHeight },
      label: { x: x + 1, y: y + 1, width: cellWidth - 2, height: band - 2 },
      image: { x: x + Math.floor((cellWidth - size.width) / 2), y: y + band, ...size },
    };
  });
  return { width: grid.cols * cellWidth, height: grid.rows * cellHeight, cells };
}
