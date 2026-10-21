import { ScrollView } from '../keyboard/KeyboardScrollView';
import { adminDirectory, removeAttendeePatch } from "./adminModel";
import { CecilPinesMark } from "../components/CecilPinesMark";
import Animated, { FadeInLeft, FadeInRight, ReduceMotion, runOnJS } from "react-native-reanimated";
import { useRef, useState } from "react";
import {

  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { doc, runTransaction } from "firebase/firestore";
import type { UserProfile, CommunityRsvpEvent } from "../../../src/types";
import {
  getRoleBadgeInfo,
  getUserRole,
  isMasterAdminEmail,
} from "../../../src/utils/permissions";
import { sortEventsEarlyFirst } from "../../../src/utils/eventSort";
import { db } from "../lib/firebase";
import { useLiveCollection } from "../lib/liveCollection";
import { readNewsEvent } from "../news/model";
import { approvedUser, removeNewsItem } from "../news/actions";
import { manageResident, reviewProfileUpdate } from "./data";
const eventDetail = (value: unknown) => {
  const text = String(value ?? "").trim();
  return /not specified/i.test(text) ? "" : text;
};
export function AdminMenu({
  user,
  residents,
  dark,
  onError,
  onNotice,
  onBack,
}: {
  user: UserProfile;
  residents: UserProfile[];
  dark: boolean;
  onError: (s: string) => void;
  onNotice: (s: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState("residents"),
    [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{
      label: string;
      run: () => Promise<unknown>;
    } | null>(null),
    [roles, setRoles] = useState("");
  const tabLock = useRef(false);
  const activeTab = useRef("residents");
  const [tabDirection, setTabDirection] = useState(1);
  function finishTabTransition() { if (activeTab.current === tab) tabLock.current = false; }
  function changeTab(next: string) {
    if (next === tab || tabLock.current || busy) return;
    const order = ['residents', 'rsvp', 'database'];
    tabLock.current = true;
    activeTab.current = next;
    setTabDirection(order.indexOf(next) > order.indexOf(tab) ? 1 : -1);
    setTab(next);
  }
  const [pendingOnly, setPendingOnly] = useState(false);
  const events = useLiveCollection("community_events", readNewsEvent);
  const ink = dark ? "#f1f5f9" : "#1c1917",
    muted = dark ? "#94a3b8" : "#78716c";
  const panel = {
    borderWidth: 1,
    borderColor: dark ? "#475569" : "#d6d3d1",
    backgroundColor: dark ? "#1e293bee" : "#fffffff2",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  } as const;
  const font = (size = 12, bold = false) => ({
    fontFamily: bold ? "JakartaBold" : "Jakarta",
    fontSize: size,
    color: ink,
  });
  const people = adminDirectory(residents);
  const pending = people.filter((p) => p.approved === false).length;
  const sortedEvents = sortEventsEarlyFirst(events.items);
  const totalRsvpCount = events.items.reduce(
    (count, event) =>
      count + (event.attendees?.length || event.attendeesCount || 0),
    0,
  );
  const privileged =
    ["admin", "vip"].includes(getUserRole(user)) ||
    isMasterAdminEmail(user.email);
  async function act(fn: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      await fn();
      onNotice(success);
      setConfirm(null);
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "Unable to update the community.",
      );
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      disabled={busy}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: danger ? "#fecdd3" : dark ? "#475569" : "#d6d3d1",
        backgroundColor: danger ? "#fff1f2" : dark ? "#334155" : "#f5f5f4",
        opacity: pressed || busy ? 0.6 : 1,
        alignItems: "center",
      })}
    >
      <Text style={{ ...font(12, true), color: danger ? "#be123c" : ink }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 14, flex: 1 }}>
      <LinearGradient
        colors={["#78350fe6", "#92400ee6", "#1c1917e6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          padding: 16,
          borderRadius: 0,
          paddingRight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to resident menu"
          onPress={onBack}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: "#ffffff26",
          }}
        >
          <ChevronLeft size={16} color="#fff" />
          <Text
            style={{ fontFamily: "JakartaBold", fontSize: 12, color: "#fff" }}
          >
            Back
          </Text>
        </Pressable>
        <LinearGradient
          colors={["#185d3b", "#145334", "#0c3621"]}
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: "#fbbf24b3",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CecilPinesMark size={28} />
        </LinearGradient>
        <View>
          <Text style={{ ...font(18, true), color: "#fff" }}>Admin Portal</Text>
          <Text style={{ ...font(11), color: "#fde68acc" }}>
            Resident approvals & system directory
          </Text>
        </View>
      </LinearGradient>
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderColor: dark ? "#334155" : "#d6d3d1",
          gap: 4,
        }}
      >
        {[
          ["residents", "Directory", Users],
          ["rsvp", "RSVP Upcoming", CalendarCheck],
          ...(privileged ? [["database", "Database Clean", Trash2]] : []),
        ].map(([id, label, Icon]) => {
          const Glyph = Icon as typeof Users;
          return (
            <Pressable
              key={String(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
              onPress={() => changeTab(String(id))}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderColor:
                  tab === id
                    ? id === "rsvp"
                      ? "#059669"
                      : "#d97706"
                    : "transparent",
                gap: 4,
              }}
            >
              <Glyph size={14} color={tab === id ? "#b45309" : muted} />
              <Text
                numberOfLines={1}
                style={{
                  ...font(11, true),
                  color: tab === id ? (dark ? "#fbbf24" : "#78350f") : muted,
                }}
              >
                {String(label)}
                {id === "rsvp" && totalRsvpCount > 0
                  ? ` (${totalRsvpCount})`
                  : ""}
                {id === "residents" && pending ? ` (${pending})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View
        key={tab}
        entering={(tabDirection > 0 ? FadeInRight : FadeInLeft).duration(190).reduceMotion(ReduceMotion.System)
          // Callback runs after UI-thread animation, not during React render.
          // eslint-disable-next-line react-hooks/refs
          .withCallback(finished => { 'worklet'; if (finished) runOnJS(finishTabTransition)(); })}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 14, padding: 16 }}
        >
          {confirm && (
            <View style={[panel, { borderColor: "#fda4af" }]}>
              <Text style={font(13, true)}>{confirm.label}</Text>
              {button("Confirm", () => void act(confirm.run, "Updated."), true)}
              {button("Cancel", () => setConfirm(null))}
            </View>
          )}
          {busy && <ActivityIndicator color="#059669" />}
          {tab === "residents" && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={font(12, true)}>DIRECTORY ({people.length})</Text>
                {pending > 0 && (
                  <Text style={{ ...font(11, true), color: "#b45309" }}>
                    {pending} pending approval
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {button(`All residents (${people.length})`, () =>
                  setPendingOnly(false),
                )}
                {button(`Pending approvals (${pending})`, () =>
                  setPendingOnly(true),
                )}
              </View>
              <Text style={{ ...font(12), color: muted }}>
                {pendingOnly
                  ? "Showing new signups awaiting approval."
                  : "New signups appear first. Approve them to give them access as residents."}
              </Text>
              {pendingOnly && pending === 0 && (
                <Text style={font(13)}>No signups awaiting approval.</Text>
              )}
              {people.length === 0 && !pendingOnly && (
                <Text style={{ ...font(13), textAlign: "center", padding: 24 }}>
                  No residents in directory.
                </Text>
              )}
              {residents.filter(person => person.profileUpdateRequest?.status === "pending").map(person => {
                const request = person.profileUpdateRequest!;
                const labels: Record<string, string> = {phone:"Resident Phone",address:"Residency Address",dateOfBirth:"Date of Birth",maritalStatus:"Marital Status",emergencyContactName:"Emergency Contact Name",emergencyContactPhone:"Emergency Contact Phone",emergencyContactAddress:"Emergency Contact Address"};
                return <View key={`request-${person.id}`} style={panel}>
                  <Text style={font(14, true)}>Profile update · {person.name}</Text>
                  {Object.entries(request.changes).map(([key, value]) => <View key={key} style={{gap:4}}>
                    <Text style={font(12, true)}>{labels[key] || key}</Text>
                    <Text style={{...font(12), color:muted}}>Current: {request.previous[key] || "Not provided"}</Text>
                    <Text style={font(13)}>Requested: {value || "Remove"}</Text>
                  </View>)}
                  {button("Approve profile update", () => setConfirm({label:`Apply ${person.name}'s requested profile changes?`, run: () => reviewProfileUpdate(String(person.id), request.requestedAt, true)}))}
                  {button("Reject request", () => setConfirm({label:`Reject ${person.name}'s profile update request?`, run: () => reviewProfileUpdate(String(person.id), request.requestedAt, false)}))}
                </View>;
              })}
              {people
                .filter((p) => !pendingOnly || p.approved === false)
                .map((p) => {
                  const badge = getRoleBadgeInfo(getUserRole(p));
                  return (
                    <View key={String(p.id)} style={panel}>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        {p.avatarUrl || p.avatar_url ? (
                          <Image
                            source={{ uri: p.avatarUrl || p.avatar_url }}
                            style={{ width: 44, height: 44, borderRadius: 22 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: "#d1fae5",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Users size={20} color="#047857" />
                          </View>
                        )}
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={font(14, true)}>{p.name}</Text>
                          <Text style={{ ...font(10, true), color: "#b45309" }}>
                            {p.approved === false
                              ? "Pending approval"
                              : badge.label}
                          </Text>
                          <Text style={{ ...font(12), color: muted }}>
                            {p.email}
                          </Text>
                          <Text style={{ ...font(11), color: muted }}>
                            {p.address || p.unit || "Resident Unit"}
                          </Text>
                        </View>
                        {p.approved === false ? (
                          button(
                            "Approve",
                            () =>
                              void act(
                                () =>
                                  manageResident(String(p.id), {
                                    approved: true,
                                    ...(!p.role ? { role: "resident" } : {}),
                                  }),
                                `${p.name} approved.`,
                              ),
                          )
                        ) : (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              alignItems: "center",
                            }}
                          >
                            <CheckCircle2 size={16} color="#059669" />
                            <Text
                              style={{ ...font(12, true), color: "#059669" }}
                            >
                              Approved
                            </Text>
                          </View>
                        )}
                      </View>
                      {String(p.id) !== String(user.id) && (
                        <>
                          {button("Role controls", () =>
                            setRoles(
                              roles === String(p.id) ? "" : String(p.id),
                            ),
                          )}
                          {roles === String(p.id) && (
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 6,
                              }}
                            >
                              {["resident", "crew", "staff", "vip", "admin"]
                                .filter((r) => r !== p.role)
                                .map((role) => (
                                  <View key={role}>
                                    {button(role, () =>
                                      setConfirm({
                                        label: `Change ${p.name} to ${role}? This changes community permissions.`,
                                        run: () =>
                                          manageResident(String(p.id), {
                                            role,
                                          }),
                                      }),
                                    )}
                                  </View>
                                ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
            </>
          )}
          {tab === "rsvp" && (
            <>
              <Text style={font(14, true)}>RSVP Upcoming Events</Text>
              <Text style={{ ...font(11), color: muted }}>
                Roster of residents signed up for community events
              </Text>
              {events.loading && <ActivityIndicator />}
              {!!events.error && (
                <>
                  {
                    <Text style={{ ...font(12), color: "#e11d48" }}>
                      {events.error}
                    </Text>
                  }
                  {button("Retry events", events.retry)}
                </>
              )}
              {!events.loading &&
                !events.error &&
                sortedEvents.length === 0 && (
                  <View style={panel}>
                    <CalendarCheck size={32} color={muted} />
                    <Text style={font(14, true)}>No upcoming RSVP events</Text>
                    <Text style={{ ...font(12), color: muted }}>
                      There are currently no upcoming RSVP events listed in the
                      community.
                    </Text>
                  </View>
                )}
              {sortedEvents.map((e) => (
                <View key={String(e.id)} style={panel}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...font(16, true), lineHeight: 23 }}>
                        {e.title}
                      </Text>
                      <Text style={{ ...font(12), color: muted }}>
                        {[
                          [eventDetail(e.month), eventDetail(e.day)]
                            .filter(Boolean)
                            .join(" "),
                          eventDetail(e.time),
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                      {!!eventDetail(e.location) && (
                        <Text style={{ ...font(11), color: muted }}>
                          {eventDetail(e.location)}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${e.title}`}
                      onPress={() =>
                        setConfirm({
                          label: `Delete entire event “${e.title}”?`,
                          run: () =>
                            removeNewsItem("community_events", String(e.id)),
                        })
                      }
                    >
                      <Trash2 size={16} color="#e11d48" />
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Resident signups for ${e.title}`}
                    accessibilityState={{ expanded: !!expanded[String(e.id)] }}
                    onPress={() =>
                      setExpanded({
                        ...expanded,
                        [String(e.id)]: !expanded[String(e.id)],
                      })
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      minHeight: 48,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: dark ? "#065f46" : "#a7f3d0",
                      backgroundColor: dark ? "#022c22" : "#ecfdf5",
                    }}
                  >
                    <Users size={16} color="#059669" />
                    <Text style={{ ...font(13, true), flex: 1, flexShrink: 1 }}>
                      Resident signups (
                      {e.attendees?.length ?? e.attendeesCount ?? 0})
                    </Text>
                    {expanded[String(e.id)] ? (
                      <ChevronDown size={16} color={ink} />
                    ) : (
                      <ChevronRight size={16} color={ink} />
                    )}
                  </Pressable>
                  {expanded[String(e.id)] && !e.attendees?.length && (
                    <Text style={{ ...font(12), color: muted, padding: 8 }}>
                      No residents have signed up yet.
                    </Text>
                  )}
                  {expanded[String(e.id)] &&
                    (e.attendees || []).map((a) => (
                      <View
                        key={a.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                          gap: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={font(12, true)}>{a.name}</Text>
                          <Text style={{ ...font(11), color: muted }}>
                            {a.unit || a.email}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete RSVP for ${a.name}`}
                          onPress={() =>
                            setConfirm({
                              label: `Delete RSVP for ${a.name}?`,
                              run: () => removeAttendee(String(e.id), a.id),
                            })
                          }
                        >
                          <Trash2 size={14} color="#e11d48" />
                        </Pressable>
                      </View>
                    ))}
                </View>
              ))}
            </>
          )}
          {tab === "database" && privileged && (
            <>
              <View style={[panel, { borderColor: "#fcd34d" }]}>
                <AlertTriangle size={20} color="#d97706" />
                <Text style={font(14, true)}>
                  Production Initial State & Purge Utility
                </Text>
                <Text style={{ ...font(12), color: muted }}>
                  Use this tool to purge any leftover mock discussion feeds,
                  marketplace listings, or demo work orders from Firestore,
                  leaving a clean, empty initial state ready for real production
                  usage.
                </Text>
              </View>
              <View style={panel}>
                <Text style={font(14, true)}>Purge All Seed & Mock Data</Text>
                <Text style={{ ...font(12), color: muted }}>
                  Wipes discussion_feed, marketplace_posts, and work_orders
                  collections.
                </Text>
                {button(
                  "Reset & Clean Collections",
                  () =>
                    setConfirm({
                      label: "Confirm Purge",
                      run: async () => {
                        throw Error(
                          "Mock cleanup requires an explicit allowlist of verified mock document IDs.",
                        );
                      },
                    }),
                  true,
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
async function removeAttendee(id: string, attendeeId: string) {
  await approvedUser(true);
  await runTransaction(db, async (tx) => {
    const reference = doc(db, "community_events", id),
      snap = await tx.get(reference);
    if (!snap.exists()) throw Error("This event is no longer available.");
    const event = snap.data() as CommunityRsvpEvent;
    const patch = removeAttendeePatch(event, attendeeId);
    if (patch) tx.update(reference, patch);
  });
}
