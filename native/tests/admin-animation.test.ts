import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {transformSync} = require('@babel/core');
test('Admin conditional entering-animation callback compiles to a UI-thread worklet', () => {
  const source = readFileSync(new URL('../src/profile/AdminMenu.tsx', import.meta.url), 'utf8');
  const compile = (input: string) => transformSync(input, {filename:fileURLToPath(new URL('../src/profile/AdminMenu.tsx', import.meta.url)),configFile:false,babelrc:false,parserOpts:{plugins:['typescript','jsx']},plugins:['react-native-worklets/plugin']}).code;
  assert.match(compile(source), /__workletHash/);
  // Reproduce the regression: a conditional builder is not auto-workletized.
  assert.doesNotMatch(compile(source.replace("'worklet';", '')), /__workletHash/);
});
