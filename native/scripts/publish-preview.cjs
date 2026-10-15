// Manual publishing only. Nothing invokes this from Git hooks or CI.
const { execFileSync, spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const path = require('node:path');
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
  const message = process.argv.slice(2).join(' ').trim();
  if (!message) throw Error('Provide a release message: npm run update:preview -- "Reviewed change"');
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(`Publish Android commit ${git('rev-parse', '--short', 'HEAD')} to PREVIEW only? Type PUBLISH PREVIEW: `);
  prompt.close();
  if (answer !== 'PUBLISH PREVIEW') throw Error('Publishing cancelled.');
  const result = spawnSync(path.resolve('node_modules/.bin/eas'), ['update', '--channel', 'preview', '--platform', 'android', '--environment', 'preview', '--message', message], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
