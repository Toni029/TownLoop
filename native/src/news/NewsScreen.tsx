import { useEffect, useRef, useState } from "react";
import { View, Animated } from "react-native";
import { useReducedMotion } from "../home/hooks";
import { CheckCircle2 } from "lucide-react-native";
import { canManageNewsletter } from "../../../src/utils/permissions";
import { useNews } from "../lib/news";
import { useSession } from "../lib/session";
import type {
  CommunityRsvpEvent,
  NewsletterConfig,
  UserProfile,
} from "../models";
import { NewsFeed, type NewsAction } from "./NewsFeed";
import { EventEditor, HighlightEditor } from "./Editors";
import {
  newNewsId,
  removeNewsItem,
  saveEvent,
  saveHighlight,
  setRsvp,
} from "./actions";
import { Copy, NewsDialog, Action } from "./ui";
import { PdfReader } from "./PdfReader";
import { UploadEdition } from "./UploadEdition";
import {
  removeEdition,
  purgeRemovedEdition,
  restoreDefaultEdition,
} from "./edition";
import { sharePdf } from "./files";
import { editionKey } from "./model";
import { AI_DEFERRED_MESSAGE } from "./ai";
export default function NewsScreen() {
  const news = useNews();
  const { user, profile } = useSession();
  const manager =
    !!profile?.approved &&
    canManageNewsletter({
      ...profile?.source,
      ...profile,
      id: user?.uid,
    } as UserProfile);
  const [editor, setEditor] = useState<{
    type: "event" | "highlight";
    id: string;
    event?: CommunityRsvpEvent;
  } | null>(null);
  const [reader, setReader] = useState<NewsletterConfig | null>(null);
  const [upload, setUpload] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [cleanup, setCleanup] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function perform(fn: () => Promise<void>, success?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
      if (mounted.current && success) setToast(success);
    } catch (e) {
      if (mounted.current)
        setMessage(
          e instanceof Error
            ? e.message
            : "Unable to complete this request. Please try again.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function act(action: NewsAction) {
    if (lock.current) return;
    switch (action.type) {
      case "open":
        if (news.newsletter && !news.newsletter.isRemoved)
          setReader(news.newsletter);
        break;
      case "download":
        if (news.newsletter) void perform(() => sharePdf(news.newsletter!));
        break;
      case "upload":
        setUpload(true);
        break;
      case "analyze":
        setMessage(AI_DEFERRED_MESSAGE);
        break;
      case "restore":
        if (news.newsletter)
          void perform(
            () => restoreDefaultEdition(news.newsletter!),
            "Restored default September 2026 edition.",
          );
        break;
      case "remove":
        if (news.newsletter) {
          const edition = news.newsletter;
          void perform(async () => {
            setReader(null);
            try {
              await removeEdition(edition);
              setCleanup(null);
            } catch (e) {
              setCleanup(edition.id);
              throw e;
            }
          }, "Newsletter PDF has been removed.");
        }
        break;
      case "addEvent":
        setEditor({ type: "event", id: newNewsId("community_events") });
        break;
      case "editEvent":
        setEditor({
          type: "event",
          id: String(action.event.id),
          event: action.event,
        });
        break;
      case "pin":
        setEditor({ type: "highlight", id: newNewsId("community_highlights") });
        break;
      case "rsvp":
        void perform(
          () => setRsvp(action.event),
          action.event.userRsvp
            ? `RSVP Cancelled for "${action.event.title}".`
            : `RSVP Confirmed for "${action.event.title}"! Added to your schedule.`,
        );
        break;
      case "deleteEvent":
        void perform(
          () => removeNewsItem("community_events", String(action.event.id)),
          `Removed "${action.event.title}".`,
        );
        break;
      case "deleteHighlight":
        void perform(
          () => removeNewsItem("community_highlights", action.highlight.id),
          `Unpinned "${action.highlight.title}".`,
        );
        break;
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <NewsFeed
        {...news}
        manager={manager}
        busy={busy || news.loading}
        onAction={act}
      />
      {manager && editor?.type === "event" && (
        <EventEditor
          event={editor.event}
          onClose={() => setEditor(null)}
          onSave={(draft) => saveEvent(editor.id, draft, !!editor.event)}
        />
      )}{" "}
      {manager && editor?.type === "highlight" && (
        <HighlightEditor
          onClose={() => setEditor(null)}
          onSave={(draft) => saveHighlight(editor.id, draft)}
        />
      )}
      {manager && upload && (
        <UploadEdition
          current={news.newsletter}
          onClose={() => setUpload(false)}
          onPublished={() => setToast("Newsletter published successfully.")}
        />
      )}
      {reader && editionKey(reader) === editionKey(news.newsletter) && (
        <PdfReader
          config={reader}
          onClose={() => setReader(null)}
          onUpload={
            manager
              ? () => {
                  setReader(null);
                  setUpload(true);
                }
              : undefined
          }
        />
      )}
      {!!toast && (
        <NewsToast key={toast} message={toast} onDone={() => setToast("")} />
      )}
      {!!message && (
        <NewsDialog title="TownLoop" onClose={() => setMessage("")}>
          <Copy style={{ fontSize: 14, lineHeight: 22 }}>{message}</Copy>
          {cleanup && news.newsletter?.isRemoved && manager && (
            <Action
              label="Retry file cleanup"
              disabled={busy}
              onPress={() =>
                void perform(async () => {
                  await purgeRemovedEdition(cleanup);
                  setCleanup(null);
                }, "Newsletter files removed.")
              }
            />
          )}
          <Action label="OK" onPress={() => setMessage("")} />
        </NewsDialog>
      )}
    </View>
  );
}

function NewsToast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) progress.setValue(1);
    else
      Animated.spring(progress, {
        toValue: 1,
        damping: 26,
        stiffness: 480,
        mass: 0.35,
        useNativeDriver: true,
      }).start();
    const timer = setTimeout(onDone, 4000);
    return () => {
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [message, onDone, progress, reduced]);
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 24,
        alignSelf: "center",
        maxWidth: "90%",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#1c1917f2",
        borderWidth: 1,
        borderColor: "#44403c",
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }}
    >
      <CheckCircle2 size={16} color="#34d399" />
      <Copy weight="semi" style={{ color: "#fff", flexShrink: 1 }}>
        {message}
      </Copy>
    </Animated.View>
  );
}
