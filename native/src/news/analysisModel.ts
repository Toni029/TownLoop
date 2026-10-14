import type { NewsletterConfig } from "../models";
export type AnalysisResult = {
  sourceModel: string;
  rsvp_events: Record<string, unknown>[];
  pinned_highlights: Record<string, unknown>[];
};
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function stableId(value: string) {
  // Two independent hashes keep Firestore IDs bounded even for long article titles.
  let a = 2166136261,
    b = 5381;
  for (const c of value.toLowerCase()) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ c.charCodeAt(0);
  }
  return `${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
export function analysisItems(
  result: AnalysisResult,
  config: NewsletterConfig,
) {
  if (
    !result ||
    !Array.isArray(result.rsvp_events) ||
    !Array.isArray(result.pinned_highlights) ||
    result.rsvp_events.length > 100 ||
    result.pinned_highlights.length > 20
  )
    throw Error("The AI service returned incomplete results. Please retry.");
  const common = {
    isAiExtracted: true,
    newsletterId: config.id,
    editionMonth: config.monthEdition,
    createdAt: Date.now(),
  };
  const events = result.rsvp_events.map((e) => {
    const title = text(e.title),
      month = text(e.month).toUpperCase(),
      day = String(e.day || "").padStart(2, "0");
    if (
      !title ||
      !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/.test(month) ||
      !/^\d{2}$/.test(day) ||
      +day < 1 ||
      +day > 31 ||
      !text(e.deadline)
    )
      throw Error(
        "An extracted event lacks a valid date or RSVP evidence. Please retry analysis.",
      );
    return {
      id: `ai-ev-${stableId(config.id + title + month + day)}`,
      collection: "community_events",
      data: {
        ...common,
        title,
        month,
        day,
        time: text(e.time),
        location: text(e.location),
        description: text(e.description),
        deadline: text(e.deadline),
        category: "Special Event",
        capacity: null,
        spotsLeft: null,
        attendees: [],
        attendeesCount: 0,
      },
    };
  });
  const highlights = result.pinned_highlights.map((h) => {
    if (!text(h.title) || !text(h.summary))
      throw Error(
        "An extracted highlight is incomplete. Please retry analysis.",
      );
    return {
      id: `ai-hl-${stableId(config.id + text(h.title))}`,
      collection: "community_highlights",
      data: {
        ...common,
        title: text(h.title),
        summary: text(h.summary),
        description: text(h.summary),
        date: text(h.date) || config.monthEdition,
        category: text(h.tag) || "Community Notice",
        tag: text(h.tag),
        authorLabel: "Extracted with Gemini AI",
      },
    };
  });
  return [
    ...new Map(
      [...events, ...highlights].map((item) => [item.id, item]),
    ).values(),
  ];
}
