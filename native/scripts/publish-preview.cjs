// Manual publishing only. Nothing invokes this from Git hooks or CI.
const { execFileSync, spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const path = require('node:path');
const { assertPreviewRuntime } = require('./preview-runtime-guard.cjs');
process.chdir(path.resolve(__dirname, '..'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
async function main() {
  if (git('branch', '--show-current') !== 'native/expo-migration') throw Error('Use native/expo-migration.');
  if (git('status', '--porcelain')) throw Error('Commit and push the reviewed changes first.');
  git('fetch', 'origin', 'native/expo-migration');
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/native/expo-migration')) throw Error('HEAD must match the pushed branch.');
  const config = require('../app.json').expo;
  if (!config.extra?.eas?.projectId || !config.updates?.url) throw Error('Finish EAS project linking first.');
  if (!stdin.isTTY) throw Error('Publishing requires an interactive approval.');
  const [buildFlag, buildId, ...messageParts] = process.argv.slice(2);
  if (buildFlag !== '--build-id' || !/^[a-f0-9-]{36}$/i.test(buildId || '')) throw Error('Provide --build-id of the intended finished Preview APK.');
  const message = messageParts.join(' ').trim();
  if (!message) throw Error('Provide a release message: npm run update:preview -- --build-id APK_BUILD_ID "Reviewed change"');
  const eas = path.resolve('node_modules/.bin/eas');
  const json = args => JSON.parse(execFileSync(eas, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
  const build = json(['build:view', buildId, '--json']);
  const fingerprint = json(['fingerprint:generate', '--platform', 'android', '--environment', 'preview', '--json', '--non-interactive']);
  const runtime = assertPreviewRuntime(build, fingerprint, { expo: config });
  if (require('./../eas.json').build.preview.channel !== 'preview') throw Error('Preview channel configuration changed.');
  stdout.write(`Verified APK ${buildId}, runtime ${runtime}, channel preview.\n`);
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(`Publish Android commit ${git('rev-parse', '--short', 'HEAD')} to PREVIEW only? Type PUBLISH PREVIEW: `);
  prompt.close();
  if (answer !== 'PUBLISH PREVIEW') throw Error('Publishing cancelled.');
  const result = spawnSync(path.resolve('node_modules/.bin/eas'), ['update', '--channel', 'preview', '--platform', 'android', '--environment', 'preview', '--message', message], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
