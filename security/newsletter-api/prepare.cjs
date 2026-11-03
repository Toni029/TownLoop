/** Local packaging only; never runs Firebase, provisions secrets, or sends an analysis request. */
const fs=require('node:fs'),path=require('node:path'),{build}=require('esbuild');
async function prepare(){
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/newsletter-api');
 fs.mkdirSync(path.join(out,'lib'),{recursive:true});
 for(const name of ['package.json','package-lock.json','index.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
 await build({entryPoints:[path.join(root,'server/nativeNewsletterApp.ts')],outfile:path.join(out,'lib/native-app.cjs'),bundle:true,platform:'node',target:'node22',format:'cjs',packages:'external',sourcemap:false,legalComments:'none'});
 const expected=new Set(['package.json','package-lock.json','index.cjs','lib','node_modules']);
 if(fs.readdirSync(out).some(name=>!expected.has(name)))throw Error('Unexpected release artifact: packaging stopped.');
 if(fs.readdirSync(path.join(out,'lib')).some(name=>name!=='native-app.cjs'))throw Error('Unexpected bundled source file.');
 console.log('Prepared isolated newsletterApi artifact. Nothing deployed; no secret files included.');
 return out;
}
module.exports={prepare};
if(require.main===module)prepare().catch(()=>{console.error('Newsletter API packaging failed. No deployment was attempted.');process.exitCode=1;});
