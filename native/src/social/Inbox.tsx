import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { ChevronLeft, Trash2, Send } from "lucide-react-native";
import type { UserProfile } from "../../../src/types";
import { Action, Copy, Field, ErrorNotice, s } from "../news/ui";
import { ProductDialog } from "../components/ProductDialog";
import { Avatar } from "./SocialFeed";
import { newSocialId } from "./actions";
import { chatSide, hasLeft, type Chat, type Listing } from "./model";
export function MessageSeller({
  error = "",
  item,
  user,
  busy,
  onClose,
  onSend,
}: {
  error?: string;
  item: Listing;
  user: UserProfile | null;
  busy: boolean;
  onClose: () => void;
  onSend: (
    text: string,
    includeContact: boolean,
    messageId: string,
  ) => Promise<boolean>;
}) {
  const [text, setText] = useState(
    `Hi ${item.author.split(" ")[0] || "Neighbor"}, I saw your listing for "${item.title}" and would love to arrange porch pickup! Is it still available?`,
  );
  const [contact, setContact] = useState(true);
  const [messageId] = useState(newSocialId);
  const lock = useRef(false);
  async function send() {
    if (lock.current || busy) return;
    lock.current = true;
    try {
      await onSend(text, contact, messageId);
    } finally {
      lock.current = false;
    }
  }
  return (
    <ProductDialog
      title="Message Seller"
      subtitle={item.title}
      busy={busy}
      onClose={onClose}
    >
      <View style={s.row}>
        <Avatar uri={item.authorAvatar} name={item.author} />
        <Copy weight="bold">
          {item.author} • {item.unit}
        </Copy>
      </View>
      <Copy>{item.price} • Porch pickup</Copy>
      {error && <ErrorNotice message={error} />}
      <Field
        label="Your Message"
        value={text}
        onChangeText={setText}
        editable={!busy}
        multiline
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: contact }}
        onPress={() => setContact((v) => !v)}
        disabled={busy}
        style={[s.row, { minHeight: 48 }]}
      >
        <Copy>{contact ? "☑" : "☐"} Include my contact information</Copy>
      </Pressable>
      {contact && (
        <Copy style={{ color: "#78716c" }}>
          {[user?.name, user?.address || user?.wing, user?.phone]
            .filter(Boolean)
            .join(" • ")}
        </Copy>
      )}
      <Action
        label="Send Message"
        icon={Send}
        disabled={busy || !text.trim()}
        onPress={() => void send()}
      />
    </ProductDialog>
  );
}
export function Inbox({
  loading = false,
  retry,
  error = "",
  chats,
  user,
  activeId,
  setActiveId,
  busy,
  onClose,
  onRead,
  onReply,
  onLeave,
  onViewItem,
}: {
  error?: string;
  loading?: boolean;
  retry?: () => void;
  chats: Chat[];
  user: UserProfile | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  busy: boolean;
  onClose: () => void;
  onRead: (id: string) => Promise<boolean>;
  onReply: (id: string, text: string, messageId: string) => Promise<boolean>;
  onLeave: (id: string) => Promise<boolean>;
  onViewItem: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(() => ({
    chatId: activeId,
    text: "",
    messageId: newSocialId(),
  }));
  const text = draft.chatId === activeId ? draft.text : "";
  const setText = (value: string) =>
    setDraft((current) => ({
      chatId: activeId,
      text: value,
      messageId:
        current.chatId === activeId && value
          ? current.messageId
          : newSocialId(),
    }));
  const [confirm, setConfirm] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const lock = useRef(false);
  const selected = chats.find((c) => c.id === activeId);
  const side = selected ? chatSide(selected, String(user?.id)) : null;
  const unread =
    selected &&
    (side === "seller" ? selected.unreadForSeller : selected.unreadForBuyer);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId && unread) void onRead(selectedId);
  }, [selectedId, unread, onRead]);
  const other = selected
    ? side === "seller"
      ? selected.buyerName
      : selected.sellerName
    : "";
  const closed =
    selected && hasLeft(selected, side === "seller" ? "buyer" : "seller");
  async function reply() {
    if (lock.current || busy || !selected || !text.trim()) return;
    lock.current = true;
    try {
      if (await onReply(selected.id, text, draft.messageId)) setText("");
    } finally {
      lock.current = false;
    }
  }
  const filtered = chats.filter((c) =>
    [c.itemTitle, c.sellerName, c.buyerName, c.lastMessage]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <ProductDialog
      title={selected ? other : "Marketplace Inbox"}
      subtitle={
        selected
          ? `${side === "seller" ? "Buyer" : "Seller"} • ${selected.itemTitle}`
          : "Buyer & seller conversations"
      }
      onClose={onClose}
      busy={busy}
      initiallyFull
    >
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Loading marketplace conversations"
          color="#047857"
        />
      )}
      {error && <ErrorNotice message={error} retry={retry} />}
      {selected ? (
        <>
          <Action
            label="Inbox"
            icon={ChevronLeft}
            tone="light"
            onPress={() => {
              setActiveId(null);
              setText("");
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View listing ${selected.itemTitle}`}
            onPress={() => onViewItem(selected.itemId)}
            style={[s.card, { backgroundColor: "#f5f5f4" }]}
          >
            <Copy weight="bold">
              {selected.itemTitle} • {selected.itemPrice}
            </Copy>
            <Copy>View Listing</Copy>
          </Pressable>
          {closed && (
            <View style={s.card}>
              <Copy weight="bold">{other} has left this chat</Copy>
              <Copy>
                You can keep this for reference or tap Delete to remove it
                permanently.
              </Copy>
            </View>
          )}
          <ScrollView
            ref={scroll}
            nestedScrollEnabled
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ gap: 10 }}
            onContentSizeChange={() =>
              scroll.current?.scrollToEnd({ animated: true })
            }
          >
            {selected.messages.map((m) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.isSystem
                    ? "center"
                    : String(m.senderId) === String(user?.id)
                      ? "flex-end"
                      : "flex-start",
                  maxWidth: "95%",
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: m.isSystem
                    ? "#f5f5f4"
                    : String(m.senderId) === String(user?.id)
                      ? "#d1fae5"
                      : "#f5f5f4",
                  gap: 4,
                }}
              >
                <Copy weight="bold" style={{ fontSize: 10 }}>
                  {m.senderName}
                </Copy>
                <Copy style={{ fontSize: 14, lineHeight: 22 }}>{m.text}</Copy>
                <Copy style={{ fontSize: 10, color: "#78716c" }}>
                  {m.timestamp}
                </Copy>
              </View>
            ))}
          </ScrollView>
          {!!selected.messages.length &&
            String(selected.messages.at(-1)?.senderId) === String(user?.id) && (
              <Copy style={{ color: "#047857", fontSize: 11 }}>
                {(
                  side === "seller"
                    ? selected.unreadForBuyer
                    : selected.unreadForSeller
                )
                  ? `✓ Delivered • Unread by ${other}`
                  : `✓✓ Seen by ${other}`}
              </Copy>
            )}
          {!closed && (
            <>
              <Field
                label="Reply"
                value={text}
                onChangeText={setText}
                multiline
                editable={!busy}
                placeholder="Write a message…"
              />
              <Action
                label="Send Reply"
                icon={Send}
                disabled={busy || !text.trim()}
                onPress={() => void reply()}
              />
            </>
          )}
          {confirm === selected.id ? (
            <View style={s.row}>
              <Copy>Delete chat?</Copy>
              <Action
                label="Yes"
                tone="rose"
                disabled={busy}
                onPress={() =>
                  void onLeave(selected.id).then((ok) => {
                    if (ok) {
                      setActiveId(null);
                      setConfirm(null);
                    }
                  })
                }
              />
              <Action
                label="Cancel"
                tone="light"
                onPress={() => setConfirm(null)}
              />
            </View>
          ) : (
            <Action
              label="Delete Conversation"
              icon={Trash2}
              tone="light"
              disabled={busy}
              onPress={() => setConfirm(selected.id)}
            />
          )}
        </>
      ) : (
        <>
          <Field
            label="Search conversations"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by neighbor or item…"
          />
          {!loading && !error && !filtered.length && (
            <View style={[s.card, { alignItems: "center", padding: 30 }]}>
              <Copy weight="bold">
                {search
                  ? "No matching chats found"
                  : "No Marketplace Chats Yet"}
              </Copy>
              <Copy style={{ textAlign: "center" }}>
                {
                  'When you tap "Message Seller" on a listing, your buyer & seller conversations sit right here!'
                }
              </Copy>
            </View>
          )}
          {filtered.map((c) => {
            const seller = chatSide(c, String(user?.id)) === "seller";
            const unread = seller ? c.unreadForSeller : c.unreadForBuyer;
            return (
              <View
                key={c.id}
                style={[
                  s.card,
                  { backgroundColor: unread ? "#ecfdf5" : "#fff" },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open conversation ${c.itemTitle}`}
                  onPress={() => {
                    setActiveId(c.id);
                    setText("");
                  }}
                  style={{ gap: 6 }}
                >
                  <View style={s.row}>
                    <Avatar
                      uri={seller ? c.buyerAvatar : c.sellerAvatar}
                      name={seller ? c.buyerName : c.sellerName}
                    />
                    <Copy weight="bold" style={{ flex: 1 }}>
                      {seller ? c.buyerName : c.sellerName}
                    </Copy>
                    {unread && (
                      <Copy weight="bold" style={{ color: "#e11d48" }}>
                        ● Unread
                      </Copy>
                    )}
                  </View>
                  <Copy weight="bold">{c.itemTitle}</Copy>
                  <Copy numberOfLines={2}>{c.lastMessage}</Copy>
                  <Copy style={{ fontSize: 10, color: "#a8a29e" }}>
                    {c.lastMessageTime}
                  </Copy>
                </Pressable>
                {confirm === c.id ? (
                  <View style={s.row}>
                    <Copy>Delete?</Copy>
                    <Action
                      label="Yes"
                      tone="rose"
                      disabled={busy}
                      onPress={() =>
                        void onLeave(c.id).then((ok) => {
                          if (ok) setConfirm(null);
                        })
                      }
                    />
                    <Action
                      label="Cancel"
                      tone="light"
                      onPress={() => setConfirm(null)}
                    />
                  </View>
                ) : (
                  <Action
                    label="Delete conversation from your inbox"
                    icon={Trash2}
                    tone="light"
                    compact
                    disabled={busy}
                    onPress={() => setConfirm(c.id)}
                  />
                )}
              </View>
            );
          })}
        </>
      )}
    </ProductDialog>
  );
}
