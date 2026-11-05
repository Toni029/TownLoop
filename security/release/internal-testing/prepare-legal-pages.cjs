// Offline staging only. This deliberately has no Firebase deployment configuration.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),pages=['privacy.html','terms.html','delete-account.html'];
function stage(destination=path.join(root,'.release/legal-pages')){
 const target=path.resolve(destination),release=path.join(root,'.release')+path.sep;
 if(!target.startsWith(release))throw Error('Stage legal pages only inside the ignored .release directory.');
 if(fs.existsSync(target)&&fs.readdirSync(target).some(name=>!pages.includes(name)))throw Error('Unexpected staging files; preserve them and choose a clean release directory.');
 fs.mkdirSync(target,{recursive:true});
 const files=pages.map(name=>{const data=fs.readFileSync(path.join(root,'public',name));fs.writeFileSync(path.join(target,name),data);return{url:`https://townloop.web.app/${name}`,path:`/${name}`,sourceSHA256:createHash('sha256').update(data).digest('hex'),bytes:data.length};});
 return{mode:'OFFLINE_LOCAL_STAGING_ONLY',site:'townloop',files,publicationApproved:false,hostingConfigChanged:false,warning:'Do not deploy this directory as an entire Hosting site. After approval, preserve the existing release files/configuration and overlay only these three paths; validate OAuth/app associations and headers first.'};
}
module.exports={stage};if(require.main===module)console.log(JSON.stringify(stage(),null,2));
