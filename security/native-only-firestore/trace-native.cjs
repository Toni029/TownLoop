// Offline source dependency trace. Does not load app modules or print config secrets.
const fs = require('node:fs'), path = require('node:path'), ts = require('../../node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const relative = file => path.relative(root, file).replaceAll(path.sep, '/');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(item => item.isDirectory() ? files(path.join(dir,item.name)) : [path.join(dir,item.name)]);
}
function trace(platform) {
  const seen = new Set(), edges = [], external = new Set(), unresolved = [];
  const pending = files(path.join(root,'native/src/app')).filter(file => /\.[jt]sx?$/.test(file));
  const extensions = [`.${platform}.tsx`,`.${platform}.ts`,'.native.tsx','.native.ts','.tsx','.ts','.jsx','.js','.cjs','.json'];
  function resolve(from, spec) {
    const base = path.resolve(path.dirname(from),spec);
    const candidates = [base,...extensions.map(ext=>base+ext),...extensions.map(ext=>path.join(base,'index'+ext))];
    return candidates.find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
  }
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file)) continue;
    seen.add(file);
    const ast = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
    function visit(node) {
      let spec;
      if ((ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec=node.moduleSpecifier.text;
      if (ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])&&
          (node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')) spec=node.arguments[0].text;
      if (spec) {
        if (spec.startsWith('.')) {
          const target=resolve(file,spec);
          if(target){edges.push([relative(file),relative(target)]);pending.push(target);}
          else if(!/\.(png|jpg|jpeg|mp4|webp|svg|gif|ttf)$/.test(spec))unresolved.push({from:relative(file),spec});
        } else external.add(spec);
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  const databaseConstructors=[...seen].filter(file=>/\b(getFirestore|initializeFirestore)\s*\(/.test(fs.readFileSync(file,'utf8'))).map(relative).sort();
  return {platform,sourceFiles:seen.size,sharedSourceFiles:[...seen].map(relative).filter(file=>file.startsWith('src/')).sort(),databaseConstructors,
    sharedWebFirebaseReachable:seen.has(path.join(root,'src/firebase.ts')),unresolved,
    firebasePackages:[...external].filter(spec=>spec.startsWith('firebase/')).sort(),edges};
}
module.exports={trace};
if(require.main===module){console.log(JSON.stringify(['android','ios'].map(platform=>{const result=trace(platform);delete result.edges;return result;}),null,2));}
