const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const {selectedRulesManifest}=require('../../functions/tools/deletion-rules-manifest.cjs');
test('named-only rollout and worker pin preserve default/Storage and both deletion scopes',()=>{
 const deploy=read('security/native-only-firestore/firebase.deploy.json'),baseline=read('security/account-deletion/rules-manifest.json');
 assert.deepEqual(Object.keys(deploy),['firestore']);assert.deepEqual(deploy.firestore,[{database:baseline.scopes[1].database,rules:'firestore.named.rules'}]);
 const file=selectedRulesManifest(['--native-only-rules']),next=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.deepEqual(next.scopes.map(s=>s.database),baseline.scopes.map(s=>s.database));
 assert.equal(next.scopes[0].candidateSHA256,baseline.scopes[0].candidateSHA256);
 assert.notEqual(next.scopes[1].candidateSHA256,baseline.scopes[1].candidateSHA256);
 assert.equal(next.scopes[1].candidateSHA256,createHash('sha256').update(fs.readFileSync(path.join(root,'security/native-only-firestore/firestore.named.rules'))).digest('hex'));
 assert.equal(selectedRulesManifest(),path.join(root,'security/account-deletion/rules-manifest.json'));
 assert.throws(()=>selectedRulesManifest(['--anything']),/Unknown/);
 const config=read('firebase.deletion-processing-native-only.json');assert.deepEqual(Object.keys(config),['functions']);assert.equal(config.functions.length,1);
 assert.equal(config.functions[0].codebase,'work-order-retention');assert.deepEqual(config.functions[0].predeploy,['node functions/tools/prepare-deletion-processing.cjs --native-only-rules']);
});
test('both mobile import graphs use the default Firebase client, including shared utilities',()=>{
 const config=read('native/firebase-config.json');assert.equal(config.projectId,'cc-livingcommunity-app');assert.equal(config.firestoreDatabaseId,'(default)');assert.equal(config.storageBucket,'cc-livingcommunity-app.firebasestorage.app');
 const {trace}=require('./trace-native.cjs');
 for(const platform of ['android','ios']){
  const graph=trace(platform);assert.deepEqual(graph.unresolved,[]);assert.equal(graph.sharedWebFirebaseReachable,false);
  assert.deepEqual(graph.databaseConstructors,['native/src/lib/firebase.ts']);
  assert.ok(graph.sharedSourceFiles.includes('src/services/safety.ts'));
  assert.ok(graph.edges.some(edge=>edge[1]==='src/data/legal.ts'));
 }
});
test('worker packaging refuses forged hashes, native rule drift and database changes',()=>{
 const vm=require('node:vm'),file=path.join(root,'functions/tools/deletion-rules-manifest.cjs');
 for(const [mutate,expected]of [
  [m=>m.scopes[1].candidateSHA256='0'.repeat(64),/source hash/],
  [m=>m.scopes[0].candidateSHA256='0'.repeat(64),/default rules/],
  [m=>m.scopes[1].database='unapproved-database',/database scope/],
 ]){
  const module={exports:{}},changed=read('security/native-only-firestore/deletion-rules-manifest.json');mutate(changed);
  const mocked={...fs,readFileSync:(p,...args)=>String(p)===path.join(root,'security/native-only-firestore/deletion-rules-manifest.json')?JSON.stringify(changed):fs.readFileSync(p,...args)};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),require:name=>name==='node:fs'?mocked:require(name)});
  assert.throws(()=>module.exports.selectedRulesManifest(['--native-only-rules']),expected);
 }
});
