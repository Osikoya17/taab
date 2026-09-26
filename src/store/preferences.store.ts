import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  setPendingInvite: (token: string | null) => void;
  completeOnboarding: () => void;
  markNotificationPrompted: () => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      notificationPromptedAt: null,
      hydrated: false,
      pendingInvite: null,
      setPendingInvite: (pendingInvite) => set({ pendingInvite }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      markNotificationPrompted: () => set({ notificationPromptedAt: new Date().toISOString() }),
    }),
    {
      name: 'taab.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hasSeenOnboarding, notificationPromptedAt, pendingInvite }) => ({ hasSeenOnboarding, notificationPromptedAt, pendingInvite }),
      onRehydrateStorage: () => () => usePreferences.setState({ hydrated: true }),
    },
  ),
);
