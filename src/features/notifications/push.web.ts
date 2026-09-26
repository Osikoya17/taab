/** Remote browser push needs a service worker; the in-app inbox works on web. */
export async function getPushPermission(): Promise<string> { return 'unsupported'; }
export async function enablePushNotifications(): Promise<boolean> { return false; }
