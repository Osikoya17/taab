import type { View } from 'react-native';
import { create } from 'zustand';

import type { Rect } from './layout';

export type TourTargetId = 'create' | 'balance' | 'add' | 'settle' | 'groups' | 'expenses';

export type TourStep = { target: TourTargetId; title: string; body: string };

/** In order. Steps whose target isn't on screen (e.g. no taabs yet) are skipped. */
export const TOUR_STEPS: TourStep[] = [
  { target: 'create', title: 'Start here', body: 'Make a taab for your flat, a trip or a night out. You can invite friends once it’s made.' },
  { target: 'balance', title: 'Where you stand', body: 'Your balance across every taab. Green means friends owe you; coral means you owe.' },
  { target: 'add', title: 'Add a bill', body: 'Tap + whenever someone pays. Choose who was involved and taab does the maths.' },
  { target: 'settle', title: 'Settle up', body: 'When it’s time to pay back, taab shows who pays whom, in as few payments as possible.' },
  { target: 'groups', title: 'Your taabs', body: 'Every taab you’re in lives here. Open one to see its balances or invite more friends.' },
  { target: 'expenses', title: 'Every bill in one place', body: 'Bills and payments from all your taabs, newest first.' },
];

type TourTargets = {
  nodes: Partial<Record<TourTargetId, View>>;
  register: (id: TourTargetId, node: View | null) => void;
};

/** Screens register the views the tour can point at. Not persisted. */
export const useTourTargets = create<TourTargets>((set) => ({
  nodes: {},
  register: (id, node) =>
    set((state) => {
      if (state.nodes[id] === (node ?? undefined)) return state;
      const nodes = { ...state.nodes };
      if (node) nodes[id] = node;
      else delete nodes[id];
      return { nodes };
    }),
}));

/** The target's position on screen, or null if it isn't laid out. */
export function measureTarget(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
    } catch {
      resolve(null);
    }
  });
}
