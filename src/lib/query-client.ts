import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { isServiceError } from '@/services/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately and refresh in the background.
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        if (isServiceError(error) && ['not_found', 'forbidden', 'validation'].includes(error.code)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 0,
    },
  },
});

/** Recent server data is cached on device so the app opens instantly and works offline. */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'taab.query-cache.v1',
  throttleTime: 1000,
});

let wired = false;

/** Connects TanStack Query to device connectivity and app foreground state. */
export function wireQueryEnvironment() {
  if (wired) return;
  wired = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );

  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
  }
}
