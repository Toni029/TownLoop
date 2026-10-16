const fs = require('node:fs');
// Android client configuration only; sending credentials belong in EAS.
module.exports = ({ config }) => {
  const file = process.env.GOOGLE_SERVICES_JSON;
  if (file) {
    const google = JSON.parse(fs.readFileSync(file, 'utf8'));
    const firebase = require('./firebase-config.json');
    if (google.project_info?.project_id !== firebase.projectId ||
        !google.client?.some(client => client.client_info?.android_client_info?.package_name === config.android?.package)) {
      throw new Error('GOOGLE_SERVICES_JSON must match the existing TownLoop Firebase project and Android package.');
    }
  }
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !file) throw new Error('Set GOOGLE_SERVICES_JSON before building with push notifications.');
  return { ...config, android: { ...config.android, ...(file ? { googleServicesFile: file } : {}) } };
};
