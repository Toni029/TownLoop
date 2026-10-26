import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import type { MediaAttachment } from "../../../src/types";
import { useCommunity } from "../lib/community";
import { useResident } from "../lib/resident";
import { useLiveCollection } from "../lib/liveCollection";
import { Action, Copy, NewsDialog } from "../news/ui";
import { ProductToast } from "../components/ProductToast";
import { MarketplaceGallery } from "../components/MarketplaceGallery";
import { MediaViewer } from "../components/MediaViewer";
import {
  readPost,
  readListing,
  readPerson,
  readChat,
  orderedChats,
  chatSide,
  withAvatar,
  avatarResolver,
  communityResidentLabel,
  type Listing,
} from "./model";
import { changeSocial, changeChat, inquire, type SocialKind } from "./actions";
import { SocialFeed, Detail, type SocialAction } from "./SocialFeed";
import { CreateEditor } from "./CreateEditor";
import { Inbox, MessageSeller } from "./Inbox";
export default function SocialScreen() {
  const user = useResident();
  const { community } = useCommunity();
  const residentLabel = communityResidentLabel(community);
  useEffect(() => {
    // Retire the one temporary diagnostic record; resident content is untouched.
    void AsyncStorage.removeItem('townloop:preview:feed-upload-trace:v1').catch(() => {});
  }, []);
  const posts = useLiveCollection("discussion_feed", readPost);
  const listings = useLiveCollection("marketplace_posts", readListing);
  const directory = useLiveCollection("resident_directory", readPerson, "");
  const inbox = useLiveCollection("marketplace_chats", readChat, "");
  const uid = String(user?.id || "");
  const [view, setView] = useState<SocialKind>("post");
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<{
    kind: SocialKind;
    id: string;
  } | null>(null);
  const [seller, setSeller] = useState<string | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [media, setMedia] = useState<{
    files: MediaAttachment[];
    index: number;
    title: string;
    returnTo: typeof selected;
    keepDetails: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const lock = useRef(false);
  const resolveAvatar = useMemo(() => avatarResolver(directory.items, user), [directory.items, user]);
  const resolvedPosts = useMemo(() => posts.items.map((p) => ({
    ...withAvatar(p, directory.items, user, resolveAvatar),
    unit: residentLabel,
    liked: p.likedBy[uid] === true,
  })), [posts.items, directory.items, user, resolveAvatar, uid, residentLabel]);
  const resolvedListings = useMemo(() => listings.items.map((p) =>
    ({...withAvatar(p, directory.items, user, resolveAvatar), unit: residentLabel}),
  ), [listings.items, directory.items, user, resolveAvatar, residentLabel]);
  const chats = useMemo(() => orderedChats(inbox.items, uid), [inbox.items, uid]);
  const unread = chats.filter((c) =>
    chatSide(c, uid) === "seller" ? c.unreadForSeller : c.unreadForBuyer,
  ).length;
  const item = selected
    ? (selected.kind === "post" ? resolvedPosts : resolvedListings).find(
        (p) => String(p.id) === selected.id,
      )
    : null;
  const sellerItem = resolvedListings.find((i) => String(i.id) === seller);
  const perform = useCallback(async (fn: () => Promise<void>, success = "") => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (success) setToast(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete this request.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  const action: SocialAction = async (kind, id, operation, payload) =>
    perform(
      async () => {
        await changeSocial(id, kind, operation, payload);
      },
      operation === "comment"
        ? "Comment posted!"
        : operation === "sold"
          ? "Listing status updated"
          : operation === "delete" && kind !== "listing"
            ? "Item deleted"
            : "",
    );
  const readChatAction = useCallback(
    (id: string) => perform(() => changeChat(id, "read")),
    [perform],
  );
  const onMedia = (files: MediaAttachment[], title: string, index = 0) => {
    const keepDetails = files[index]?.type === "image";
    const photos = keepDetails ? files.filter(file => file.type === "image") : files;
    const photoIndex = keepDetails ? files.slice(0, index).filter(file => file.type === "image").length : index;
    setMedia({ files: photos, title, index: photoIndex, returnTo: selected, keepDetails });
    // Image galleries layer above the existing post; closing never replays its entrance.
    if (!keepDetails) setSelected(null);
    setError("");
  };
  const Gallery = media?.files.every(file => file.type === "image") ? MarketplaceGallery : MediaViewer;
  const onMessage = (item: Listing) => {
    setSelected(null);
    setError("");
    setSeller(String(item.id));
  };
  const data = view === "post" ? posts : listings;
  // Optional directory/avatar and Inbox failures must not claim the feed itself is forbidden.
  const currentError = data.error;
  return (
    <View style={{ flex: 1 }}>
      <SocialFeed
        posts={resolvedPosts}
        listings={resolvedListings}
        user={user}
        view={view}
        setView={setView}
        loading={data.loading}
        error={currentError}
        retry={() => {
          data.retry();
          directory.retry();
          inbox.retry();
        }}
        busy={busy}
        reactionsReady={!posts.loading && !posts.error}
        unread={unread}
        onCreate={() => {
          setError("");
          setCreate(true);
        }}
        onOpen={(kind, id) => {
          setError("");
          setSelected({ kind, id });
        }}
        onMedia={onMedia}
        onInbox={() => {
          setError("");
          setShowInbox(true);
        }}
        onAction={action}
        onMessage={onMessage}
      />
      {create && (
        <CreateEditor
          initialKind={view}
          onClose={() => setCreate(false)}
          onSaved={(kind) => {
            setView(kind);
            setToast(
              kind === "post"
                ? "Community post shared!"
                : "Marketplace listing created!",
            );
          }}
        />
      )}
      {selected && item && (
        <Detail
          error={error}
          kind={selected.kind}
          item={item}
          user={user}
          busy={busy}
          reactionsReady={!posts.loading && !posts.error}
          onClose={() => setSelected(null)}
          onAction={action}
          onMessage={onMessage}
          onMedia={onMedia}
        />
      )}
      {sellerItem && (
        <MessageSeller
          error={error}
          item={sellerItem}
          user={user}
          busy={busy}
          onClose={() => setSeller(null)}
          onSend={(text, contact, messageId) =>
            perform(async () => {
              const id = await inquire(
                String(sellerItem.id),
                text,
                contact,
                messageId,
              );
              setSeller(null);
              setSelected(null);
              setActiveChat(id);
              setShowInbox(true);
            }, "Message sent!")
          }
        />
      )}
      {showInbox && (
        <Inbox
          error={[error, inbox.error].filter(Boolean).join("\n")}
          loading={inbox.loading}
          retry={inbox.retry}
          chats={chats}
          user={user}
          activeId={activeChat}
          setActiveId={setActiveChat}
          busy={busy}
          onClose={() => setShowInbox(false)}
          onRead={readChatAction}
          onReply={(id, text, messageId) =>
            perform(() => changeChat(id, "reply", text, messageId))
          }
          onLeave={(id) =>
            perform(
              () => changeChat(id, "leave"),
              "Conversation removed from your inbox",
            )
          }
          onViewItem={(id) => {
            if (resolvedListings.some((i) => String(i.id) === id)) {
              setShowInbox(false);
              setSelected({ kind: "listing", id });
            } else setError("This listing is no longer available.");
          }}
        />
      )}
      {media && (
        <Gallery
          media={media.files}
          initialIndex={media.index}
          title={media.title}
          onClose={() => {
            if (!media.keepDetails) setSelected(media.returnTo);
            setMedia(null);
          }}
        />
      )}
      {!!(error && !item && !sellerItem && !showInbox && !media && !create) && (
        <NewsDialog title="Community" onClose={() => setError("")}>
          <Copy>{error}</Copy>
          <Action label="OK" onPress={() => setError("")} />
        </NewsDialog>
      )}
      {!!(toast) && (
        <ProductToast key={toast} message={toast} onDone={() => setToast("")} />
      )}
    </View>
  );
}
