const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {publicationDate,render}=require('./publication.cjs');
test('publication uses actual New York day and requires explicit approval',()=>{
 assert.equal(publicationDate(new Date('2026-11-13T02:00:00Z')),'2026-11-12');assert.equal(publicationDate(new Date('2026-11-13T06:00:00Z')),'2026-11-13');assert.throws(()=>render('privacy.html'),/approval/);
});
test('final documents retain approved substance, team and unpaid Gemini disclosure without draft notices',()=>{
 for(const name of ['privacy.html','terms.html','child-safety.html','delete-account.html']){const result=render(name,{approved:true,now:new Date('2026-11-12T21:00:00Z')});assert.equal(result.effectiveDate,'2026-11-12');assert(result.html.includes('Effective date: November 12, 2026.'));assert.doesNotMatch(result.html,/data-publication-review|not yet published|Cecil[\s_-]*Pines|Antonio|Merlano/);}
 assert(render('privacy.html',{approved:true}).html.includes('without enabled billing'));
 assert(render('child-safety.html',{approved:true}).html.includes('Seeds4Clix Safety Team'));
 assert(render('terms.html',{approved:true}).html.includes('This permission does not transfer ownership or permit unrelated commercial reuse.'));
});
test('external deletion-page authentication/request script is byte-for-byte unchanged',()=>{
 const original=fs.readFileSync(path.join(__dirname,'../../public/delete-account.html'),'utf8');const after=render('delete-account.html',{approved:true}).html;assert.equal(after.slice(after.indexOf('<script')),original.slice(original.indexOf('<script')));
});
test('root abandoned-website Hosting deployment is blocked locally without changing backend configuration',()=>{
 const {spawnSync}=require('node:child_process');const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase.json')));
 assert.deepEqual(cfg.hosting.predeploy,['node security/legal-pages/block-retired-web-deploy.cjs']);const result=spawnSync(process.execPath,[path.join(__dirname,'block-retired-web-deploy.cjs')],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/Retired website Hosting deployment is blocked/);
});
