const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod, withAppDelegate } = require('expo/config-plugins');
const domains = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const exclusions = domains.map(domain => `    <exclude domain="${domain}" path="." />`).join('\n');
module.exports = function withLocalDataProtection(config) {
  config = withAndroidManifest(config, config => {
    const app = config.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:fullBackupContent'] = '@xml/townloop_backup_rules';
    app['android:dataExtractionRules'] = '@xml/townloop_data_extraction_rules';
    return config;
  });
  config = withDangerousMod(config, ['android', async config => {
    const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'townloop_backup_rules.xml'), `<full-backup-content>\n${exclusions}\n</full-backup-content>\n`);
    fs.writeFileSync(path.join(dir, 'townloop_data_extraction_rules.xml'), `<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`);
    return config;
  }]);
  return withAppDelegate(config, config => {
    if (config.modResults.language !== 'swift') throw Error('TownLoop backup exclusion requires the Expo Swift AppDelegate. Review this plugin before changing iOS templates.');
    const marker = '// TownLoop local data: exclude app data from iCloud backup.';
    if (!config.modResults.contents.includes(marker)) {
      // Set before Firebase/React startup; the directory flags are inherited by its contents.
      const signature = /(didFinishLaunchingWithOptions[^]*?\)\s*->\s*Bool\s*\{)/;
      if (!signature.test(config.modResults.contents)) throw Error('Cannot locate iOS launch method for TownLoop backup exclusion');
      config.modResults.contents = config.modResults.contents.replace(signature, `$1\n    ${marker}\n    for directory in [FileManager.SearchPathDirectory.documentDirectory, .libraryDirectory] {\n      if var url = FileManager.default.urls(for: directory, in: .userDomainMask).first {\n        do {\n          try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)\n          var values = URLResourceValues()\n          values.isExcludedFromBackup = true\n          try url.setResourceValues(values)\n        } catch {\n          NSLog("TownLoop could not exclude local data from backup")\n        }\n      }\n    }\n`);
    }
    return config;
  });
};
