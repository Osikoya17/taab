import { tourLayout } from './layout';

const screen = { width: 375, height: 812 };

describe('tour layout', () => {
  it('puts the card below a target near the top, with the arrow pointing up at it', () => {
    const layout = tourLayout({ x: 20, y: 120, width: 335, height: 140 }, screen);
    expect(layout.hole).toEqual({ x: 12, y: 112, width: 351, height: 156 });
    expect(layout.cardBelow).toBe(true);
    // The arrow runs from the card up to just under the spotlight.
    expect(layout.arrow.start.y).toBeGreaterThan(layout.arrow.end.y);
    expect(layout.arrow.end.y).toBe(112 + 156 + 6);
    expect(layout.cardOffset).toBe(layout.arrow.start.y);
    expect(layout.head.every((p) => p.y > layout.arrow.end.y)).toBe(true);
  });

  it('puts the card above a target in the tab bar, with the arrow pointing down', () => {
    const layout = tourLayout({ x: 164, y: 740, width: 46, height: 46 }, screen);
    expect(layout.cardBelow).toBe(false);
    expect(layout.arrow.end).toEqual({ x: 187, y: 732 - 6 });
    expect(layout.arrow.start.y).toBeLessThan(layout.arrow.end.y);
    expect(layout.cardOffset).toBe(screen.height - layout.arrow.start.y);
    expect(layout.head.every((p) => p.y < layout.arrow.end.y)).toBe(true);
  });

  it('keeps the arrow start inside the card at the screen edges', () => {
    const left = tourLayout({ x: 0, y: 750, width: 40, height: 40 }, screen);
    const right = tourLayout({ x: 340, y: 750, width: 35, height: 40 }, screen);
    expect(left.arrow.start.x).toBeGreaterThanOrEqual(48);
    expect(right.arrow.start.x).toBeLessThanOrEqual(375 - 48);
  });
});
