import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = new URL('../src/components/PrivateImage.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const legacy = 'https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/feed%2Fphoto.jpg?alt=media&token=old-bearer';

function fixture(media: { uri?: string; error?: string }) {
  const calls: Array<{ uri: string; kind: string }> = [];
  const errors: string[] = [];
  const modules: Record<string, unknown> = {
    react: { useEffect: (effect: () => void) => effect() },
    'react/jsx-runtime': { jsx: (_type: unknown, props: { source?: { uri: string } }) => props },
    'react-native': { Image: 'Image' },
    '../media/usePrivateMedia': {
      usePrivateMedia: (uri: string, kind: string) => { calls.push({ uri, kind }); return media; },
    },
  };
  const exports: Record<string, Function> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => modules[name] });
  const image = exports.PrivateImage({
    source: { uri: legacy },
    onError: (event: { nativeEvent: { error: string } }) => errors.push(event.nativeEvent.error),
  });
  return { image, calls, errors };
}

test('private image presents only the authorized local media URI', () => {
  const result = fixture({ uri: 'file:///private/owned.img' });
  assert.deepEqual(result.calls, [{ uri: legacy, kind: 'image' }]);
  assert.equal(result.image.source.uri, 'file:///private/owned.img');
});

test('loading or denied private image does not fall back to the original bearer URI', () => {
  assert.equal(fixture({}).image.source, undefined);
  const denied = fixture({ error: 'Unable to load private attachment.' });
  assert.equal(denied.image.source, undefined);
  assert.deepEqual(denied.errors, ['Unable to load private attachment.']);
});
