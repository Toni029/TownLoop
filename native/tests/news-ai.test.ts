import test from "node:test";
import assert from "node:assert/strict";
import { analysisItems } from "../src/news/analysisModel.ts";
import type { NewsletterConfig } from "../src/models.ts";
const config = { id: "october", monthEdition: "October 2026" } as NewsletterConfig;
const result = { sourceModel: "gemini-3.8-flash", rsvp_events: [{ title: "Fall Festival", month: "OCT", day: 31, deadline: "RSVP by Oct 25", description: "Community festival" }], pinned_highlights: [{ title: "Office hours", summary: "Office closes at noon", tag: "Community Notice" }] };
test("AI drafts are edition-scoped, deduplicated and stable across reanalysis", () => {
 const items = analysisItems(result, config);
 assert.equal(items.length, 2);
 assert.equal(items[0].data.newsletterId, "october");
 assert.deepEqual(analysisItems({ ...result, rsvp_events: [...result.rsvp_events, ...result.rsvp_events] }, config).map(i => i.id), items.map(i => i.id));
 assert.notEqual(analysisItems(result, { ...config, id: "november" })[0].id, items[0].id);
 assert.equal(analysisItems({ ...result, rsvp_events: [], pinned_highlights: [] }, config).length, 0);
});
test("AI drafts reject missing RSVP evidence, invalid dates and incomplete responses", () => {
 assert.throws(() => analysisItems({ ...result, rsvp_events: [{ ...result.rsvp_events[0], deadline: "" }] }, config), /RSVP evidence/);
 assert.throws(() => analysisItems({ ...result, rsvp_events: [{ ...result.rsvp_events[0], day: 32 }] }, config), /valid date/);
 assert.throws(() => analysisItems({} as any, config), /incomplete/);
});
test('all supported highlights survive beyond seven and distinct same-day event sessions do not overwrite each other',()=>{
 const many={...result,pinned_highlights:Array.from({length:24},(_,i)=>({title:`Story ${i}`,summary:`Supported story ${i}`,sourcePage:i+1}))};
 assert.equal(analysisItems(many,config).length,25);
 const sessions={...result,rsvp_events:[{...result.rsvp_events[0],time:'10 AM'},{...result.rsvp_events[0],time:'2 PM'}]};
 const ids=analysisItems(sessions,config).filter(i=>i.collection==='community_events').map(i=>i.id);assert.equal(new Set(ids).size,2);
});
test('unknown event fields remain visible in review but cannot be published until corrected or excluded',()=>{
 const incomplete={...result,rsvp_events:[{...result.rsvp_events[0],day:'',month:''}]};
 const review=analysisItems(incomplete,config,{review:true});assert.equal(review[0].data.day,'');
 assert.throws(()=>analysisItems(incomplete,config),/valid date/);
 const selected=review.filter(i=>i.collection==='community_highlights').map(i=>i.id);
 assert.equal(analysisItems(incomplete,config,{selectedIds:selected}).length,1);
});
