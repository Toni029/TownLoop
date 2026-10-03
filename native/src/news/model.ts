import type {
  CommunityRsvpEvent,
  NewsletterConfig,
  PinnedHighlight,
  UserProfile,
} from "../models";
export function belongsToEdition(
  item: { isAiExtracted?: boolean; newsletterId?: string },
  edition: NewsletterConfig | null,
) {
  return !(
    item.isAiExtracted &&
    edition?.id &&
    item.newsletterId &&
    item.newsletterId !== edition.id
  );
}
export function eventForResident(
  event: CommunityRsvpEvent,
  uid: string,
): CommunityRsvpEvent {
  return {
    ...event,
    userRsvp: !!event.attendees?.some((a) => a.userId === uid || a.id === uid),
  };
}
/** Transaction patch: never replace another resident's RSVP based on stale screen state. */
export function rsvpPatch(
  event: CommunityRsvpEvent,
  user: Pick<
    UserProfile,
    "id" | "name" | "email" | "unit" | "address" | "role"
  >,
  going: boolean,
  now: number,
) {
  const uid = String(user.id);
  const current = event.attendees || [];
  const already = current.some((a) => a.userId === uid || a.id === uid);
  if (already === going) return null;
  if (going && typeof event.spotsLeft === "number" && event.spotsLeft <= 0)
    throw new Error("This event has no available spots.");
  const attendees = going
    ? [
        {
          id: uid,
          userId: uid,
          name: user.name,
          unit: user.unit || user.address || "Cecil Pines Community",
          email: user.email,
          role: user.role || "resident",
          rsvpdAt: now,
        },
        ...current,
      ]
    : current.filter((a) => a.userId !== uid && a.id !== uid);
  return {
    attendees,
    attendeesCount: attendees.length,
    ...(typeof event.spotsLeft === "number"
      ? { spotsLeft: Math.max(0, event.spotsLeft + (going ? -1 : 1)) }
      : {}),
  };
}
export function newestFirst<T extends { createdAt?: number }>(items: T[]) {
  return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export function editionKey(config: NewsletterConfig | null) {
  return config && !config.isRemoved
    ? [
        config.id,
        config.uploadedAt || 0,
        config.pdfUrl || config.fileUrl || "",
      ].join("|")
    : "";
}
export function assemblePdf(
  chunks: { index: number; data: string }[],
  expected: unknown,
) {
  if (!Number.isInteger(expected) || Number(expected) < 1)
    throw new Error(
      "Newsletter file metadata is missing. Please upload the edition again.",
    );
  const parts = chunks
    .filter((c) => c.index < Number(expected))
    .sort((a, b) => a.index - b.index);
  if (parts.length !== expected || parts.some((c, i) => c.index !== i))
    throw new Error("The newsletter download is incomplete. Please try again.");
  const data = parts.map((c) => c.data).join("");
  if (!/^data:application\/pdf;base64,JVBERi0/.test(data))
    throw new Error("This file is not a valid PDF.");
  return data;
}
export function singleFlight() {
  const running = new Map<string, Promise<unknown>>();
  return async function run<T>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T> {
    if (running.has(key)) return running.get(key) as Promise<T>;
    const promise = Promise.resolve().then(action);
    running.set(key, promise);
    try {
      return await promise;
    } finally {
      running.delete(key);
    }
  };
}
export type NewsSnapshot = {
  events: CommunityRsvpEvent[];
  highlights: PinnedHighlight[];
  newsletter: NewsletterConfig | null;
  loading: boolean;
  error: string;
};
export type Watch<T> = (
  next: (value: T) => void,
  error: (e: unknown) => void,
) => () => void;
export function watchNews(
  ports: {
    events: Watch<CommunityRsvpEvent[]>;
    highlights: Watch<PinnedHighlight[]>;
    newsletter: Watch<NewsletterConfig | null>;
  },
  emit: (state: NewsSnapshot) => void,
  describe: (e: unknown) => string,
) {
  let active = true;
  const pending = new Set(["events", "highlights", "newsletter"]);
  let state: NewsSnapshot = {
    events: [],
    highlights: [],
    newsletter: null,
    loading: true,
    error: "",
  };
  const errors = new Map<string, string>();
  const stops: (() => void)[] = [];
  emit(state);
  for (const key of ["events", "highlights", "newsletter"] as const) {
    const done = () => {
      pending.delete(key);
      state = {
        ...state,
        loading: pending.size > 0,
        error: [...errors.values()].join("\n"),
      };
      emit(state);
    };
    try {
      stops.push(
        ports[key](
          (value) => {
            if (!active) return;
            state = { ...state, [key]: value };
            errors.delete(key);
            done();
          },
          (e) => {
            if (!active) return;
            errors.set(key, describe(e));
            state = { ...state, [key]: key === "newsletter" ? null : [] };
            done();
          },
        ),
      );
    } catch (e) {
      errors.set(key, describe(e));
      done();
    }
  }
  return () => {
    active = false;
    stops.forEach((stop) => stop());
  };
}
