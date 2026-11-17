import { describe, expect, it } from 'vitest';
import {
  layoutSheet,
  SHEET_LONG_EDGE,
  type Box,
} from '../../../src/server/capabilities/sources/domain/pipeline/sheet-layout.js';

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const sizes = [
  { width: 1200, height: 300 },
  { width: 40, height: 40 },
  { width: 300, height: 900 },
  { width: 640, height: 480 },
  { width: 2000, height: 2000 },
];

describe('contact sheet layout (M34 P3)', () => {
  it('keeps the long edge within the tier target, for 1…10 cells', () => {
    for (const longEdge of [SHEET_LONG_EDGE.light, SHEET_LONG_EDGE.strong]) {
      for (let count = 1; count <= 10; count++) {
        const layout = layoutSheet(
          Array.from(
            { length: count },
            (_, i) => sizes[i % sizes.length] ?? { width: 1, height: 1 },
          ),
          longEdge,
        );
        expect(Math.max(layout.width, layout.height)).toBeLessThanOrEqual(longEdge);
        expect(layout.cells.map((cell) => cell.n)).toEqual(
          Array.from({ length: count }, (_, i) => i + 1),
        );
      }
    }
  });

  it('puts each picture and its number band inside its own frame, frames apart', () => {
    const layout = layoutSheet(sizes);
    const canvas = { x: 0, y: 0, width: layout.width, height: layout.height };
    layout.cells.forEach((cell, index) => {
      expect(inside(cell.frame, canvas)).toBe(true);
      expect(inside(cell.image, cell.frame)).toBe(true);
      expect(inside(cell.label, cell.frame)).toBe(true);
      expect(overlaps(cell.label, cell.image)).toBe(false);
      for (const other of layout.cells.slice(index + 1)) {
        expect(overlaps(cell.frame, other.frame)).toBe(false);
      }
    });
  });

  it('keeps the aspect ratio and enlarges a small crop at most twice', () => {
    const [cell] = layoutSheet([{ width: 40, height: 20 }]).cells;
    expect(cell?.image.width).toBe(80);
    expect(cell?.image.height).toBe(40);
    const [wide] = layoutSheet([{ width: 3000, height: 1000 }]).cells;
    expect(Math.abs((wide?.image.width ?? 0) / (wide?.image.height ?? 1) - 3)).toBeLessThan(0.02);
  });

  it('refuses an empty sheet, more than ten cells and empty pictures', () => {
    expect(() => layoutSheet([])).toThrow('1…10 cells');
    expect(() =>
      layoutSheet(Array.from({ length: 11 }, () => ({ width: 9, height: 9 }))),
    ).toThrow();
    expect(() => layoutSheet([{ width: 0, height: 5 }])).toThrow('at least 1×1');
  });
});
