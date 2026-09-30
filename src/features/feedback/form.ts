/**
 * The beta feedback Google Form (scripts/feedback-form.gs creates it).
 * This is its prefilled link: the app swaps the placeholder answers for the
 * tester's platform and app version. Empty hides "Send feedback".
 */
export const FEEDBACK_FORM_PREFILLED =
  'https://docs.google.com/forms/d/e/1FAIpQLScoRh0QqbdjBbedQi-nW0bFhAKHxao6yA6DpNhf6I372oEMBg/viewform?usp=pp_url&entry.835604508=Android+app&entry.284957931=APP_VERSION';

/** The answers the script's prefilled link uses as placeholders. */
const PLACEHOLDERS = { platform: 'Android app', version: 'APP_VERSION' };

export type FeedbackPlatform = 'Android app' | 'iPhone app' | 'Website';

export function platformLabel(os: string): FeedbackPlatform {
  return os === 'android' ? 'Android app' : os === 'ios' ? 'iPhone app' : 'Website';
}

/** Google encodes spaces as "+" in prefilled links; accept "%20" too. */
function encodedForms(value: string) {
  return [encodeURIComponent(value).replace(/%20/g, '+'), encodeURIComponent(value)];
}

function replaceAnswer(url: string, placeholder: string, value: string) {
  for (const form of encodedForms(placeholder)) {
    const next = url.replace(`=${form}`, `=${encodeURIComponent(value)}`);
    if (next !== url) return next;
  }
  return url;
}

export function feedbackUrl(prefilled: string, answers: { platform: FeedbackPlatform; version: string }): string | null {
  if (!prefilled) return null;
  const withPlatform = replaceAnswer(prefilled, PLACEHOLDERS.platform, answers.platform);
  return replaceAnswer(withPlatform, PLACEHOLDERS.version, answers.version);
}
