import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function plugin() {
  const callbacks: Record<string, (config: any) => any> = {};
  const context = {
    module: { exports: undefined as any },
    require: (name: string) => name === 'expo/config-plugins' ? {
      withAndroidManifest: (config: any, callback: any) => { callbacks.android = callback; return config; },
      withDangerousMod: (config: any, [, callback]: any[]) => { callbacks.files = callback; return config; },
      withAppDelegate: (config: any, callback: any) => { callbacks.ios = callback; return config; },
    } : require(name),
  };
  vm.runInNewContext(readFileSync(path.join(root, 'plugins/withLocalDataProtection.cjs'), 'utf8'), context);
  context.module.exports({});
  return callbacks;
}
test('Android plugin excludes shared preferences, databases and files in cloud backup and device transfer', async () => {
  const callbacks = plugin();
  const config = { modResults: { manifest: { application: [{ $: {} as Record<string, string> }] } } };
  callbacks.android(config);
  assert.equal(config.modResults.manifest.application[0].$['android:allowBackup'], 'false');
  const temp = mkdtempSync(path.join(tmpdir(), 'townloop-backup-'));
  try {
    await callbacks.files({ modRequest: { platformProjectRoot: temp } });
    const rules = readFileSync(path.join(temp, 'app/src/main/res/xml/townloop_data_extraction_rules.xml'), 'utf8');
    for (const section of ['cloud-backup', 'device-transfer']) {
      const content = rules.split(`<${section}>`)[1].split(`</${section}>`)[0];
      for (const domain of ['root', 'file', 'database', 'sharedpref', 'external', 'device_sharedpref']) assert.ok(content.includes(`domain="${domain}" path="."`));
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('iOS plugin adds backup flags at launch and is idempotent; fails closed on incompatible delegates', () => {
  const callbacks = plugin();
  const swift = `import Expo\nclass AppDelegate: ExpoAppDelegate {\n override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {\n return true\n }\n}`;
  const config = { modResults: { language: 'swift', contents: swift } };
  callbacks.ios(config);
  assert.ok(config.modResults.contents.includes('values.isExcludedFromBackup = true'));
  assert.ok(config.modResults.contents.includes('.libraryDirectory'));
  const once = config.modResults.contents;
  callbacks.ios(config);
  assert.equal(config.modResults.contents, once);
  assert.throws(() => callbacks.ios({ modResults: { language: 'objc', contents: '' } }));
  assert.throws(() => callbacks.ios({ modResults: { language: 'swift', contents: 'changed template' } }));
});
