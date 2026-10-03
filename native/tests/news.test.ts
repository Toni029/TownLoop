import test from "node:test";
import assert from "node:assert/strict";
import {
  readNewsEvent,
  readNewsHighlight,
  assemblePdf,
  belongsToEdition,
  editionKey,
  hasUploadedNewsletter,
  eventForResident,
  rsvpPatch,
  singleFlight,
  watchNews,
} from "../src/news/model.ts";
import type { CommunityRsvpEvent, NewsletterConfig } from "../src/models";
const event = {
  id: "a",
  title: "Potluck",
  attendees: [],
  attendeesCount: 0,
  spotsLeft: 2,
} as unknown as CommunityRsvpEvent;
const user = {
  id: "resident-1",
  name: "Same Name",
  email: "r@example.invalid",
};
test("RSVP membership is resident-specific and never trusts a global userRsvp flag", () => {
  assert.equal(
    eventForResident({ ...event, userRsvp: true }, "other").userRsvp,
    false,
  );
  const patch = rsvpPatch(event, user, true, 123)!;
  assert.equal(
    eventForResident({ ...event, ...patch }, String(user.id)).userRsvp,
    true,
  );
  assert.equal(
    eventForResident({ ...event, ...patch }, "other").userRsvp,
    false,
  );
  assert.equal(rsvpPatch({ ...event, ...patch }, user, true, 124), null);
});
test("RSVP cancellation preserves namesakes and capacity; full event cannot be joined", () => {
  const first = rsvpPatch(event, user, true, 1)!;
  const second = rsvpPatch(
    { ...event, ...first },
    { ...user, id: "resident-2" },
    true,
    2,
  )!;
  const removed = rsvpPatch({ ...event, ...second }, user, false, 3)!;
  assert.equal(removed.attendees.length, 1);
  assert.equal(removed.attendees[0].id, "resident-2");
  assert.equal(removed.spotsLeft, 1);
  assert.throws(() => rsvpPatch({ ...event, spotsLeft: 0 }, user, true, 1));
});
test("manual notices survive edition changes; old AI results do not", () => {
  const n = { id: "oct" } as NewsletterConfig;
  assert.equal(
    belongsToEdition({ isAiExtracted: true, newsletterId: "sep" }, n),
    false,
  );
  assert.equal(
    belongsToEdition({ isAiExtracted: false, newsletterId: "sep" }, n),
    true,
  );
  assert.equal(
    belongsToEdition({ isAiExtracted: true, newsletterId: "oct" }, n),
    true,
  );
  assert.equal(editionKey({ ...n, isRemoved: true }), "");
  assert.notEqual(
    editionKey({ ...n, uploadedAt: 1 }),
    editionKey({ ...n, uploadedAt: 2 }),
  );
});
test("PDF chunks are ordered, verified and reject missing/duplicate/non-PDF files", () => {
  assert.equal(
    assemblePdf(
      [
        { index: 1, data: "JVBERi0=" },
        { index: 0, data: "data:application/pdf;base64," },
      ],
      2,
    ),
    "data:application/pdf;base64,JVBERi0=",
  );
  assert.throws(() => assemblePdf([{ index: 1, data: "x" }], 2));
  assert.throws(() =>
    assemblePdf(
      [
        { index: 0, data: "x" },
        { index: 0, data: "x" },
      ],
      2,
    ),
  );
  assert.throws(() => assemblePdf([{ index: 0, data: "<html>" }], 1));
});
test("double taps share one operation and a failed request can be retried", async () => {
  const run = singleFlight();
  let calls = 0;
  let finish!: () => void;
  const task = () =>
    new Promise<void>((resolve) => {
      calls++;
      finish = resolve;
    });
  const a = run("publish", task),
    b = run("publish", task);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  await Promise.all([a, b]);
  await assert.rejects(
    run("publish", async () => {
      throw Error("offline");
    }),
  );
  await run("publish", async () => {
    calls++;
  });
  assert.equal(calls, 2);
});
test("live News subscriptions report partial errors and suppress callbacks after cleanup", () => {
  const callbacks: Record<
    string,
    { next: (v: any) => void; error: (e: unknown) => void }
  > = {};
  const stopped: string[] = [];
  const states: any[] = [];
  const port =
    (key: string) => (next: (v: any) => void, error: (e: unknown) => void) => {
      callbacks[key] = { next, error };
      return () => {
        stopped.push(key);
      };
    };
  const stop = watchNews(
    {
      events: port("events"),
      highlights: port("highlights"),
      newsletter: port("newsletter"),
    },
    (v) => states.push(v),
    () => "No access",
  );
  callbacks.events.next([event]);
  callbacks.highlights.error(Error());
  callbacks.newsletter.next(null);
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).events.length, 1);
  assert.equal(states.at(-1).error, "No access");
  const count = states.length;
  stop();
  callbacks.events.next([]);
  callbacks.newsletter.error(Error());
  assert.equal(states.length, count);
  assert.deepEqual(stopped, ["events", "highlights", "newsletter"]);
});

test("live document normalization matches reference defaults and Firestore timestamps", () => {
  const event = readNewsEvent("real-document", {
    day: 20,
    attendees: [{ id: "resident" }],
    spotsLeft: null,
    updatedAt: { toMillis: () => 123 },
  });
  assert.equal(event.day, "20");
  assert.equal(event.attendeesCount, 1);
  assert.equal(event.spotsLeft, undefined);
  assert.equal(event.createdAt, 123);
  assert.equal(event.userRsvp, false);
  const notice = readNewsHighlight("notice", {
    title: "Notice",
    description: "Details",
    updatedAt: { toMillis: () => 456 },
  });
  assert.equal(notice.authorLabel, "Community Update");
  assert.equal(notice.summary, "Details");
  assert.equal(notice.createdAt, 456);
});

test("newsletter availability requires an upload and never expires it by edition month", () => {
  const metadata = {
    id: "legacy-edition",
    editionTitle: "Past edition",
    monthEdition: "September 2026",
    description: "",
    uploadedAt: Date.UTC(2026, 8, 1),
  };
  assert.equal(hasUploadedNewsletter(null), false);
  assert.equal(hasUploadedNewsletter(metadata), false);
  const uploaded = {
    ...metadata,
    pdfUrl: "firestore:uploaded-edition",
    isCustomUpload: true,
  };
  assert.equal(hasUploadedNewsletter(uploaded), true);
  assert.equal(
    hasUploadedNewsletter({ ...uploaded, monthEdition: "December 2025" }),
    true,
  );
  assert.equal(
    hasUploadedNewsletter({ ...metadata, hasFirestoreBlob: true, totalChunks: 4 }),
    true,
  );
  assert.equal(hasUploadedNewsletter({ ...uploaded, isRemoved: true }), false);
});
