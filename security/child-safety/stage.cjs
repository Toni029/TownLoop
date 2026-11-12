// Offline-only staging. This is never a complete Hosting release directory.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function stage({publicationApproved=false,operatorProcedureConfirmed=false,effectiveDate}={}){
 const root=path.resolve(__dirname,'../..');
 if(publicationApproved!==true||operatorProcedureConfirmed!==true||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate||''))throw Error('Owner approval, confirmed operator procedure and effective date are required before publication staging.');
 let html=fs.readFileSync(path.join(root,'public/child-safety.html'),'utf8');
 html=html.replace(/\s*<aside class="notice" data-publication-review[\s\S]*?<\/aside>/,'');
 html=html.replace('Draft prepared November 12, 2026. Effective date will be set after owner approval.',`Effective date: ${effectiveDate}.`);
 if(/Draft for owner approval|not yet published or effective|data-publication-review/.test(html))throw Error('Unresolved publication review marker.');
 const out=path.join(root,'.release/child-safety-page');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'child-safety.html'),html);fs.copyFileSync(path.join(root,'public/legal.css'),path.join(out,'legal.css'));
 const result={mode:'PAGE_AND_STYLES_OVERLAY_ONLY',site:'townloop',url:'https://townloop.web.app/child-safety.html',sourceSHA256:createHash('sha256').update(html).digest('hex'),deployed:false,requiredAssets:['/child-safety.html','/legal.css'],warning:'Do not deploy this directory as a full Hosting site. Preserve the current live file manifest, headers, redirects, OAuth and .well-known associations; overlay /child-safety.html and its reviewed /legal.css dependency after separate deployment approval.'};
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify(result,null,2));return result;
}
module.exports={stage};if(require.main===module)throw Error('No automatic deployment/staging. Complete owner approval and invoke stage explicitly.');
