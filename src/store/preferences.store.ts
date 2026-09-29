import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CurrencyCode } from '@/types/models';

/**
 * Device-level preferences that are not sensitive and not account data.
 * Account data (currency, name) lives on the backend via usersService.
 */
type PreferencesState = {
  hasSeenOnboarding: boolean;
  /** Last time we asked for notification permission, to avoid nagging. */
  notificationPromptedAt: string | null;
  hydrated: boolean;
  pendingInvite: string | null;
  /**
   * Show every amount in this currency at today's rates. `null` shows each
   * taab in its own currency. Display only: the ledger never changes.
   */
  displayCurrency: CurrencyCode | null;
  /** Light, dark, or follow the device. */
  appearance: Appearance;
  /** The first-run walkthrough on Home has been finished or skipped. */
  hasSeenTour: boolean;
  setPendingInvite: (token: string | null) => void;
  completeOnboarding: () => void;
  markNotificationPrompted: () => void;
  setDisplayCurrency: (currency: CurrencyCode | null) => void;
  setAppearance: (appearance: Appearance) => void;
  completeTour: () => void;
  replayTour: () => void;
};

export type Appearance = 'system' | 'light' | 'dark';

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      notificationPromptedAt: null,
      hydrated: false,
      pendingInvite: null,
      displayCurrency: null,
      appearance: 'system',
      hasSeenTour: false,
      setPendingInvite: (pendingInvite) => set({ pendingInvite }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      markNotificationPrompted: () => set({ notificationPromptedAt: new Date().toISOString() }),
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      setAppearance: (appearance) => set({ appearance }),
      completeTour: () => set({ hasSeenTour: true }),
      replayTour: () => set({ hasSeenTour: false }),
    }),
    {
      name: 'taab.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hasSeenOnboarding, notificationPromptedAt, pendingInvite, displayCurrency, appearance, hasSeenTour }) => ({ hasSeenOnboarding, notificationPromptedAt, pendingInvite, displayCurrency, appearance, hasSeenTour }),
      onRehydrateStorage: () => () => usePreferences.setState({ hydrated: true }),
    },
  ),
);
