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
