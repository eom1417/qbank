/**
 * Contact-sheet layout: up to ten numbered question crops packed in a grid, then scaled as a
 * whole so its long edge fits the target. Pure maths; the imaging step draws what this returns.
 */

export interface Size {
  width: number;
  height: number;
}

interface Placement {
  /** Position in the input list. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Top of the label band drawn above the crop. */
  labelY: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  columns: number;
  placements: Placement[];
}

export const MAX_SHEET_ITEMS = 10;

interface Grid {
  columns: number;
  cellWidth: number;
  label: number;
  gap: number;
}

function placeAll(sizes: readonly Size[], grid: Grid): SheetLayout {
  const placements: Placement[] = [];
  let y = 0;
  for (let start = 0; start < sizes.length; start += grid.columns) {
    const row = sizes.slice(start, start + grid.columns).map((s) => ({
      width: grid.cellWidth,
      height: Math.round((s.height * grid.cellWidth) / s.width),
    }));
    const rowHeight = Math.max(...row.map((r) => r.height));
    row.forEach((r, col) => {
      const x = col * (grid.cellWidth + grid.gap);
      placements.push({ index: start + col, x, y: y + grid.label, labelY: y, ...r });
    });
    y += grid.label + rowHeight + grid.gap;
  }
  const width = grid.columns * grid.cellWidth + (grid.columns - 1) * grid.gap;
  return { width, height: Math.max(0, y - grid.gap), columns: grid.columns, placements };
}

function scaleLayout(layout: SheetLayout, factor: number): SheetLayout {
  const s = (v: number): number => Math.round(v * factor);
  return {
    width: s(layout.width),
    height: s(layout.height),
    columns: layout.columns,
    placements: layout.placements.map((p) => ({
      index: p.index,
      x: s(p.x),
      y: s(p.y),
      width: s(p.width),
      height: s(p.height),
      labelY: s(p.labelY),
    })),
  };
}

/**
 * Packs the crops at `cellWidth` in 1..4 columns, keeps the grid whose shape is closest to
 * square (largest scale after fitting `maxLongEdge`), and scales it down to fit (never up).
 */
export function layoutSheet(
  sizes: readonly Size[],
  maxLongEdge: number,
  cellWidth: number,
  label = 40,
): SheetLayout {
  if (sizes.length === 0 || sizes.length > MAX_SHEET_ITEMS) {
    throw new RangeError(`a sheet holds 1..${MAX_SHEET_ITEMS} crops, got ${sizes.length}`);
  }
  let best: { layout: SheetLayout; factor: number } | null = null;
  for (let columns = 1; columns <= Math.min(4, sizes.length); columns += 1) {
    const layout = placeAll(sizes, { columns, cellWidth, label, gap: Math.round(label / 2) });
    const factor = Math.min(1, maxLongEdge / Math.max(layout.width, layout.height));
    if (!best || factor > best.factor) best = { layout, factor };
  }
  if (!best) throw new RangeError('no layout');
  return scaleLayout(best.layout, best.factor);
}

/** Size after fitting the long edge to `maxLongEdge` (never enlarged). */
export function fitLongEdge(size: Size, maxLongEdge: number): Size {
  const factor = Math.min(1, maxLongEdge / Math.max(size.width, size.height));
  return { width: Math.round(size.width * factor), height: Math.round(size.height * factor) };
}

/** Rough vision input-token cost of an image as sent (width × height / 750). */
export function imageTokens(size: Size): number {
  return Math.ceil((size.width * size.height) / 750);
}
