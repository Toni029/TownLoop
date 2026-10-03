import { hasUploadedNewsletter } from "./model";
import { useReducedMotion } from "../home/hooks";
import { useState, useEffect } from "react";
import {
  Animated,
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  Download,
  Upload,
  Sparkles,
  Trash2,
  CalendarCheck,
  Pin,
  Plus,
  Edit3,
  Clock,
  MapPin,
  Users,
  Check,
  CalendarPlus,
} from "lucide-react-native";
import type {
  CommunityRsvpEvent,
  NewsletterConfig,
  PinnedHighlight,
} from "../models";
import {
  Action,
  Badge,
  Copy,
  ErrorNotice,
  IconAction,
  s,
  useNewsFonts,
} from "./ui";
export type NewsAction =
  | {
      type:
        | "open"
        | "download"
        | "upload"
        | "analyze"
        | "remove"
        | "addEvent"
        | "pin";
    }
  | { type: "rsvp" | "editEvent" | "deleteEvent"; event: CommunityRsvpEvent }
  | { type: "deleteHighlight"; highlight: PinnedHighlight };
export type FeedProps = {
  events: CommunityRsvpEvent[];
  highlights: PinnedHighlight[];
  newsletter: NewsletterConfig | null;
  loading: boolean;
  error: string;
  retry: () => void;
  manager: boolean;
  busy: boolean;
  onAction: (action: NewsAction) => void;
};
export function NewsFeed({
  events,
  highlights,
  newsletter,
  loading,
  error,
  retry,
  manager,
  busy,
  onAction,
}: FeedProps) {
  const [tab, setTab] = useState<"events" | "highlights">("events");
  const [confirm, setConfirm] = useState(false);
  const [fade] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    fade.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: reduced ? 0 : 200,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [tab, fade, reduced]);
  useNewsFonts();
  const removed = !!newsletter?.isRemoved;
  const available = hasUploadedNewsletter(newsletter);
  const act =
    (
      type:
        | "open"
        | "download"
        | "upload"
        | "analyze"
        | "remove"
        | "addEvent"
        | "pin",
    ) =>
    () =>
      onAction({ type });
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: "#faf8f4" }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 16,
        }}
      >
        <View style={{ gap: 6 }}>
          <View>
            <Copy
              accessibilityRole="header"
              weight="serif"
              style={{ fontSize: 20, lineHeight: 27, color: "#1e293b" }}
            >
              Community Bulletin
            </Copy>
            <Copy style={{ color: "#78716c" }}>
              Announcements, upcoming events, and official gazette
            </Copy>
          </View>
          {manager && (
            <View style={{ alignSelf: "flex-start" }}>
              <View
                style={{
                  backgroundColor: "#d1fae5",
                  borderWidth: 1,
                  borderColor: "#6ee7b7",
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Copy weight="bold" style={{ fontSize: 11, color: "#065f46" }}>
                  Admin / VIP Management Mode
                </Copy>
              </View>
            </View>
          )}
        </View>
        <LinearGradient
          colors={["#0f172a", "#1e293b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 30,
            padding: 20,
            gap: 12,
            overflow: "hidden",
            boxShadow: "0px 4px 6px rgba(0,0,0,0.12)",
          }}
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#10b9814d",
                  backgroundColor: "#022c22b3",
                }}
              >
                <Copy
                  weight="extra"
                  style={{ color: "#34d399", fontSize: 11, letterSpacing: 1 }}
                >
                  OFFICIAL PUBLICATION
                </Copy>
              </View>
              {available && <Badge tone="sky">Custom Upload</Badge>}
            </View>
            <Copy style={{ fontSize: 11, color: "#94a3b8" }}>
              {available ? newsletter?.monthEdition : "The Breeze"}
            </Copy>
          </View>
          <Copy
            weight="serif"
            style={{
              fontSize: 20,
              lineHeight: 27,
              color: removed ? "#fda4af" : "white",
            }}
          >
            {removed
              ? "Newsletter Currently Removed"
              : available
                ? newsletter?.editionTitle || "Community Newsletter"
                : "No Newsletter Uploaded"}
          </Copy>
          <Copy style={{ color: "#cbd5e1" }}>
            {removed
              ? "The publication was removed. Admins and VIP residents can upload a new edition (.pdf or document) to share with the community."
              : available
                ? newsletter?.description || "Community newsletter"
                : "The monthly newsletter will appear here when it is uploaded."}
          </Copy>
          <View style={s.row}>
            {available && (
              <>
                <Action
                  label="Open PDF"
                  icon={BookOpen}
                  onPress={act("open")}
                  disabled={loading || busy || !newsletter}
                />
                <Action
                  label="Download Edition"
                  icon={Download}
                  tone="glass"
                  onPress={act("download")}
                  disabled={loading || busy || !newsletter}
                />
              </>
            )}
            {manager && (
              <>
                <Action
                  label={
                    removed
                      ? "Upload PDF"
                      : available
                        ? "Replace PDF"
                        : "Upload New PDF"
                  }
                  icon={Upload}
                  tone="sky"
                  onPress={act("upload")}
                  disabled={busy}
                />
                {available && (
                  <View style={{ gap: 6 }}>
                    <Action
                      compact
                      label={busy ? "Working…" : "Re-analyze with AI"}
                      icon={Sparkles}
                      tone="amber"
                      onPress={act("analyze")}
                      disabled={busy || !newsletter}
                    />
                    {confirm ? (
                      <View style={s.row}>
                        <Action
                          compact
                          label="Confirm Remove PDF"
                          tone="rose"
                          icon={Trash2}
                          onPress={() => {
                            setConfirm(false);
                            onAction({ type: "remove" });
                          }}
                          disabled={busy}
                        />
                        <Action
                          compact
                          label="Cancel"
                          tone="dark"
                          onPress={() => setConfirm(false)}
                        />
                      </View>
                    ) : (
                      <Action
                        compact
                        label="Remove PDF"
                        tone="rose"
                        icon={Trash2}
                        onPress={() => setConfirm(true)}
                        disabled={busy || !newsletter}
                      />
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </LinearGradient>
        {!!(error) && <ErrorNotice message={error} retry={retry} />}
        {loading && (
          <ActivityIndicator
            accessibilityLabel="Loading community news"
            color="#047857"
          />
        )}
        <LinearGradient
          colors={["#ecfdf5", "#f2f7f4", "#f0fdfa"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            s.row,
            {
              padding: 8,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#a7f3d0",
              alignItems: "stretch",
              flexWrap: "nowrap",
            },
          ]}
        >
          {(["events", "highlights"] as const).map((key) => {
            const selected = key === tab;
            const Icon = key === "events" ? CalendarCheck : Pin;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(key)}
                style={{
                  flex: 1,
                  minHeight: 78,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: selected ? "#047857" : "transparent",
                }}
              >
                <View style={s.row}>
                  <Icon size={18} color={selected ? "#fff" : "#064e3b"} />
                  <View
                    style={{
                      backgroundColor: selected ? "#065f46" : "#d1fae5",
                      borderRadius: 20,
                      paddingHorizontal: 6,
                    }}
                  >
                    <Copy
                      weight="bold"
                      style={{
                        fontSize: 10,
                        color: selected ? "#d1fae5" : "#065f46",
                      }}
                    >
                      {key === "events" ? events.length : highlights.length}
                    </Copy>
                  </View>
                </View>
                <Copy
                  weight="extra"
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    textAlign: "center",
                    color: selected ? "#fff" : "#064e3b",
                  }}
                >
                  {key === "events"
                    ? "RSVP Upcoming Events"
                    : "Pinned Highlights"}
                </Copy>
              </Pressable>
            );
          })}
        </LinearGradient>
        <Animated.View style={{ gap: 12, opacity: fade }}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View style={s.row}>
              {tab === "events" ? (
                <CalendarCheck size={16} color="#047857" />
              ) : (
                <Pin size={16} color="#d97706" />
              )}
              <Copy weight="extra" style={{ fontSize: 14 }}>
                {tab === "events"
                  ? "Upcoming Events & RSVP"
                  : "Pinned Highlights"}
              </Copy>
            </View>
            <View style={s.row}>
              {tab === "highlights" && (
                <Badge tone="amber">Priority Notices</Badge>
              )}
              {manager && (
                <Action
                  compact
                  label={tab === "events" ? "Add Event" : "Pin Notice"}
                  icon={Plus}
                  tone={tab === "events" ? "green" : "amber"}
                  onPress={act(tab === "events" ? "addEvent" : "pin")}
                  disabled={busy}
                />
              )}
            </View>
          </View>
          {!loading &&
            !error &&
            (tab === "events" ? events.length : highlights.length) === 0 && (
              <View
                style={[s.card, { alignItems: "center", paddingVertical: 30 }]}
              >
                {tab === "events" ? (
                  <CalendarCheck size={32} color="#a8a29e" />
                ) : (
                  <Pin size={28} color="#a8a29e" />
                )}
                <Copy weight="bold">
                  {tab === "events"
                    ? "No upcoming RSVP events scheduled."
                    : "No pinned highlights at this time."}
                </Copy>
                {manager && tab === "events" && (
                  <Action
                    label="Create First Event"
                    icon={Plus}
                    onPress={act("addEvent")}
                  />
                )}
              </View>
            )}
          {tab === "events"
            ? events.map((event) => (
                <View key={String(event.id)} style={s.card}>
                  {manager && (
                    <View
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                        zIndex: 1,
                        flexDirection: "row",
                      }}
                    >
                      <IconAction
                        label={`Edit event "${event.title}"`}
                        icon={Edit3}
                        disabled={busy}
                        onPress={() => onAction({ type: "editEvent", event })}
                      />
                      <IconAction
                        label={`Delete event "${event.title}"`}
                        icon={Trash2}
                        disabled={busy}
                        onPress={() => onAction({ type: "deleteEvent", event })}
                      />
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      paddingRight: 64,
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: "#f5f5f4",
                        borderWidth: 1,
                        borderColor: "#e7e5e4",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Copy
                        weight="extra"
                        style={{
                          fontSize: 10,
                          color: "#065f46",
                          letterSpacing: 1,
                        }}
                      >
                        {event.month}
                      </Copy>
                      <Copy
                        weight="extra"
                        style={{ fontSize: 18, lineHeight: 22 }}
                      >
                        {event.day}
                      </Copy>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                      <View style={s.row}>
                        <Badge>{event.category}</Badge>
                        {!!(event.deadline) && (
                          <Badge tone="amber">{event.deadline}</Badge>
                        )}
                        {event.userRsvp && <Badge>✓ You&apos;re Going</Badge>}
                      </View>
                      <Copy
                        weight="bold"
                        style={{ fontSize: 14, lineHeight: 20 }}
                      >
                        {event.title}
                      </Copy>
                      <Copy style={{ color: "#57534e" }}>
                        {event.description}
                      </Copy>
                      <View
                        style={[
                          s.row,
                          { marginTop: 5, columnGap: 12, rowGap: 4 },
                        ]}
                      >
                        <View style={[s.row, { gap: 4, flexWrap: "nowrap" }]}>
                          <Clock size={12} color="#a8a29e" />
                          <Copy style={{ color: "#78716c", fontSize: 11 }}>
                            {event.time}
                          </Copy>
                        </View>
                        <View
                          style={[
                            s.row,
                            { gap: 4, flexWrap: "nowrap", flexShrink: 1 },
                          ]}
                        >
                          <MapPin size={12} color="#a8a29e" />
                          <Copy
                            style={{
                              color: "#78716c",
                              fontSize: 11,
                              flexShrink: 1,
                            }}
                          >
                            {event.location}
                          </Copy>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      s.row,
                      {
                        borderTopWidth: 1,
                        borderColor: "#f5f5f4",
                        paddingTop: 10,
                        justifyContent: "space-between",
                      },
                    ]}
                  >
                    <View style={s.row}>
                      <Users size={14} color="#a8a29e" />
                      <Copy style={{ color: "#78716c" }}>
                        <Copy weight="bold">{event.attendeesCount}</Copy>{" "}
                        neighbors attending
                      </Copy>
                      {typeof event.spotsLeft === "number" && (
                        <Badge tone="amber">
                          ({event.spotsLeft} spots left)
                        </Badge>
                      )}
                    </View>
                    <Action
                      compact
                      label={event.userRsvp ? "RSVP'd ✓" : "RSVP"}
                      icon={event.userRsvp ? Check : CalendarPlus}
                      tone={event.userRsvp ? "light" : "green"}
                      disabled={busy}
                      onPress={() => onAction({ type: "rsvp", event })}
                    />
                  </View>
                </View>
              ))
            : highlights.map((h) => (
                <LinearGradient
                  key={h.id}
                  colors={["#fffbeb", "#fffdf9", "#fffbeb80"]}
                  style={[s.card, { borderColor: "#fde68a", gap: 6 }]}
                >
                  {manager && (
                    <View
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                        zIndex: 1,
                      }}
                    >
                      <IconAction
                        label={`Unpin highlight "${h.title}"`}
                        icon={Trash2}
                        onPress={() =>
                          onAction({ type: "deleteHighlight", highlight: h })
                        }
                        disabled={busy}
                      />
                    </View>
                  )}
                  <View
                    style={[
                      s.row,
                      {
                        paddingRight: manager ? 32 : 0,
                        justifyContent: "space-between",
                      },
                    ]}
                  >
                    <Badge tone="amber">{h.category}</Badge>
                    <Copy style={{ fontSize: 10, color: "#78716c" }}>
                      {h.authorLabel}
                    </Copy>
                  </View>
                  <Copy
                    weight="bold"
                    style={{ fontSize: 14, paddingRight: manager ? 32 : 0 }}
                  >
                    {h.title}
                  </Copy>
                  <Copy style={{ color: "#57534e" }}>
                    {h.description || h.summary}
                  </Copy>
                </LinearGradient>
              ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
