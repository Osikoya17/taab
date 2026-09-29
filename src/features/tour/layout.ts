export type Rect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

export type TourLayout = {
  /** The spotlight around the target, padded. */
  hole: Rect;
  /** The tip card sits below the target (true) or above it (false). */
  cardBelow: boolean;
  /** Distance from the top (below) or bottom (above) of the screen to the card. */
  cardOffset: number;
  /** A cubic curve from the card edge to just outside the spotlight. */
  arrow: { start: Point; control1: Point; control2: Point; end: Point };
  /** The two strokes of the arrowhead, from the tip. */
  head: [Point, Point];
};

const PADDING = 8;
/** Vertical room between the spotlight and the card, where the arrow runs. */
const GAP = 64;
/** Keep the arrow's start inside the card's rounded corners. */
const EDGE = 48;

/**
 * Where to put the tip card and its arrow for a target on screen. The card
 * goes on the side of the target with more room, and the arrow leaves the
 * card and arrives at the target vertically, as a soft S-curve.
 */
export function tourLayout(target: Rect, screen: { width: number; height: number }): TourLayout {
  const hole = { x: target.x - PADDING, y: target.y - PADDING, width: target.width + PADDING * 2, height: target.height + PADDING * 2 };
  const centerX = hole.x + hole.width / 2;
  const cardBelow = hole.y + hole.height / 2 < screen.height / 2;

  // Offset the start sideways so the curve reads as an arrow, not a line.
  const drift = centerX < screen.width / 2 ? 44 : -44;
  const startX = Math.min(Math.max(centerX + drift, EDGE), screen.width - EDGE);
  const startY = cardBelow ? hole.y + hole.height + GAP : hole.y - GAP;
  const endY = cardBelow ? hole.y + hole.height + 6 : hole.y - 6;
  const bend = (cardBelow ? -1 : 1) * GAP * 0.55;

  return {
    hole,
    cardBelow,
    cardOffset: cardBelow ? startY : screen.height - startY,
    arrow: {
      start: { x: startX, y: startY },
      control1: { x: startX, y: startY + bend },
      control2: { x: centerX, y: endY - bend },
      end: { x: centerX, y: endY },
    },
    head: cardBelow
      ? [{ x: centerX - 7, y: endY + 9 }, { x: centerX + 7, y: endY + 9 }]
      : [{ x: centerX - 7, y: endY - 9 }, { x: centerX + 7, y: endY - 9 }],
  };
}
