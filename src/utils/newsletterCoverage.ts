/** Additive review metadata; never permission, publishing, or fabricated content. */
export const NEWSLETTER_EXTRACTION_VERSION = 'rsvp-coverage-v2';
export const HIGHLIGHT_TARGET = 10;
export type RsvpReference = {sourcePage:number;passage:string;eventTitle:string;eventDate:string};
export type CoverageIssue = {kind:string;message:string;sourcePage?:number;passage?:string;eventTitle?:string};
export type NewsletterCoverage = {version:2;pagesExpected:number[];pagesAudited:number[];references:RsvpReference[];unmatchedReferences:RsvpReference[];issues:CoverageIssue[];highlightsFound:number;highlightShortfallReason:string};
export const containsRsvp=(text:unknown)=>typeof text==='string'&&/\br\s*\.?\s*s\s*\.?\s*v\s*\.?\s*p\b/i.test(text);
const dateKey=(s:unknown)=>norm(String(s||'').replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/gi,''));
const norm=(s:unknown)=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function buildNewsletterCoverage(expected:number[],audits:any[],events:any[],highlights:any[],shortfallReasons:string[]=[]):NewsletterCoverage {
 const pagesAudited=[...new Set<number>(audits.flatMap(a=>a.auditedPages||[]).filter((p:unknown)=>Number.isInteger(p)&&expected.includes(p as number)))].sort((a,b)=>a-b);
 const references:RsvpReference[]=[],seen=new Set<string>(),issues:CoverageIssue[]=[];
 for(const audit of audits)for(const r of audit.rsvpReferences||[]){
  if(!containsRsvp(r.passage))continue; // Additional registration phrases are not literal RSVP references.
  if(!Number.isInteger(r.sourcePage)||!expected.includes(r.sourcePage)){
   issues.push({kind:'invalid-reference',message:'An independent RSVP reference needs source verification.',eventTitle:String(r.eventTitle||''),passage:String(r.passage||'')});continue;
  }
  const key=`${r.sourcePage}/${norm(r.passage)}/${norm(r.eventTitle)}/${norm(r.eventDate)}`;
  if(!seen.has(key)){seen.add(key);references.push({sourcePage:r.sourcePage,passage:String(r.passage),eventTitle:String(r.eventTitle||''),eventDate:String(r.eventDate||'')});}
 }
 const unmatchedReferences=references.filter(r=>!events.some(e=>{
  if(e.sourcePage!==r.sourcePage)return false;
  if(r.eventDate&&e.date&&dateKey(r.eventDate)!==dateKey(e.date))return false;
  const title=norm(r.eventTitle),et=norm(e.title),quote=norm(r.passage),eq=norm(e.rsvpDetails||e.deadline);
  // Require both event identity and quoted evidence. An unrelated event on the
  // same page or the generic word RSVP cannot satisfy this reference.
  return !!title&&title===et&&(Math.min(quote.length,eq.length)>=12||(quote==='rsvp'&&eq==='rsvp'&&!!r.eventDate&&!!e.date))&&(quote.includes(eq)||eq.includes(quote));
 }));
 for(const r of unmatchedReferences)issues.push({kind:'unmatched-rsvp',message:'This independently found RSVP passage has no verified matching event. Review or add it before publishing.',...r});
 for(const page of expected)if(!pagesAudited.includes(page))issues.push({kind:'page-not-audited',sourcePage:page,message:'Independent RSVP coverage was not confirmed for this page.'});
 if(!expected.length)issues.push({kind:'page-coverage-unknown',message:'The source page count could not be established. Review RSVP coverage manually.'});
 for(const e of events){
  if(!Number.isInteger(e.sourcePage)||!expected.includes(e.sourcePage))issues.push({kind:'event-source',eventTitle:e.title,message:'Verify this event’s original PDF page and RSVP passage before publishing.'});
  if(!e.date?.trim()||!e.time?.trim()||!e.location?.trim())issues.push({kind:'missing-event-details',sourcePage:e.sourcePage,eventTitle:e.title,passage:e.rsvpDetails,message:'Some printed event details are missing or uncertain. Empty fields must be reviewed; they were not invented.'});
  if(e.requiresRsvp!==true)issues.push({kind:'uncertain-rsvp',sourcePage:e.sourcePage,eventTitle:e.title,message:'Verify the attendee registration instruction for this event.'});
 }
 for(const h of highlights)if(!String(h.title||'').trim()||!String(h.summary||'').trim())issues.push({kind:'incomplete-highlight',sourcePage:h.sourcePage,message:'This highlight has missing details. Review its source; no title or story was invented.'});
 for(const h of highlights)if(!Number.isInteger(h.sourcePage)||!expected.includes(h.sourcePage)||!String(h.sourcePassage||'').trim())issues.push({kind:'highlight-source',sourcePage:h.sourcePage,eventTitle:h.title,message:'Verify this highlight against its original PDF passage before publishing.'});
 const highlightShortfallReason=highlights.length<HIGHLIGHT_TARGET?(shortfallReasons.filter(Boolean).join(' ')||`Only ${highlights.length} distinct supported highlights were extracted. Review the source for missed stories; no filler was invented.`):'';
 if(highlightShortfallReason)issues.push({kind:'highlight-shortfall',message:highlightShortfallReason});
 return {version:2,pagesExpected:expected,pagesAudited,references,unmatchedReferences,issues,highlightsFound:highlights.length,highlightShortfallReason};
}
/** Static staff/directory cards are not separate news stories. A printed change
 * or substantive announcement about the same service remains eligible. */
export function isMeaningfulNewsletterHighlight(item:{title?:unknown;summary?:unknown;sourcePassage?:unknown},routine=false):boolean {
 const heading=String(item.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const content=String(item.summary||'')+' '+String(item.sourcePassage||'');
 if(routine&&!/\b(cancell?\w*|no potluck|results?|season|won|award\w*|recognition|changed?|updated?|new|special|sale|book|review|selected)\b/i.test(heading+' '+content))return false;
 const directory=/^(general manager|front desk(?: contact)?|accounts payable receivable|housekeeping|maintenance team|zone captains|(?:[a-z ]+ )?activities committee(?: [a-z]+)? coordinators|(?:[a-z ]+ )?publication credits)$/;
 if(!directory.test(heading))return true;
 return /\b(new|changed?|updated?|closed?|closure|relocat\w*|deadline|effective|retir\w*|appoint\w*|welcome|promot\w*|award\w*|recognition|transition|resign\w*|hiring)\b/i.test(content);
}
/** A model summary must not erase eligibility, ticket/contact instructions or
 * other supported details that were captured in its quoted source passage. */
export function preserveNewsletterEventDetails(event:{description?:unknown;sourcePassage?:unknown;rsvpDetails?:unknown}):string {
 let description=typeof event.description==='string'?event.description.trim():'';
 for(const value of [event.sourcePassage,event.rsvpDetails]){
  if(typeof value==='string'&&value.trim()&&!norm(description).includes(norm(value)))description+=(description?'\n\n':'')+value.trim();
 }
 return description;
}
