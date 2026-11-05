import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNewsletterCoverage,containsRsvp,isMeaningfulNewsletterHighlight,preserveNewsletterEventDetails,isEligibleNewsletterRsvp} from '../src/utils/newsletterCoverage.ts';
test('independent RSVP inventory flags unmatched passages, skipped pages and a genuine highlight shortfall',()=>{
 const r={sourcePage:2,eventTitle:'Monthly Potluck',eventDate:'November 9',passage:'Please rSvP to the office by November 6.'};
 const report=buildNewsletterCoverage([1,2,3],[{auditedPages:[1,2],rsvpReferences:[r]}],[],[{title:'Office update'}]);
 assert.equal(report.unmatchedReferences.length,1);assert(report.issues.some(i=>i.kind==='page-not-audited'&&i.sourcePage===3));assert.match(report.highlightShortfallReason,/no filler/);
 const event={sourcePage:2,title:r.eventTitle,date:r.eventDate,time:'6 PM',location:'Clubhouse',rsvpDetails:r.passage,isRecurring:true,requiresRsvp:true};
 assert.equal(buildNewsletterCoverage([1,2],[{auditedPages:[1,2],rsvpReferences:[r]}],[event],Array.from({length:12},(_,i)=>({title:String(i)}))).unmatchedReferences.length,0);
 assert.equal(buildNewsletterCoverage([2],[{auditedPages:[2],rsvpReferences:[r]}],[{...event,title:'Different dinner'}],[]).unmatchedReferences.length,1);
 assert(containsRsvp('rsvp'));assert(containsRsvp('R.S.V.P.'));assert(containsRsvp('R\nS\nV\nP'));
});

test('static directory cards do not pad highlight counts, but actual service changes remain eligible',()=>{
 assert.equal(isMeaningfulNewsletterHighlight({title:'Front Desk Contact',summary:'Call the office at extension 101.'}),false);
 assert.equal(isMeaningfulNewsletterHighlight({title:'Maintenance Team',summary:'New emergency hours effective November 4.'}),true);
 assert.equal(isMeaningfulNewsletterHighlight({title:'Koffee Klatch',summary:'Come for coffee every Thursday.'},true),false);
 assert.equal(isMeaningfulNewsletterHighlight({title:'Wii Bowling Results',summary:'Congratulations to the league winners.'},true),true);
 assert.equal(isMeaningfulNewsletterHighlight({title:'Social Media Policy',summary:'Check permission before sharing resident photos.'}),true);
});

test('source eligibility and RSVP instructions survive a model summary that omits them',()=>{
 const e={description:'Coffee with good company.',sourcePassage:'Coffee with Comrades. Veterans & Spouses Only.',rsvpDetails:'RSVP'};
 const description=preserveNewsletterEventDetails(e);assert.match(description,/Veterans & Spouses Only/);assert.match(description,/RSVP/);
 assert.equal(preserveNewsletterEventDetails({...e,description}),description);
});

test('routine classification cannot promote Home reminders; special occurrences need quoted evidence',()=>{
 const e={isRecurring:true,requiresRsvp:true,date:'November 6',occurrenceKind:'special',occurrenceEvidence:'November outing to a different venue',sourcePassage:'November outing to a different venue. RSVP by November 4.'};
 assert.equal(isEligibleNewsletterRsvp(e,true),true);
 assert.equal(isEligibleNewsletterRsvp({...e,occurrenceKind:'routine'},true),false);
 assert.equal(isEligibleNewsletterRsvp({...e,occurrenceKind:'uncertain'},true),false);
 assert.equal(isEligibleNewsletterRsvp({...e,occurrenceEvidence:'Invented charity fundraiser at a different venue'},true),false);
 assert.equal(isEligibleNewsletterRsvp({...e,requiresRsvp:false},true),false);
 assert.equal(isEligibleNewsletterRsvp({...e,isRecurring:false,occurrenceKind:undefined},true),false);
});
