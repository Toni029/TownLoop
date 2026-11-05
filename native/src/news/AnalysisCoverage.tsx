import {View} from 'react-native';
import {buildNewsletterCoverage} from '../../../src/utils/newsletterCoverage';
import {Copy} from './ui';
import type {AnalysisResult} from './analysisModel';
/** Existing review dialogs only; never publishes or resolves warnings automatically. */
export function AnalysisCoverage({result}:{result:AnalysisResult}) {
 const original=result.coverage;
 // Recalculate after review edits/removal: never show stale matched counts.
 const coverage=original?buildNewsletterCoverage(original.pagesExpected,[{auditedPages:original.pagesAudited,rsvpReferences:original.references}],
  result.rsvp_events.map(e=>({...e,rsvpDetails:e.deadline,requiresRsvp:e.requiresRsvp!==false})),result.pinned_highlights,original.highlightShortfallReason?[original.highlightShortfallReason]:[]):undefined;
 if(coverage&&original)coverage.issues.unshift(...original.issues.filter(issue=>issue.kind==='invalid-reference'||issue.kind==='routine-calendar-exclusion'));
 return <View style={{padding:14,borderRadius:14,borderWidth:1,borderColor:'#d97706',gap:8}} accessibilityLiveRegion="polite">
  <Copy weight="bold">RSVP coverage review</Copy>
  {!coverage ? <Copy>Independent page coverage is unavailable for this older result. Reanalyze after the extraction backend update, or review the PDF manually.</Copy> : <>
   <Copy>{coverage.pagesAudited.length}/{coverage.pagesExpected.length} pages independently checked · {coverage.references.length} RSVP references · {coverage.unmatchedReferences.length} unmatched.</Copy>
   {coverage.issues.map((issue,index)=><View key={index} style={{gap:4}}>
    <Copy weight="bold">{issue.sourcePage ? `PDF page ${issue.sourcePage} · ` : ''}{issue.eventTitle || 'Review note'}</Copy>
    <Copy>{issue.message}</Copy>
    {!!issue.passage&&<Copy>{issue.passage}</Copy>}
   </View>)}
   {!coverage.issues.length&&<Copy>All independently found RSVP references have matching drafts. Please verify the details against the PDF before publishing.</Copy>}
   <Copy>{coverage.highlightsFound} distinct highlights extracted. Target: at least 10 when supported by the newsletter. No filler is added.</Copy>
  </>}
 </View>;
}
