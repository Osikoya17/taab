// Android 11+ hides other apps unless the manifest names them. This lists the
// banking apps from src/features/payouts/bank-apps.json so "Transfer now" can
// find and open them. Named packages only: no QUERY_ALL_PACKAGES permission.
const { withAndroidManifest } = require('expo/config-plugins');

const apps = require('../src/features/payouts/bank-apps.json');

module.exports = function withBankAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries?.length ? manifest.queries : [{}];
    const queries = manifest.queries[0];
    const listed = new Set((queries.package ?? []).map((entry) => entry.$['android:name']));
    const packages = apps.flatMap((app) => app.android).filter((name) => !listed.has(name));
    queries.package = [...(queries.package ?? []), ...packages.map((name) => ({ $: { 'android:name': name } }))];
    return cfg;
  });
};
