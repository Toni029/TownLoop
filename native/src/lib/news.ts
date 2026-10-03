import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { sortEventsEarlyFirst } from "../../../src/utils/eventSort";
import { db } from "./firebase";
import { friendlyError } from "./profile";
import { useSession } from "./session";
import {
  readNewsEvent,
  readNewsHighlight,
  belongsToEdition,
  eventForResident,
  newestFirst,
  watchNews,
  type NewsSnapshot,
} from "../news/model";
import type { NewsletterConfig } from "../models";
const empty: NewsSnapshot = {
  events: [],
  highlights: [],
  newsletter: null,
  loading: true,
  error: "",
};
export function useNews() {
  const { user, profile } = useSession();
  const [owned, setOwned] = useState<{ uid?: string; state: NewsSnapshot }>({
    state: empty,
  });
  const [attempt, setAttempt] = useState(0);
  const uid = user?.uid;
  const approved = !!profile?.approved;
  useEffect(() => {
    if (!uid || !approved) return;
    return watchNews(
      {
        events: (next, error) =>
          onSnapshot(
            collection(db, "community_events"),
            (snap) => next(snap.docs.map((d) => readNewsEvent(d.id, d.data()))),
            error,
          ),
        highlights: (next, error) =>
          onSnapshot(
            collection(db, "community_highlights"),
            (snap) =>
              next(snap.docs.map((d) => readNewsHighlight(d.id, d.data()))),
            error,
          ),
        newsletter: (next, error) => {
          const timer = setTimeout(
            () => error({ code: "auth/network-request-failed" }),
            20000,
          );
          const stop = onSnapshot(
            doc(db, "newsletters", "current"),
            { includeMetadataChanges: true },
            (snap) => {
              if (snap.metadata.fromCache) return;
              clearTimeout(timer);
              next(snap.exists() ? (snap.data() as NewsletterConfig) : null);
            },
            (e) => {
              clearTimeout(timer);
              error(e);
            },
          );
          return () => {
            clearTimeout(timer);
            stop();
          };
        },
      },
      (state) => setOwned({ uid, state }),
      friendlyError,
    );
  }, [uid, approved, attempt]);
  const visible = uid && approved && owned.uid === uid ? owned.state : empty;
  return {
    ...visible,
    events: sortEventsEarlyFirst(
      newestFirst(visible.events)
        .filter((e) => belongsToEdition(e, visible.newsletter))
        .map((e) => eventForResident(e, uid || "")),
    ),
    highlights: newestFirst(visible.highlights).filter((h) =>
      belongsToEdition(h, visible.newsletter),
    ),
    retry: () => setAttempt((n) => n + 1),
  };
}
