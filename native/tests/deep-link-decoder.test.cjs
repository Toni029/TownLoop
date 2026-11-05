const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const native=path.resolve(__dirname,'..'),local=createRequire(path.join(native,'package.json'));
function resolvedDecoder(){const config=require('../metro.config.js'),context={resolveRequest:(_context,name)=>({type:'sourceFile',filePath:local.resolve(name)})};return (config.resolver.resolveRequest||context.resolveRequest)(context,'decode-uri-component','android').filePath;}
function queryString(){const file=local.resolve('query-string'),requireAt=createRequire(file),module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:name=>name==='decode-uri-component'?require(resolvedDecoder()):requireAt(name)});return module.exports;}
test('Metro resolves the patched decoder on Android/iOS while unrelated resolution remains delegated',()=>{
 const config=require('../metro.config.js');let delegated=0;const context={resolveRequest:(_c,name)=>{delegated++;return{type:'sourceFile',filePath:local.resolve(name)}}};
 for(const platform of ['android','ios']){
  const resolved=config.resolver.resolveRequest(context,'decode-uri-component',platform);
  assert.match(resolved.filePath,/vendor[\\/]decode-uri-component[\\/]index\.cjs$/);
 }
 config.resolver.resolveRequest(context,'query-string','android');assert.equal(delegated,1);
});
test('existing CJS query-string caller preserves inbox IDs, Unicode, plus signs, arrays and malformed escapes',()=>{
 const query=queryString();
 const value=query.parse('category=inbox&thread=abc%2F123&name=Jos%C3%A9+Lee&tag=a&tag=b&partial=%C3%28&bom=%FE%FF');
 assert.equal(value.category,'inbox');assert.equal(value.thread,'abc/123');assert.equal(value.name,'José Lee');
 assert.deepEqual(Array.from(value.tag),['a','b']);assert.equal(value.partial,'%C3(');assert.equal(value.bom,'��');
 assert.equal(query.parse(query.stringify({thread:'abc/123',name:'José Lee'})).thread,'abc/123');
});
test('malformed large deep-link payload completes inside a bounded worker instead of freezing JS',()=>{
 const decoder=resolvedDecoder();
 const result=spawnSync(process.execPath,['-e',`const decode=require(process.argv[1]);const input='%A0'.repeat(20000);const output=decode(input);if(output!==input)process.exit(2);process.stdout.write('done');`,decoder],{timeout:5000,encoding:'utf8',maxBuffer:1024});
 assert.equal(result.error,undefined,'Decoder exceeded the 5-second isolated-process recovery bound');
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'done');
});
test('vendored code remains exactly the pinned upstream security fix plus its CJS export adaptation',()=>{
 const crypto=require('node:crypto'),root=path.join(native,'vendor/decode-uri-component'),meta=require(path.join(root,'upstream.json')),source=fs.readFileSync(path.join(root,'index.cjs'),'utf8');
 assert.equal(meta.version,'0.5.1');
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),meta.commonJsSourceSha256);
 const upstream=source.replace('module.exports = function decodeUriComponent(', 'export default function decodeUriComponent(').replace(/;\n$/,'\n');
 assert.equal(crypto.createHash('sha256').update(upstream).digest('hex'),meta.upstreamSourceSha256);
 assert.match(fs.readFileSync(path.join(root,'LICENSE'),'utf8'),/MIT License/);
});
