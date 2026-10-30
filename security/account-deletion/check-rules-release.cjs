// Read-only rules release precondition/receipt. Does not read Firestore documents or deploy.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const sha=s=>createHash('sha256').update(s).digest('hex');
(async()=>{
 const mode=process.argv[2];if(!['before','after'].includes(mode))throw Error('Use before or after');
 const manifest=require('./rules-manifest.json'),config=require('./firebase.deploy.json');
 if(Object.keys(config).length!==1||config.firestore.length!==2)throw Error('Rules-only configuration required');
 const auth=require(process.env.TOWNLOOP_FIREBASE_AUTH_MODULE),a=auth.getGlobalDefaultAccount();if(!a)throw Error('Firebase login required');
 const t=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const read=async url=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+t.access_token}});if(!r.ok)throw Error('Rules metadata HTTP '+r.status);return r.json();};
 const rules=[];
 for(const entry of config.firestore){
  const expected=manifest.scopes.find(s=>s.database===entry.database);if(!expected||entry.rules!==expected.file)throw Error('Scope mismatch');
  const candidate=sha(fs.readFileSync(path.join(__dirname,entry.rules)));if(candidate!==expected.candidateSHA256)throw Error('Candidate changed');
  const release=await read(`https://firebaserules.googleapis.com/v1/projects/${manifest.project}/releases/cloud.firestore${entry.database==='(default)'?'':'/'+entry.database}`);
  const set=await read('https://firebaserules.googleapis.com/v1/'+release.rulesetName),actual=sha(set.source.files.map(f=>f.content).join('\n'));
  if(actual!==(mode==='before'?expected.baselineSHA256:candidate))throw Error('Live rules changed: stop; do not overwrite another release');
  rules.push({database:entry.database,sha256:actual});
 }
 console.log(JSON.stringify({project:manifest.project,mode,verifiedAt:new Date().toISOString(),rules,residentDocumentsRead:0}));
})().catch(e=>{console.log(e.message);process.exitCode=1});
