import type {NewsletterCoverage} from '../../../src/utils/newsletterCoverage';
import type { NewsletterConfig } from "../models";
export type AnalysisResult = {
  sourceModel: string;
  coverage?: NewsletterCoverage;
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
  options: {review?: boolean; selectedIds?: readonly string[]} = {},
) {
  if (
    !result ||
    !Array.isArray(result.rsvp_events) ||
    !Array.isArray(result.pinned_highlights)
  )
    throw Error("The AI service returned incomplete results. Please retry.");
  if (JSON.stringify(result).length > 300000) throw Error("Analysis exceeds the safe review size. No items were published; ask the office to review the document in sections.");
  const common = {
    isAiExtracted: true,
    newsletterId: config.id,
    editionMonth: config.monthEdition,
    createdAt: Date.now(),
  };
  const eventKeys = new Map<string,string>();
  const events = result.rsvp_events.flatMap((e) => {
    const title = text(e.title),
      month = text(e.month).toUpperCase(),
      day = String(e.day || "").trim() ? String(e.day).trim().padStart(2, "0") : "";
    const baseId = `ai-ev-${stableId(config.id + title + month + day)}`;
    const signature = [text(e.date),text(e.time),text(e.location)].join('|');
    const first = eventKeys.get(baseId); if (first === undefined) eventKeys.set(baseId,signature);
    const id = first === undefined || first === signature ? baseId : `${baseId}-${stableId(signature)}`;
    if (options.selectedIds && !options.selectedIds.includes(id)) return [];
    if (!options.review && (
      !title ||
      !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/.test(month) ||
      !/^\d{2}$/.test(day) ||
      +day < 1 ||
      +day > 31 ||
      !text(e.deadline)
    ))
      throw Error(
        "An extracted event lacks a valid date or RSVP evidence. Correct it in review or deselect it before publishing.",
      );
    return {
      id,
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
        ...(Number.isInteger(e.sourcePage) ? {sourcePage:Number(e.sourcePage)} : {}),
        ...(text(e.sourcePassage) ? {sourcePassage:text(e.sourcePassage)} : {}),
        category: "Special Event",
        capacity: null,
        spotsLeft: null,
        attendees: [],
        attendeesCount: 0,
      },
    };
  });
  const highlightKeys = new Map<string,string>();
  const highlights = result.pinned_highlights.flatMap((h) => {
    const baseId = `ai-hl-${stableId(config.id + text(h.title))}`;
    const signature = text(h.sourcePassage) || text(h.summary);
    const first = highlightKeys.get(baseId); if (first === undefined) highlightKeys.set(baseId,signature);
    const id = first === undefined || first === signature ? baseId : `${baseId}-${stableId(signature)}`;
    if (options.selectedIds && !options.selectedIds.includes(id)) return [];
    if (!options.review && (!text(h.title) || !text(h.summary)))
      throw Error(
        "An extracted highlight is incomplete. Correct it in review or deselect it before publishing.",
      );
    return {
      id,
      collection: "community_highlights",
      data: {
        ...common,
        title: text(h.title),
        summary: text(h.summary),
        ...(Number.isInteger(h.sourcePage) ? {sourcePage:Number(h.sourcePage)} : {}),
        ...(text(h.sourcePassage) ? {sourcePassage:text(h.sourcePassage)} : {}),
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
