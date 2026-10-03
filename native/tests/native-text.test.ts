import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// React Native rejects even an empty string directly beneath a View.
// Keep real call sites safe, including string/number && JSX expressions.
const textComponents = new Set(['Text', 'Animated.Text', 'Copy', 'Txt', 'Badge', 'Body', 'Heading']);
function jsxText(raw: string) {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((line, i) => { if (/[^ \t]/.test(line)) last = i; });
  return lines.reduce((value, rawLine, i) => {
    let line = rawLine.replace(/\t/g, ' ');
    if (i !== 0) line = line.replace(/^ +/, '');
    if (i !== lines.length - 1) line = line.replace(/ +$/, '');
    return line ? value + line + (i !== last ? ' ' : '') : value;
  }, '');
}
function hasPrimitive(type: ts.Type): boolean {
  return type.isUnion() ? type.types.some(hasPrimitive) : !!(type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike));
}
test('native containers never receive literal text or primitive conditional guards', () => {
  const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(new URL('../', import.meta.url)));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const findings: string[] = [];
  for (const source of program.getSourceFiles()) {
    if (!source.fileName.includes('/native/src/') || !source.fileName.endsWith('.tsx')) continue;
    function visit(node: ts.Node) {
      let parent: ts.Node = node.parent;
      while (parent && ts.isJsxFragment(parent)) parent = parent.parent;
      if (parent && ts.isJsxElement(parent)) {
        const owner = parent.openingElement.tagName.getText(source);
        if (!textComponents.has(owner)) {
          let reason = '';
          if (ts.isJsxText(node) && jsxText(node.text) !== '') reason = 'literal text outside a text component';
          if (ts.isJsxExpression(node) && node.expression) {
            const expression = node.expression;
            if (ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression)) reason = 'literal text outside a text component';
            if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && hasPrimitive(checker.getTypeAtLocation(expression.left))) reason = 'string/number guard can render a raw empty string or zero';
          }
          if (reason) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            findings.push(`${source.fileName.split('/native/src/')[1]}:${line + 1} <${owner}>: ${reason}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(findings, [], findings.join('\n'));
});
