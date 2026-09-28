import PostHog from 'posthog-react-native';

const projectToken = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();

function createClient(): PostHog | undefined {
  // Analytics is optional, including when running a fresh checkout in demo mode.
  if (!projectToken || projectToken === 'phc_your_project_token_here' || !host) return undefined;
  try {
    const url = new URL(host);
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    return new PostHog(projectToken, {
      host,
      captureAppLifecycleEvents: true,
      logs: {
        serviceName: 'taab-mobile',
        environment: __DEV__ ? 'development' : 'production',
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
        },
      },
    });
  } catch {
    return undefined;
  }
}

export const posthog = createClient();

/** Telemetry must never turn a completed ledger mutation into a failed save. */
export function captureEvent(...args: Parameters<PostHog['capture']>) {
  try { posthog?.capture(...args); } catch { /* Analytics cannot block the app. */ }
}
