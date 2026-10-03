import { usePresentation } from "../shell/TownLoopShell";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Plus,
  Wrench,
  ChevronDown,
  Languages,
  Trash2,
  Camera,
  CheckCircle2,
  RotateCcw,
} from "lucide-react-native";
import type { UserProfile } from "../../../src/types";
import {
  canCreateWorkOrder,
  canViewWorkOrder,
  canViewAllWorkOrders,
  canDeleteWorkOrder,
  isWorkOrderCreator,
  isCrew,
  isAdmin,
  isVip,
} from "../../../src/utils/permissions";
import {
  Action,
  Copy,
  Field,
  ErrorNotice,
  useNewsStyles,
  useNewsFonts,
} from "../news/ui";
import { Collapsible } from "../components/Collapsible";
import { MediaViewer } from "../components/MediaViewer";
import { pickAndUpload } from "../components/media";
import { queueState, type WorkOrder } from "./model";
import { translateWorkOrderSync } from "./translator";
import { Ticket } from "./Ticket";
export type OrderAction = "delete" | "reopen" | "complete" | "note";
export function WorkOrdersFeed({
  orders,
  user,
  loading,
  error,
  retry,
  busy,
  onCreate,
  onAction,
}: {
  orders: WorkOrder[];
  user: UserProfile | null;
  loading: boolean;
  error: string;
  retry: () => void;
  busy: boolean;
  onCreate: () => void;
  onAction: (
    id: string,
    action: OrderAction,
    text?: string,
    photo?: string,
  ) => Promise<boolean>;
}) {
  const dark = !!usePresentation()?.dark;
  const s = useNewsStyles();
  useNewsFonts();
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = orders.filter((o) => canViewWorkOrder(o, user));
  const all = canViewAllWorkOrders(user);
  const mode = isCrew(user)
    ? "Crew Maintenance Mode"
    : isAdmin(user)
      ? "Admin Queue Oversight"
      : isVip(user)
        ? "VIP Access"
        : "My Requests";
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: "transparent" }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 16,
          gap: 16,
          paddingBottom: 128,
        }}
      >
        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Copy
              accessibilityRole="header"
              weight="serif"
              style={{ fontSize: 20, lineHeight: 27 }}
            >
              Work Orders
            </Copy>
            <View
              style={{
                backgroundColor: isCrew(user)
                  ? dark
                    ? "#172554cc"
                    : "#dbeafe"
                  : isAdmin(user)
                    ? dark
                      ? "#451a03cc"
                      : "#fef3c7"
                    : isVip(user)
                      ? dark
                        ? "#3b0764cc"
                        : "#f3e8ff"
                      : dark
                        ? "#022c22cc"
                        : "#d1fae5",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: isCrew(user)
                  ? "#93c5fd"
                  : isAdmin(user)
                    ? "#fcd34d"
                    : isVip(user)
                      ? "#d8b4fe"
                      : "#6ee7b7",
                borderRadius: 20,
              }}
            >
              <Copy
                weight="extra"
                style={{
                  fontSize: 10,
                  lineHeight: 15,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: isCrew(user)
                    ? dark
                      ? "#bfdbfe"
                      : "#1e3a8a"
                    : isAdmin(user)
                      ? dark
                        ? "#fde68a"
                        : "#78350f"
                      : isVip(user)
                        ? dark
                          ? "#e9d5ff"
                          : "#581c87"
                        : dark
                          ? "#a7f3d0"
                          : "#065f46",
                }}
              >
                {mode}
              </Copy>
            </View>
          </View>
          <Copy style={{ color: "#64748b", lineHeight: 16 }}>
            {all
              ? "All community maintenance tickets"
              : "Your maintenance requests"}{" "}
            ({visible.length}) • Live tracking & photo verification
          </Copy>
        </View>
        {canCreateWorkOrder(user) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit New Maintenance Request"
            disabled={busy}
            onPress={onCreate}
          >
            <LinearGradient
              colors={["#047857", "#065f46", "#115e59"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                s.row,
                {
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#05966966",
                  boxShadow: "0px 4px 6px rgba(0,0,0,0.12)",
                  gap: 12,
                  flexWrap: "nowrap",
                },
              ]}
            >
              <View
                style={{
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: "#ffffff33",
                }}
              >
                <Plus size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Copy
                  numberOfLines={1}
                  weight="bold"
                  style={{ fontSize: 14, lineHeight: 20, color: "#fff" }}
                >
                  Submit New Maintenance Request
                </Copy>
                <Copy
                  numberOfLines={1}
                  style={{
                    color: "#d1fae5",
                    fontSize: 11,
                    lineHeight: 16.5,
                  }}
                >
                  Plumbing, electrical, appliance repair & general maintenance
                </Copy>
              </View>
            </LinearGradient>
          </Pressable>
        )}
        {loading && (
          <ActivityIndicator
            accessibilityLabel="Loading work orders"
            color="#047857"
          />
        )}
        {!!error && <ErrorNotice message={error} retry={retry} />}
        {!loading && !error && !visible.length && (
          <View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
            <Wrench size={24} color="#059669" />
            <Copy weight="bold">
              {all
                ? "No work orders in queue"
                : "You have no active work orders"}
            </Copy>
            <Copy style={{ textAlign: "center", color: "#64748b" }}>
              {all
                ? "All maintenance tickets have been resolved or deleted."
                : 'As a resident, you only see the requests you create. Tap "New Request" above to submit a maintenance issue.'}
            </Copy>
          </View>
        )}
        {visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            all={orders}
            user={user}
            expanded={expanded === String(order.id)}
            toggle={() =>
              setExpanded((v) =>
                v === String(order.id) ? null : String(order.id),
              )
            }
            busy={busy}
            onAction={onAction}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
function OrderCard({
  order,
  all,
  user,
  expanded,
  toggle,
  busy,
  onAction,
}: {
  order: WorkOrder;
  all: WorkOrder[];
  user: UserProfile | null;
  expanded: boolean;
  toggle: () => void;
  busy: boolean;
  onAction: (
    id: string,
    action: OrderAction,
    text?: string,
    photo?: string,
  ) => Promise<boolean>;
}) {
  const dark = !!usePresentation()?.dark;
  const s = useNewsStyles();
  const q = queueState(order, all);
  const [spanish, setSpanish] = useState(false);
  const translated = spanish ? translateWorkOrderSync(order) : null;
  const [confirm, setConfirm] = useState(false);
  const [reply, setReply] = useState("");
  const [photo, setPhoto] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<{ urls: string[]; index: number } | null>(
    null,
  );
  const lock = useRef(false);
  async function upload(camera = false) {
    if (lock.current || busy) return;
    lock.current = true;
    setUploading(true);
    setError("");
    try {
      const photos = await pickAndUpload("work_orders", setProgress, camera);
      if (photos[0]) setPhoto(photos[0].url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload photo.");
    } finally {
      lock.current = false;
      setUploading(false);
    }
  }
  async function act(action: OrderAction, text = "", proof = "") {
    if (lock.current || busy) return;
    lock.current = true;
    try {
      if (await onAction(String(order.id), action, text, proof)) {
        setReply("");
        setNote("");
        setPhoto("");
        setConfirm(false);
      }
    } finally {
      lock.current = false;
    }
  }
  const verified = order.comments?.some((c) => c.photoUrl && c.text.trim());
  const disabled = busy || uploading;
  return (
    <View
      style={[
        s.card,
        {
          padding: expanded ? 14 : 12,
          borderWidth: q.inProgress ? 2 : 1,
          borderColor:
            expanded || q.inProgress
              ? "#10b981"
              : q.done
                ? dark
                  ? "#1e293b"
                  : "#d6d3d1"
                : dark
                  ? "#1e293b"
                  : "#e7e5e4",
          backgroundColor: dark ? "#0f172ae6" : q.done ? "#f5f5f4" : "#fff",
          boxShadow: expanded
            ? "0px 4px 6px rgba(0,0,0,0.1)"
            : "0px 1px 2px rgba(0,0,0,0.04)",
          opacity: q.done ? 0.65 : 1,
          gap: 0,
        },
      ]}
    >
      <View style={[s.row, { flexWrap: "nowrap", gap: 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${order.code}: ${order.title}`}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={[
            s.row,
            { flex: 1, flexWrap: "nowrap", minHeight: 40, gap: 6 },
          ]}
        >
          <Ticket code={order.code} done={q.done} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Copy
              accessibilityLabel={order.category}
              numberOfLines={1}
              weight="bold"
              style={{
                fontSize: 10,
                lineHeight: 15,
                color: dark
                  ? q.done
                    ? "#94a3b8"
                    : "#6ee7b7"
                  : q.done
                    ? "#78716c"
                    : "#065f46",
                backgroundColor: dark
                  ? q.done
                    ? "#1e293b"
                    : "#022c2280"
                  : q.done
                    ? "#e7e5e4"
                    : "#ecfdf5",
                borderRadius: 20,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: dark
                  ? q.done
                    ? "#334155"
                    : "#065f46"
                  : q.done
                    ? "#d6d3d1"
                    : "#a7f3d0",
                alignSelf: "flex-start",
              }}
            >
              {order.categoryEmoji} {order.category}
            </Copy>
            <Copy
              numberOfLines={expanded ? undefined : 1}
              weight="bold"
              style={{
                fontSize: 14,
                lineHeight: 19.25,
                color:
                  expanded && !q.done
                    ? dark
                      ? "#34d399"
                      : "#047857"
                    : undefined,
                textDecorationLine: q.done ? "line-through" : "none",
              }}
            >
              {translated?.title || order.title}
            </Copy>
          </View>
        </Pressable>
        {!expanded && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              spanish ? "Show original English" : "Translate to Spanish"
            }
            onPress={() => setSpanish((v) => !v)}
            hitSlop={10}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: dark ? "#1e293b" : "#e7e5e4",
              backgroundColor: dark ? "#1e293be6" : "#f5f5f4e6",
            }}
          >
            {spanish ? (
              <Copy weight="extra">ES</Copy>
            ) : (
              <Languages size={14} color="#78716c" />
            )}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse" : "Expand work order details"
          }
          accessibilityState={{ expanded }}
          onPress={toggle}
          hitSlop={6}
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: expanded
              ? "#10b981"
              : q.done
                ? dark
                  ? "#334155"
                  : "#d6d3d1"
                : dark
                  ? "#1e293b"
                  : "#e7e5e4",
            backgroundColor: expanded
              ? "#059669"
              : q.done
                ? dark
                  ? "#1e293bcc"
                  : "#e7e5e4cc"
                : dark
                  ? "#1e293be6"
                  : "#f5f5f4e6",
            transform: [{ rotate: expanded ? "180deg" : "0deg" }],
          }}
        >
          <ChevronDown
            strokeWidth={2.5}
            size={20}
            color={expanded ? "white" : dark ? "#cbd5e1" : "#44403c"}
          />
        </Pressable>
      </View>
      <Collapsible open={expanded}>
        <View
          style={[
            s.row,
            {
              borderTopWidth: 1,
              borderColor: dark ? "#1e293b" : "#e7e5e4",
              paddingTop: 10,
            },
          ]}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: q.done
                ? dark
                  ? "#334155"
                  : "#d6d3d1"
                : q.inProgress
                  ? "#10b981"
                  : dark
                    ? "#92400e"
                    : "#fcd34d",
              backgroundColor: q.done
                ? dark
                  ? "#1e293b"
                  : "#e7e5e4"
                : q.inProgress
                  ? "#047857"
                  : dark
                    ? "#451a0399"
                    : "#fef3c7",
            }}
          >
            <Copy
              weight="bold"
              style={{
                color: q.inProgress
                  ? "#fff"
                  : q.done
                    ? dark
                      ? "#94a3b8"
                      : "#57534e"
                    : dark
                      ? "#fcd34d"
                      : "#92400e",
                lineHeight: 16,
              }}
            >
              {q.done
                ? "✓ Completed (Done)"
                : q.inProgress
                  ? "In Progress"
                  : `Queued #${q.place}`}
            </Copy>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              spanish ? "Show original English" : "Translate to Spanish"
            }
            onPress={() => setSpanish((v) => !v)}
            hitSlop={8}
            style={[
              s.row,
              {
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 99,
                borderWidth: 1,
                borderColor: dark ? "#1e40af" : "#bfdbfe",
                backgroundColor: dark ? "#17255499" : "#eff6ff",
              },
            ]}
          >
            <Languages size={14} color={dark ? "#93c5fd" : "#2563eb"} />
            <Copy
              weight="bold"
              style={{ lineHeight: 16, color: dark ? "#93c5fd" : "#1d4ed8" }}
            >
              {spanish ? "English" : "Translate"}
            </Copy>
          </Pressable>
          {canDeleteWorkOrder(order, user) &&
            (confirm ? (
              <View style={s.row}>
                <Copy>Delete?</Copy>
                <Action
                  label="Yes"
                  tone="rose"
                  disabled={disabled}
                  onPress={() => void act("delete")}
                />
                <Action
                  label="Cancel"
                  tone="light"
                  onPress={() => setConfirm(false)}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete work order"
                disabled={disabled}
                onPress={() => setConfirm(true)}
                hitSlop={8}
                style={{
                  padding: 8,
                  width: 32,
                  height: 32,
                  marginLeft: "auto",
                }}
              >
                <Trash2 size={16} color="#a8a29e" />
              </Pressable>
            ))}
        </View>
        {!!order.description && (
          <View
            style={[
              s.card,
              { backgroundColor: dark ? "#1e293bb3" : "#fafaf9", padding: 12 },
            ]}
          >
            <Copy style={{ fontSize: 14, lineHeight: 22 }}>
              {translated?.description || order.description}
            </Copy>
          </View>
        )}
        {!!order.photos?.length && (
          <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
            {order.photos.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Open work order photo ${index + 1}`}
                onPress={() => setMedia({ urls: order.photos!, index })}
              >
                <Image
                  source={{ uri }}
                  style={{ width: 96, height: 96, borderRadius: 16 }}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Copy weight="bold" style={{ fontSize: 12, lineHeight: 18 }}>
          📍 {order.unit} •{" "}
          <Copy>
            Requested by{" "}
            {isWorkOrderCreator(order, user)
              ? "You"
              : order.userName || "Resident"}
          </Copy>
        </Copy>
        <Copy style={{ color: "#78716c", fontSize: 11, lineHeight: 16.5 }}>
          {order.statusNote} • {order.timeAgo}
          {order.completedAt
            ? ` • ${new Date(order.completedAt).toLocaleString()}`
            : ""}
        </Copy>
        {!!order.comments?.length && (
          <View
            style={{
              gap: 10,
              borderTopWidth: 1,
              borderColor: dark ? "#1e293b" : "#e7e5e4",
              paddingTop: 12,
            }}
          >
            <Copy weight="bold" style={{ fontSize: 10, color: "#78716c" }}>
              Crew Updates & Replies ({order.comments.length})
            </Copy>
            {order.comments.map((c) => (
              <View
                key={c.id}
                style={[
                  s.card,
                  { backgroundColor: dark ? "#17255480" : "#eff6ff" },
                ]}
              >
                <Copy weight="bold">
                  {c.author} • {c.role} <Copy>{c.timestamp}</Copy>
                </Copy>
                <Copy>{translated?.comments[c.id] || c.text}</Copy>
                {!!c.photoUrl && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open resolution photo"
                    onPress={() => setMedia({ urls: [c.photoUrl!], index: 0 })}
                  >
                    <Image
                      source={{ uri: c.photoUrl }}
                      style={{ width: 110, height: 110, borderRadius: 12 }}
                    />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {isCrew(user) && (
          <View
            style={{
              gap: 12,
              borderTopWidth: 2,
              borderStyle: "dotted",
              borderColor: "#d6d3d1",
              paddingTop: 14,
            }}
          >
            <Copy weight="extra" style={{ color: "#1e3a8a" }}>
              🛠 Crew Comments
            </Copy>
            {q.done ? (
              <View style={s.row}>
                <Copy weight="bold">✓ Marked as Done</Copy>
                <Action
                  label="Reopen"
                  icon={RotateCcw}
                  tone="light"
                  disabled={disabled}
                  onPress={() => void act("reopen")}
                />
              </View>
            ) : (
              <>
                {verified && (
                  <Action
                    label="Mark as Done (Photo Verified ✓)"
                    icon={CheckCircle2}
                    disabled={disabled}
                    onPress={() => void act("complete")}
                  />
                )}
                <View style={[s.card, { backgroundColor: "#fafaf9" }]}>
                  <Copy weight="bold">
                    Reply with a picture before marking as done
                  </Copy>
                  <Field
                    label="Resolution Note / Description *"
                    value={reply}
                    onChangeText={setReply}
                    multiline
                    editable={!disabled}
                    placeholder="e.g. Replaced faulty washer, pressure tested at 45 PSI, tested lines."
                  />
                  <Action
                    label="Upload Verification Picture"
                    icon={Camera}
                    tone="light"
                    disabled={disabled}
                    onPress={() => void upload()}
                  />
                  <Action
                    label="Take Verification Picture"
                    icon={Camera}
                    tone="light"
                    disabled={disabled}
                    onPress={() => void upload(true)}
                  />
                  {uploading && <Copy>Uploading photo… {progress}%</Copy>}
                  {!!photo && (
                    <Image
                      source={{ uri: photo }}
                      style={{ width: 100, height: 100, borderRadius: 12 }}
                    />
                  )}
                  {!!error && <ErrorNotice message={error} />}
                  <Action
                    label="Submit Reply & Mark as Done"
                    icon={CheckCircle2}
                    disabled={disabled}
                    onPress={() => void act("complete", reply, photo)}
                  />
                </View>
                <Field
                  label="General maintenance note"
                  value={note}
                  onChangeText={setNote}
                  editable={!disabled}
                  placeholder="Add general maintenance note…"
                />
                <Action
                  label="Log Note"
                  disabled={disabled || !note.trim()}
                  onPress={() => void act("note", note)}
                />
              </>
            )}
          </View>
        )}
      </Collapsible>
      {media && (
        <MediaViewer
          media={media.urls.map((url) => ({ type: "image", url }))}
          initialIndex={media.index}
          title={`${order.code}: ${order.title}`}
          onClose={() => setMedia(null)}
        />
      )}
    </View>
  );
}
