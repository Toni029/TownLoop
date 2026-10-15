const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('profile menu interactive buttons are siblings, never nested HTML buttons', () => {
  const file = path.join(__dirname, '../native/src/profile/ProfileMenu.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  function visit(node, insideButton = false) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const isButton = ['Pressable', 'Action', 'button'].includes(opening.tagName.getText(source));
      if (isButton && insideButton) violations.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
      insideButton ||= isButton;
    }
    ts.forEachChild(node, child => visit(child, insideButton));
  }
  visit(source);
  assert.deepEqual(violations, [], 'Nested buttons at lines: ' + violations.join(', '));
});
