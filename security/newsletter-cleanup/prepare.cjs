const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/newsletter-cleanup');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(__dirname,'index.cjs'),path.join(out,'index.cjs'));
// Reuse the existing pinned Functions dependencies, without duplicating locks.
for(const name of ['package.json','package-lock.json'])fs.copyFileSync(path.join(root,'functions',name),path.join(out,name));
fs.copyFileSync(path.join(root,'functions/newsletterDraftCleanup.cjs'),path.join(out,'newsletterDraftCleanup.cjs'));
console.log('Prepared isolated newsletter cleanup package. Nothing deployed or activated.');
