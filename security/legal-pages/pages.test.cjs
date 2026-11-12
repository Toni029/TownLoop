const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),names=['privacy.html','terms.html','child-safety.html'],read=n=>fs.readFileSync(path.join(root,'public',n),'utf8');
test('three direct public documents share the reference theme and complete cross-page navigation',()=>{
 for(const name of names){const html=read(name);assert.match(html,/href="\/legal.css"/);assert.equal((html.match(/<h1>/g)||[]).length,1);assert.match(html,/name="viewport"/);assert.match(html,/lang="en"/);assert.doesNotMatch(html,/<script\b|<iframe\b|id="root"|http-equiv="refresh"|window\.location|Cecil[\s-]*Pines|Antonio|Merlano/i);assert.match(html,/Seeds4Clix/);assert.match(html,/support@seeds4clix\.com/);for(const destination of names)assert(html.includes(`href="/${destination}"`));for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g))assert(html.includes(`id="${anchor}"`),anchor);}
 const css=read('legal.css');for(const term of ['#f7f3ea','#047857','#eaf2e8','#fff0c5','focus-visible','min-height:44px','max-width:380px'])assert(css.includes(term));
});
test('privacy distinguishes local-only health/checklist records and covers current online services without absolute security claims',()=>{
 const html=read('privacy.html');for(const term of ['not synced','not automatically uploaded','Signing out can preserve','Firebase','Expo','Open-Meteo','Google Gemini','translation','read acknowledgments','emergency-contact','60-calendar-day','not represented as end-to-end encrypted','historical media links'])assert(html.includes(term),term);
 assert.doesNotMatch(html,/100% secure|guarantee complete deletion|no provider retention/i);
});
test('terms cover adults, approval, safety, marketplace responsibility, restrictions and qualified liability',()=>{
 const html=read('terms.html');for(const term of ['18 years','assigned permissions','harass','scams','grooming','Transactions are between','does not process marketplace payments','terminate access','liability that cannot lawfully be excluded','does not silently change'])assert(html.toLowerCase().includes(term.toLowerCase()),term);
});
test('review package contains the shared stylesheet and direct routes, cannot overwrite dist and is never publication approval',()=>{
 const {prepare,files}=require('./prepare.cjs');assert.throws(()=>prepare(path.join(root,'dist')),/ignored/);const out=path.join(root,'.release/legal-review-test-'+process.pid);
 try{const result=prepare(out);assert.equal(result.publicationApproved,false);assert.deepEqual(result.files.map(f=>f.path),files.map(n=>'/'+n));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'firebase.json'))).hosting.rewrites,[]);for(const name of files)assert.equal(fs.readFileSync(path.join(out,name),'utf8'),read(name));}finally{fs.rmSync(out,{recursive:true,force:true});}
});
