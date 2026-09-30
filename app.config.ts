import type { ConfigContext, ExpoConfig } from 'expo/config';

// google-services.json is kept out of git. On EAS it comes from the secret file
// variable GOOGLE_SERVICES_JSON; locally the file in the project folder is used.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
