import { Redirect } from 'expo-router';

/** taab+ was retired for one-off packs. Old links and notifications land on Extras. */
export default function SubscriptionRedirect() {
  return <Redirect href="/extras" />;
}
