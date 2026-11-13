// Local, disabled scoped packaging. No deployment or privileged writer changes.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function prepare(){const out=path.join(root,'.release/social-media-lifecycle');fs.mkdirSync(out,{recursive:true});for(const entry of fs.readdirSync(path.join(root,'functions'),{withFileTypes:true})){if(entry.isFile()&&/\.(cjs|json)$/.test(entry.name)&&!entry.name.includes('.test.')&&entry.name!=='index.cjs')fs.copyFileSync(path.join(root,'functions',entry.name),path.join(out,entry.name));}fs.writeFileSync(path.join(out,'index.cjs'),"Object.assign(exports,require('./socialMediaLifecycleScopedEntry.cjs'));\n");fs.writeFileSync(path.join(out,'.env'),'TOWNLOOP_SOCIAL_MEDIA_LIFECYCLE_ENABLED=false\n');return out;}
module.exports={prepare};if(require.main===module)console.log('Prepared disabled social-only package: '+prepare());
