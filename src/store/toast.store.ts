import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'error';

export type ToastMessage = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastState = {
  current: ToastMessage | null;
  show: (toast: Omit<ToastMessage, 'id' | 'tone'> & { tone?: ToastTone }) => void;
  dismiss: (id?: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: ({ tone = 'neutral', ...toast }) => set({ current: { ...toast, tone, id: nextId++ } }),
  dismiss: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

/** Imperative helper usable from mutations and event handlers. */
export const toast = {
  show: (title: string, description?: string) => useToastStore.getState().show({ title, description }),
  success: (title: string, description?: string) => useToastStore.getState().show({ title, description, tone: 'success' }),
  error: (title: string, description?: string) => useToastStore.getState().show({ title, description, tone: 'error' }),
};
