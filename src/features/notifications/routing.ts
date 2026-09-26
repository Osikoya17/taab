import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { getNotifications } from './module';

type NotificationResponse = import('expo-notifications').NotificationResponse;

/** Opens the screen a tapped notification points to. Mount once, inside the app shell. */
export function useNotificationRouting(enabled: boolean) {
  useEffect(() => {
    const Notifications = getNotifications();
    if (!enabled || !Notifications) return;

    const open = (response: NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as Href);
        Notifications.clearLastNotificationResponse();
      }
    };

    // A tap that launched the app, then any taps while it's running.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [enabled]);
}
