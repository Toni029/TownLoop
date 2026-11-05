// Local validation only. No credential access, network, deployment or data writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const dir=__dirname,m=require('./manifest.json'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,expected]of [['firebase.deploy.json','firestore.named.rules'],['firebase.readonly.json','firestore.named.readonly.rules']]){
 const config=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 assert.deepEqual(Object.keys(config),['firestore']);assert.equal(config.firestore.length,1);
 assert.deepEqual(config.firestore[0],{database:m.database,rules:expected});
}
assert.equal(m.database,'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb');
assert.equal(m.project,'cc-livingcommunity-app');
assert.equal(sha(fs.readFileSync(path.join(dir,'firestore.named.rules'))),m.candidateRulesSHA256);
const readonly=fs.readFileSync(path.join(dir,'firestore.named.readonly.rules'),'utf8');assert.equal(sha(readonly),m.readonlyRulesSHA256);
for(const match of readonly.matchAll(/allow\s+([^:]+):\s*if\s*([\s\S]*?);/g))if(match[1].split(',').some(x=>['create','update','delete','write'].includes(x.trim())))assert.equal(match[2].trim(),'false');
assert.equal(sha(fs.readFileSync(path.join(dir,'../account-deletion/firestore.website.candidate.rules'))),m.baselineRulesSHA256);
assert.equal(sha(fs.readFileSync(path.join(dir,'../account-deletion/firestore.default.candidate.rules'))),m.unchangedDefaultCandidateSHA256);
console.log('PASS: named-only configs/hashes, unchanged default candidate and mutation-denying recovery source. No cloud calls.');
