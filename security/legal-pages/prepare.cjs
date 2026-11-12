// Local review/staging only. Never deploy this partial directory as a Hosting release.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const files=['privacy.html','terms.html','child-safety.html','delete-account.html','legal.css'];
function prepare(destination=path.join(root,'.release/legal-review')) {
 const target=path.resolve(destination),parent=path.join(root,'.release')+path.sep;
 if(!target.startsWith(parent)||fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Use a local directory inside ignored .release.');
 const allowed=[...files,'firebase.json','scope.json'];
 if(fs.existsSync(target)&&fs.readdirSync(target).some(name=>!allowed.includes(name)))throw Error('Unexpected files: preserve this directory.');
 fs.mkdirSync(target,{recursive:true});
 const entries=files.map(name=>{const source=fs.readFileSync(path.join(root,'public',name));fs.writeFileSync(path.join(target,name),source);return {path:'/'+name,sha256:createHash('sha256').update(source).digest('hex'),bytes:source.length};});
 // Hosting emulator config only: explicit static files, no SPA fallback or redirect.
 fs.writeFileSync(path.join(target,'firebase.json'),JSON.stringify({hosting:{site:'townloop',public:'.',ignore:['firebase.json','scope.json','**/.*'],rewrites:[]},emulators:{hosting:{host:'127.0.0.1',port:8125},ui:{enabled:false}}},null,2));
 const result={mode:'LOCAL_REVIEW_ONLY_NOT_A_FULL_HOSTING_RELEASE',site:'townloop',publicationApproved:false,files:entries,warning:'Preserve the current live Hosting file manifest, OAuth and app associations before any approved deployment. Overlay these five paths only. Never deploy this partial review directory. Review notices and effective dates remain pending.'};
 fs.writeFileSync(path.join(target,'scope.json'),JSON.stringify(result,null,2));return result;
}
module.exports={prepare,files};if(require.main===module)console.log(JSON.stringify(prepare(),null,2));
