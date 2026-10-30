const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepareRetention}=require('./prepare-retention.cjs');
test('retention deployment package is scoped, disabled, default-only and changes only the cleanup read fence',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'townloop-retention-'));
 try{
  const baseline=path.join(tmp,'baseline.rules');fs.writeFileSync(baseline,"function groupAccess(cid) { return groupApproved() && m.uid == request.auth.uid && m.status == 'active' && true; }\n// unrelated sentinel");
  const out=prepareRetention(baseline,path.join(tmp,'out')),scope=JSON.parse(fs.readFileSync(path.join(out,'scope.json')));
  assert.equal(scope.cleanupEnabled,false);assert.equal(scope.monitorEnabled,false);assert.equal(scope.database,'(default)');assert.equal(scope.namedDatabase,false);
  const rules=fs.readFileSync(path.join(out,'firestore.rules'),'utf8');assert(rules.includes("c.status != 'cleanup_in_progress'"));assert(rules.endsWith('// unrelated sentinel'));
  const env=fs.readFileSync(path.join(out,'functions/.env.cc-livingcommunity-app'),'utf8');assert.equal(env,'INBOX_RETENTION_MONITOR_ENABLED=false\nINBOX_RETENTION_CLEANUP_ENABLED=false\n');
  const requests=JSON.parse(fs.readFileSync(path.join(out,'index-create-requests.json')));assert.equal(requests.requests.length,1);assert.deepEqual(requests.deleteRequests,[]);
  const dir=path.join(out,'functions');for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.cjs')))for(const [,local]of fs.readFileSync(path.join(dir,name),'utf8').matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g))assert(fs.existsSync(path.join(dir,local)),`${name}: ${local}`);
  const live=fs.readFileSync(path.resolve(__dirname,'../../functions/index.cjs'),'utf8');assert(!live.includes('inbox-retention-entry'));assert(!live.includes('inbox-group-cleanup-runner'));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
