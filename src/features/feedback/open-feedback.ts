import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { FEEDBACK_FORM_PREFILLED, feedbackUrl, platformLabel } from './form';

/** "1.0.0 (build 12)", so feedback can be matched to the APK a tester has. */
export function appVersionLabel() {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown';
  const build = Application.nativeBuildVersion;
  return build ? `${version} (build ${build})` : version;
}

export const hasFeedbackForm = !!FEEDBACK_FORM_PREFILLED;

/**
 * Opens the form in the phone's browser rather than inside taab: screenshot
 * uploads need the Google account the tester is already signed in to there.
 */
export async function openFeedbackForm() {
  const url = feedbackUrl(FEEDBACK_FORM_PREFILLED, { platform: platformLabel(Platform.OS), version: appVersionLabel() });
  if (url) await Linking.openURL(url);
}
