import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
  Share,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MessageSquare,
  Tag,
  Plus,
  Mail,
  Trash2,
  Send,
  CheckCircle2,
  RotateCcw,
  Share2,
} from "lucide-react-native";
import type {
  UserProfile,
  CommentItem,
  MediaAttachment,
} from "../../../src/types";
import { canDeleteAnyPost } from "../../../src/utils/permissions";
import { Action, Copy, Field, ErrorNotice, s, useNewsFonts } from "../news/ui";
import { Collapsible } from "../components/Collapsible";
import { ProductDialog } from "../components/ProductDialog";
import { mediaFor, owns, type Post, type Listing } from "./model";
import { newSocialId, type SocialKind } from "./actions";
export type SocialAction = (
  kind: SocialKind,
  id: string,
  action: "delete" | "sold" | "comment" | "like",
  payload?: {
    text?: string;
    commentId?: string;
    liked?: boolean;
    sold?: boolean;
  },
) => Promise<boolean>;
export function Avatar({ uri, name }: { uri?: string; name: string }) {
  return uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={name}
      style={{
        width: 36,
        height: 36,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#0596694d",
      }}
    />
  ) : (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 20,
        backgroundColor: "#f5f5f4",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Copy weight="bold" style={{ color: "#44403c" }}>
        {name.slice(0, 2).toUpperCase()}
      </Copy>
    </View>
  );
}
function Pill({
  label,
  tone = "stone",
  solid = false,
}: {
  label: string;
  solid?: boolean;
  tone?: "stone" | "green" | "amber";
}) {
  const color = solid
    ? "#fff"
    : tone === "green"
      ? "#065f46"
      : tone === "amber"
        ? "#92400e"
        : "#57534e";
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: solid
          ? "transparent"
          : tone === "green"
            ? "#6ee7b7"
            : "#d6d3d1",
        backgroundColor: solid
          ? tone === "green"
            ? "#059669"
            : tone === "amber"
              ? "#d97706"
              : "#a8a29e"
          : tone === "green"
            ? "#d1fae5"
            : tone === "amber"
              ? "#fef3c7"
              : "#f5f5f4",
      }}
    >
      <Copy weight="bold" style={{ fontSize: 10, color }}>
        {label}
      </Copy>
    </View>
  );
}
function DeleteControl({
  onDelete,
  busy,
}: {
  onDelete: () => void;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <View style={s.row}>
      <Copy style={{ color: "#be123c" }}>Delete?</Copy>
      <Action
        compact
        label="Yes"
        tone="rose"
        disabled={busy}
        onPress={onDelete}
      />
      <Action
        compact
        label="Cancel"
        tone="light"
        onPress={() => setConfirm(false)}
      />
    </View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Delete item"
      disabled={busy}
      onPress={() => setConfirm(true)}
      style={{ padding: 12 }}
    >
      <Trash2 size={16} color="#a8a29e" />
    </Pressable>
  );
}
export function Comments({
  comments,
  onSubmit,
  busy,
}: {
  comments: CommentItem[];
  onSubmit: (text: string, id: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [id, setId] = useState(newSocialId);
  const [submitting, setSubmitting] = useState(false);
  async function send() {
    if (submitting || busy || !text.trim()) return;
    setSubmitting(true);
    try {
      if (await onSubmit(text, id)) {
        setText("");
        setId(newSocialId());
      }
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {comments.map((c) => (
        <View
          key={c.id}
          style={[s.row, { alignItems: "flex-start", flexWrap: "nowrap" }]}
        >
          <Avatar uri={c.authorAvatar} name={c.author} />
          <View
            style={{
              flex: 1,
              backgroundColor: "#f5f5f4",
              borderRadius: 16,
              padding: 12,
              gap: 4,
            }}
          >
            <Copy weight="bold">
              {c.author}{" "}
              <Copy style={{ color: "#a8a29e", fontSize: 10 }}>
                {c.unit} • {c.timeAgo}
              </Copy>
            </Copy>
            <Copy style={{ lineHeight: 20 }}>{c.text}</Copy>
          </View>
        </View>
      ))}
      {!comments.length && (
        <Copy style={{ color: "#78716c" }}>
          No comments yet. Start the conversation!
        </Copy>
      )}
      <Field
        label="Add a comment"
        value={text}
        onChangeText={setText}
        editable={!busy && !submitting}
        multiline
        placeholder="Write a friendly reply…"
      />
      <Action
        label="Send Comment"
        icon={Send}
        disabled={busy || submitting || !text.trim()}
        onPress={() => void send()}
      />
    </View>
  );
}
export function ListingActions({
  item,
  user,
  busy,
  onAction,
  onMessage,
}: {
  item: Listing;
  user: UserProfile | null;
  busy: boolean;
  onAction: SocialAction;
  onMessage: (item: Listing) => void;
}) {
  const sold = !!(item.sold || item.claimed);
  return (
    <View
      style={[
        s.row,
        {
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderColor: "#f5f5f4",
          paddingTop: 8,
        },
      ]}
    >
      <Copy style={{ color: "#78716c", fontSize: 11 }}>Porch pickup</Copy>
      {owns(item, user) ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            void onAction("listing", String(item.id), "sold", { sold: !sold })
          }
          style={[
            s.row,
            {
              paddingHorizontal: 12,
              paddingVertical: 8,
              minHeight: 44,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "#d6d3d1",
              backgroundColor: "#f5f5f4cc",
            },
          ]}
        >
          {sold ? (
            <RotateCcw size={16} color="#78716c" />
          ) : (
            <CheckCircle2 size={16} color="#059669" />
          )}
          <Copy weight="bold">
            {sold ? "Mark as Available" : "Mark as Sold"}
          </Copy>
        </Pressable>
      ) : sold ? (
        <Pill label="Item Sold" />
      ) : (
        <Action
          label="Message Seller"
          icon={MessageSquare}
          onPress={() => onMessage(item)}
          disabled={busy}
        />
      )}
    </View>
  );
}
function MediaPreview({
  media,
  title,
  onMedia,
  listing = false,
}: {
  media: MediaAttachment[];
  title: string;
  onMedia: (media: MediaAttachment[], title: string, index?: number) => void;
  listing?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        media.length ? `Open media for ${title}` : `View ${title}`
      }
      onPress={() => {
        if (media.length) onMedia(media, title);
      }}
      style={{
        width: listing ? 80 : "100%",
        height: listing ? 80 : 190,
        borderRadius: listing ? 12 : 16,
        overflow: "hidden",
        backgroundColor: media.length ? "#0c0a09" : "#ecfdf5",
        borderWidth: listing ? 1 : 0,
        borderColor: "#e7e5e4",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {media[0]?.type === "image" ? (
        <Image
          source={{ uri: media[0].url }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : media.length ? (
        <Copy style={{ fontSize: 24, color: "#fff" }}>▶</Copy>
      ) : (
        <Tag size={28} color="#047857" />
      )}
      {media.length > 1 && (
        <View
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            backgroundColor: "#0009",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <Copy style={{ color: "#fff" }}>+{media.length - 1}</Copy>
        </View>
      )}
    </Pressable>
  );
}
export function SocialFeed({
  posts,
  listings,
  user,
  view,
  setView,
  loading,
  error,
  retry,
  busy,
  reactionsReady,
  unread,
  onCreate,
  onOpen,
  onMedia,
  onInbox,
  onAction,
  onMessage,
}: {
  posts: Post[];
  listings: Listing[];
  user: UserProfile | null;
  view: SocialKind;
  setView: (kind: SocialKind) => void;
  loading: boolean;
  error: string;
  retry: () => void;
  busy: boolean;
  reactionsReady: boolean;
  unread: number;
  onCreate: () => void;
  onOpen: (kind: SocialKind, id: string) => void;
  onMedia: (media: MediaAttachment[], title: string, index?: number) => void;
  onInbox: () => void;
  onAction: SocialAction;
  onMessage: (item: Listing) => void;
}) {
  useNewsFonts();
  const [comments, setComments] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: "#faf8f4" }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
      >
        <View
          style={[
            s.row,
            { justifyContent: "space-between", alignItems: "flex-start" },
          ]}
        >
          <View style={{ flex: 1, minWidth: 120 }}>
            <Copy
              accessibilityRole="header"
              weight="serif"
              style={{ fontSize: 20, lineHeight: 27 }}
            >
              Community
            </Copy>
            <Copy style={{ color: "#78716c" }}>
              Neighbors, conversations & marketplace
            </Copy>
          </View>
          <View style={s.row}>
            {view === "listing" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Marketplace Chats & Inbox"
                onPress={onInbox}
                style={[
                  s.row,
                  {
                    padding: 10,
                    minHeight: 44,
                    borderRadius: 16,
                    backgroundColor: "#f5f5f4",
                    borderWidth: 1,
                    borderColor: "#d6d3d1",
                  },
                ]}
              >
                <Mail size={18} color="#047857" />
                {width >= 600 && <Copy weight="bold">Marketplace Chats</Copy>}
                {unread > 0 && (
                  <View
                    style={{
                      backgroundColor: "#e11d48",
                      borderRadius: 12,
                      paddingHorizontal: 5,
                    }}
                  >
                    <Copy style={{ color: "#fff", fontSize: 10 }}>
                      {unread}
                    </Copy>
                  </View>
                )}
              </Pressable>
            )}
            <Action
              label={view === "listing" ? "New listing" : "New post"}
              icon={Plus}
              onPress={onCreate}
              disabled={busy}
            />
          </View>
        </View>
        <View
          style={[
            s.row,
            {
              padding: 4,
              borderRadius: 16,
              backgroundColor: "#e7e5e4cc",
              flexWrap: "nowrap",
            },
          ]}
        >
          {(["post", "listing"] as const).map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === kind }}
              onPress={() => setView(kind)}
              style={[
                s.row,
                {
                  flex: 1,
                  justifyContent: "center",
                  minHeight: 44,
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: view === kind ? "#fff" : "transparent",
                  flexWrap: "nowrap",
                },
              ]}
            >
              {kind === "post" ? (
                <MessageSquare size={14} color="#065f46" />
              ) : (
                <Tag size={14} color="#065f46" />
              )}
              <Copy
                weight="bold"
                style={{
                  color: view === kind ? "#022c22" : "#57534e",
                  flexShrink: 1,
                  textAlign: "center",
                }}
              >
                {kind === "post"
                  ? `Discussion Feed (${posts.length})`
                  : `Buy / Sell / Free (${listings.length})`}
              </Copy>
            </Pressable>
          ))}
        </View>
        {loading && (
          <ActivityIndicator
            accessibilityLabel="Loading community"
            color="#047857"
          />
        )}
        {error && <ErrorNotice message={error} retry={retry} />}
        {!loading &&
          !error &&
          !(view === "post" ? posts.length : listings.length) && (
            <View
              style={[
                s.card,
                { borderRadius: 24, padding: 32, alignItems: "center" },
              ]}
            >
              {view === "listing" ? (
                <Tag size={24} color="#047857" />
              ) : (
                <MessageSquare size={24} color="#047857" />
              )}
              <Copy weight="bold">
                {view === "listing"
                  ? "No Marketplace Listings Yet"
                  : "No Community Posts Yet"}
              </Copy>
              <Copy style={{ textAlign: "center", color: "#78716c" }}>
                {view === "listing"
                  ? "The marketplace feed is currently empty. Tap the post button above to list furniture, tools, books, or giveaways for your neighbors!"
                  : "Share an announcement, story or update with your neighbors."}
              </Copy>
            </View>
          )}
        {view === "post"
          ? posts.map((post) => (
              <View
                key={post.id}
                style={[s.card, { borderRadius: 24, padding: 16, gap: 12 }]}
              >
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${post.title}`}
                    onPress={() => onOpen("post", String(post.id))}
                    style={[s.row, { flex: 1 }]}
                  >
                    <Avatar uri={post.authorAvatar} name={post.author} />
                    <View style={{ flex: 1 }}>
                      <Copy weight="bold">{post.author}</Copy>
                      <Copy style={{ fontSize: 10, color: "#a8a29e" }}>
                        {post.timeAgo}
                      </Copy>
                    </View>
                  </Pressable>
                  <Pill label={post.tag} />
                  {(owns(post, user) || canDeleteAnyPost(user)) && (
                    <DeleteControl
                      busy={busy}
                      onDelete={() =>
                        void onAction("post", String(post.id), "delete")
                      }
                    />
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Read ${post.title}`}
                  onPress={() => onOpen("post", String(post.id))}
                >
                  <Copy weight="bold" style={{ fontSize: 14, lineHeight: 21 }}>
                    {post.title}
                  </Copy>
                  <Copy
                    numberOfLines={3}
                    style={{ color: "#57534e", lineHeight: 21, marginTop: 6 }}
                  >
                    {post.content}
                  </Copy>
                </Pressable>
                {mediaFor(post).length > 0 && (
                  <MediaPreview
                    media={mediaFor(post)}
                    title={post.title}
                    onMedia={onMedia}
                  />
                )}
                <View
                  style={[
                    s.row,
                    {
                      borderTopWidth: 1,
                      borderColor: "#e7e5e4",
                      paddingTop: 6,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${post.liked ? "Unlike" : "Like"} ${post.title}`}
                    accessibilityState={{
                      selected: post.liked,
                      disabled: busy || !reactionsReady,
                    }}
                    disabled={busy || !reactionsReady}
                    onPress={() =>
                      void onAction("post", String(post.id), "like", {
                        liked: !post.liked,
                      })
                    }
                    style={{
                      padding: 10,
                      minHeight: 44,
                      borderRadius: 12,
                      backgroundColor: post.liked ? "#fff1f2" : "transparent",
                    }}
                  >
                    <Copy style={{ color: post.liked ? "#e11d48" : "#78716c" }}>
                      {post.liked ? "❤️" : "🤍"} {post.likes}
                    </Copy>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${post.comments.length} Comments for ${post.title}`}
                    accessibilityState={{
                      expanded: comments === String(post.id),
                    }}
                    onPress={() =>
                      setComments((v) =>
                        v === String(post.id) ? null : String(post.id),
                      )
                    }
                    style={[
                      s.row,
                      { padding: 10, minHeight: 44, marginLeft: "auto" },
                    ]}
                  >
                    <MessageSquare size={16} color="#78716c" />
                    <Copy>
                      {post.comments.length}{" "}
                      {post.comments.length === 1 ? "Comment" : "Comments"}
                    </Copy>
                  </Pressable>
                </View>
                <Collapsible open={comments === String(post.id)}>
                  <Comments
                    comments={post.comments}
                    busy={busy}
                    onSubmit={(text, commentId) =>
                      onAction("post", String(post.id), "comment", {
                        text,
                        commentId,
                      })
                    }
                  />
                </Collapsible>
              </View>
            ))
          : listings.map((item) => (
              <View
                key={item.id}
                style={[
                  s.card,
                  {
                    borderRadius: 24,
                    padding: 16,
                    gap: 14,
                    backgroundColor: item.sold ? "#f5f5f4" : "#fff",
                    opacity: item.sold ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <View style={[s.row, { flex: 1, minWidth: 100 }]}>
                    <Avatar uri={item.authorAvatar} name={item.author} />
                    <View style={{ flex: 1 }}>
                      <Copy weight="bold">{item.author}</Copy>
                      <Copy style={{ fontSize: 10, color: "#a8a29e" }}>
                        ◷ {item.timeAgo}
                      </Copy>
                    </View>
                  </View>
                  <Pill
                    label={item.sold ? "Sold" : "Available"}
                    tone={item.sold ? "stone" : "green"}
                  />
                  <Pill
                    solid
                    label={item.price}
                    tone={
                      item.sold
                        ? "stone"
                        : item.price.toUpperCase() === "FREE"
                          ? "green"
                          : "amber"
                    }
                  />
                  {(owns(item, user) || canDeleteAnyPost(user)) && (
                    <DeleteControl
                      busy={busy}
                      onDelete={() =>
                        void onAction("listing", String(item.id), "delete")
                      }
                    />
                  )}
                </View>
                <View
                  style={[
                    s.row,
                    { alignItems: "flex-start", flexWrap: "nowrap", gap: 14 },
                  ]}
                >
                  <MediaPreview
                    media={mediaFor(item)}
                    title={item.title}
                    onMedia={onMedia}
                    listing
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View item ${item.title}`}
                    onPress={() => onOpen("listing", String(item.id))}
                    style={{ flex: 1, gap: 6 }}
                  >
                    <Copy
                      weight="bold"
                      style={{
                        fontSize: 16,
                        lineHeight: 23,
                        textDecorationLine: item.sold ? "line-through" : "none",
                      }}
                    >
                      {item.title}
                    </Copy>
                    <Copy
                      numberOfLines={3}
                      style={{ color: "#57534e", lineHeight: 21 }}
                    >
                      {item.description}
                    </Copy>
                  </Pressable>
                </View>
                <ListingActions
                  item={item}
                  user={user}
                  busy={busy}
                  onAction={onAction}
                  onMessage={onMessage}
                />
              </View>
            ))}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Detail({
  error = "",
  kind,
  item,
  user,
  busy,
  reactionsReady,
  onClose,
  onAction,
  onMessage,
  onMedia,
}: {
  error?: string;
  kind: SocialKind;
  item: Post | Listing;
  user: UserProfile | null;
  busy: boolean;
  reactionsReady: boolean;
  onClose: () => void;
  onAction: SocialAction;
  onMessage: (item: Listing) => void;
  onMedia: (media: MediaAttachment[], title: string, index?: number) => void;
}) {
  const [shareError, setShareError] = useState("");
  const post = kind === "post" ? (item as Post) : null;
  const listing = kind === "listing" ? (item as Listing) : null;
  return (
    <ProductDialog
      title={item.author}
      subtitle={`${item.unit} • ${item.timeAgo}`}
      onClose={onClose}
      busy={busy}
      initiallyFull
    >
      <View style={s.row}>
        <Avatar uri={item.authorAvatar} name={item.author} />
        {listing ? (
          <>
            <Pill
              label={listing.sold ? "Sold" : "Available"}
              tone={listing.sold ? "stone" : "green"}
            />
            <Pill
              solid
              label={listing.price}
              tone={
                listing.sold
                  ? "stone"
                  : listing.price.toUpperCase() === "FREE"
                    ? "green"
                    : "amber"
              }
            />
          </>
        ) : (
          <Pill label={post!.tag} />
        )}
      </View>
      <View style={s.row}>
        <Action
          label="Share post"
          icon={Share2}
          tone="light"
          onPress={() =>
            void Share.share({
              title: item.title,
              message: `${item.title}\n${post?.content || listing?.description || ""}`,
            }).catch(() =>
              setShareError("Unable to share this item. Please try again."),
            )
          }
        />
        {(owns(item, user) || canDeleteAnyPost(user)) && (
          <DeleteControl
            busy={busy}
            onDelete={() => void onAction(kind, String(item.id), "delete")}
          />
        )}
      </View>
      {(error || shareError) && <ErrorNotice message={error || shareError} />}
      <Copy weight="bold" style={{ fontSize: 20, lineHeight: 28 }}>
        {item.title}
      </Copy>
      <Copy style={{ fontSize: 14, lineHeight: 23 }}>
        {post?.content || listing?.description}
      </Copy>
      {mediaFor(item).map((m, index) => (
        <MediaPreview
          key={`${m.url}-${index}`}
          media={[m]}
          title={item.title}
          onMedia={() => onMedia(mediaFor(item), item.title, index)}
        />
      ))}
      {post && (
        <Action
          label={`${post.liked ? "❤️" : "🤍"} ${post.likes} ${post.likes === 1 ? "Like" : "Likes"}`}
          disabled={busy || !reactionsReady}
          tone={post.liked ? "rose" : "light"}
          onPress={() =>
            void onAction("post", String(post.id), "like", {
              liked: !post.liked,
            })
          }
        />
      )}{" "}
      {listing && (
        <ListingActions
          item={listing}
          user={user}
          busy={busy}
          onAction={onAction}
          onMessage={onMessage}
        />
      )}
      <Copy weight="bold">{item.comments?.length || 0} Comments</Copy>
      <Comments
        comments={item.comments || []}
        busy={busy}
        onSubmit={(text, commentId) =>
          onAction(kind, String(item.id), "comment", { text, commentId })
        }
      />
    </ProductDialog>
  );
}
