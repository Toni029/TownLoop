// Hosting-only rendering; source drafts remain reviewable. No network or deployment.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function publicationDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=name=>parts.find(p=>p.type===name).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
function render(name,{approved=false,now=new Date()}={}) {
 if(approved!==true)throw Error('Explicit owner approval required.');
 if(!['privacy.html','terms.html','child-safety.html','delete-account.html'].includes(name))throw Error('Not a reviewed legal document.');
 const source=fs.readFileSync(path.join(root,'public',name),'utf8');
 const split=source.indexOf('<script');let html=split<0?source:source.slice(0,split);const scripts=split<0?'':source.slice(split);
 html=html.replace(/\s*<aside class="notice" data-publication-review[\s\S]*?<\/aside>/,'').replace(/<aside class="review" aria-label="Publication review">[\s\S]*?<\/aside>/,'');
 const iso=publicationDate(now),label=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(new Date(iso+'T12:00:00Z'));
 html=html.replace('Draft prepared November 12, 2026. Effective date will be set after owner approval.',`Effective date: ${label}.`).replace('Effective date: pending owner approval.',`Effective date: ${label}.`);
 html=html.replace('This draft is provided for review and does not silently change previously recorded acceptance. The final terms must be approved and made available before they take effect.','These terms take effect on the date shown below. Publication does not silently change previously recorded acceptance; any further acceptance required will be requested separately.');
 html=html.replace('No fixed monetary liability cap, arbitration requirement or governing jurisdiction is imposed by this draft.','These terms do not impose a fixed monetary liability cap, arbitration requirement or governing jurisdiction.');
 if(name==='delete-account.html'){
  html=html.replace(/<p>TownLoop is operated under the supplied name[\s\S]*?<\/p>/,'<p>TownLoop is developed and operated by <strong>Seeds4Clix</strong>. Contact: <a href="mailto:support@seeds4clix.com">support@seeds4clix.com</a>.</p>');
  html=html.replace('Owner approval that this mailbox is monitored for deletion requests is required before publication. ','');
  html=html.replace('The deployed worker currently remains paused behind its policy-receipt safeguard. This status and staffed handling must be confirmed before publication.','Processing is subject to the existing safety checks; approval alone does not confirm completion. Contact support for the status of your request.');
  html=html.replaceAll('support@seeds4Clix.com','support@seeds4clix.com');
 }
 if(/draft|pending owner approval|before publication|not yet effective|data-publication-review|Antonio|Merlano|cecil[\s_-]*pines/i.test(html))throw Error('Unresolved publication content in '+name);
 if(!html.includes(`Effective date: ${label}.`))throw Error('Missing effective date.');
 return {html:html+scripts,effectiveDate:iso};
}
module.exports={publicationDate,render};
