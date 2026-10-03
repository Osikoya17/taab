import { Redirect } from 'expo-router';

/** taab+ was retired. Old links and notifications land on Extras (Home while extras are off, via the guard in _layout). */
export default function SubscriptionRedirect() {
  return <Redirect href="/extras" />;
}
