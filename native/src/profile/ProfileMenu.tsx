import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInRight,
  FadeOutLeft,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Mail,
  Users,
  User,
  Shield,
  Sun,
  Moon,
  LogOut,
  X,
  Building2,
  Wrench,
  Phone,
  type LucideIcon,
} from "lucide-react-native";
import { signOut } from "firebase/auth";
import { router } from "expo-router";
import type { UserProfile } from "../../../src/types";
import {
  canAccessAdminPanel,
  getUserRole,
  isCrew,
} from "../../../src/utils/permissions";
import { auth } from "../lib/firebase";
import { useResident } from "../lib/resident";
import { usePresentation } from "../shell/TownLoopShell";
import { useReducedMotion } from "../home/hooks";
import {
  manageResident,
  markRead,
  sendMessage,
  updatePhoto,
  useProfileData,
} from "./data";
import {
  neighbors,
  officeManager,
  senderLabel,
  type Category,
  type Thread,
} from "./model";
type MenuView =
  | "menu"
  | "inbox"
  | "friends"
  | "friendDetail"
  | "compose"
  | "conversation"
  | "account"
  | "logoutConfirm"
  | "admin";
const MenuStyle = createContext({
  ink: "#1c1917",
  muted: "#78716c",
  panel: { backgroundColor: "#ffffff99", borderColor: "#ffffffbf" },
  busy: false,
  closing: false,
  dark: false,
});
function Row({
  title,
  subtitle,
  icon: Icon,
  onPress,
  tone = "#047857",
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: string;
  badge?: number;
}) {
  const { ink, muted, panel, busy, closing, dark } = useContext(MenuStyle);
  const wide = useWindowDimensions().width >= 640;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || closing}
      style={({ pressed }) => [
        s.row,
        panel,
        {
          backgroundColor: dark ? "#0f172a73" : "transparent",
          padding: wide ? 16 : 14,
          overflow: "hidden",
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ["#ffffff24", "#ffffff0a", "#ffffff14"]
            : ["#ffffffcc", "#ffffff75", "#ffffffad"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          s.icon,
          {
            backgroundColor: tone + "20",
            width: wide ? 48 : 44,
            height: wide ? 48 : 44,
          },
        ]}
      >
        <Icon size={wide ? 24 : 20} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: ink, fontSize: wide ? 16 : 14 }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[s.small, { color: muted }]}>{subtitle}</Text>
        )}
      </View>
      {!!badge && <Text style={s.badge}>{badge} new</Text>}
      <ChevronRight size={18} color={muted} />
    </Pressable>
  );
}
function Action({
  title,
  onPress,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { busy } = useContext(MenuStyle);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        {
          backgroundColor: danger ? "#e11d48" : "#059669",
          opacity: pressed || busy ? 0.65 : 1,
        },
      ]}
    >
      <Text style={s.actionText}>{title}</Text>
    </Pressable>
  );
}
function Avatar({
  resident,
  size = 64,
}: {
  resident: UserProfile;
  size?: number;
}) {
  const uri = resident.avatar_url || resident.avatarUrl || resident.avatar;
  return (
    <View
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={s.initials}>
          {resident.name
            ?.split(" ")
            .map((v) => v[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export function ProfileMenu({
  open,
  onClose,
  onAccount,
  onUnread,
}: {
  open: boolean;
  onClose: () => void;
  onAccount: () => void;
  onUnread: (count: number) => void;
}) {
  const user = useResident(),
    presentation = usePresentation(),
    reduced = useReducedMotion();
  const dark = !!presentation?.dark,
    data = useProfileData(user);
  const { width, height } = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false),
    [closing, setClosing] = useState(false),
    [view, setView] = useState<MenuView>("menu");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<Category | "all">("all");
  const [person, setPerson] = useState<UserProfile | null>(null),
    [selected, setSelected] = useState<{
      category: Category;
      id: string;
    } | null>(null);
  const [category, setCategory] = useState<Category>("office"),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [roleChange, setRoleChange] = useState<{
    resident: UserProfile;
    role: string;
  } | null>(null);
  const lock = useRef(false),
    afterClose = useRef<(() => void) | null>(null);
  const glint = useSharedValue(-1);
  const progress = useSharedValue(0),
    shade = useSharedValue(0);
  const conversation = data.threads.find(
    (t) => t.id === selected?.id && t.category === selected.category,
  );
  const friends = user ? neighbors(data.directory.items, user) : [];
  const ink = dark ? "#f1f5f9" : "#1c1917",
    muted = dark ? "#94a3b8" : "#78716c";
  const panel = {
    backgroundColor: dark ? "#ffffff0d" : "#ffffff99",
    borderColor: dark ? "#ffffff26" : "#ffffffbf",
  };
  useEffect(() => {
    onUnread(data.threads.filter((t) => t.unread).length);
  }, [data.threads, onUnread]);
  useEffect(() => {
    if (open) {
      // Native Modal needs its own mounted state so exit motion finishes before dismissal.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("menu");
      setError("");
      setNotice("");
      setMounted(true);
      setClosing(false);
      progress.value = 0;
      shade.value = 0;
      glint.value = -1;
    }
  }, [open, progress, shade, glint]);
  const openingFrame = useRef<number | null>(null);
  function animateOpen() {
    // Wait until the modal has painted its initial pose before starting the spring.
    openingFrame.current = requestAnimationFrame(() => {
      openingFrame.current = requestAnimationFrame(() => {
        glint.value = withDelay(
          reduced ? 0 : 50,
          withTiming(1.8, {
            duration: reduced ? 0 : 850,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        );
        progress.value = withSpring(1, {
          damping: 25,
          stiffness: 280,
          mass: 0.75,
          reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System,
        });
        shade.value = withTiming(1, {
          duration: reduced ? 0 : 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
      });
    });
  }
  useEffect(
    () => () => {
      if (openingFrame.current !== null)
        cancelAnimationFrame(openingFrame.current);
      cancelAnimation(progress);
      cancelAnimation(shade);
      cancelAnimation(glint);
    },
    [progress, shade, glint],
  );
  function finishClose() {
    setMounted(false);
    setClosing(false);
    onClose();
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  }
  function close(next?: () => void) {
    if (closing) return;
    if (openingFrame.current !== null)
      cancelAnimationFrame(openingFrame.current);
    setClosing(true);
    afterClose.current = next || null;
    shade.set(
      withTiming(
        0,
        {
          duration: reduced ? 0 : 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      ),
    );
    progress.set(
      withTiming(0, {
        duration: reduced ? 0 : 200,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      }),
    );
  }
  const cardMotion = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, progress.value)),
    // Match the original popup's blur-to-focus reveal on the web renderer.
    // Native renderers retain the spring, fade and glass backdrop.
    ...(Platform.OS === "web"
      ? {
          filter: `blur(${Math.max(0, (closing ? 8 : 14) * (1 - progress.value))}px)`,
        }
      : {}),
    transform: [
      {
        scale:
          (closing ? 0.88 : 0.84) + progress.value * (closing ? 0.12 : 0.16),
      },
      { translateY: (closing ? -18 : -28) * (1 - progress.value) },
    ],
  }));
  const glintMotion = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : Math.max(0, 0.8 * (1 - (glint.value + 1) / 2.8)),
    transform: [
      {
        translateX:
          glint.value * Math.min(width - 24, width >= 640 ? 540 : 500),
      },
      { skewX: "-12deg" },
    ],
  }));
  const shadeMotion = useAnimatedStyle(() => ({ opacity: shade.value }));
  function go(next: MenuView) {
    setError("");
    setNotice("");
    setView(next);
  }
  async function act(action: () => Promise<unknown>, success?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError(
        (e as Error).message || "Unable to complete this action. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function compose(target: Category, recipient?: UserProfile) {
    setCategory(target);
    setPerson(recipient || null);
    setSelected(null);
    setSubject("");
    setBody("");
    go("compose");
  }
  function openThread(thread: Thread) {
    setSelected({ category: thread.category, id: thread.id });
    setBody("");
    go("conversation");
    if (thread.unread) void act(() => markRead(thread));
  }
  const textInput = [
    s.input,
    {
      color: ink,
      backgroundColor: dark ? "#02061799" : "#ffffff99",
      borderColor: dark ? "#ffffff26" : "#ffffffbf",
    },
  ];
  if (!user) return null;
  return (
    <MenuStyle.Provider value={{ ink, muted, panel, busy, closing, dark }}>
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onShow={animateOpen}
        onRequestClose={() => {
          if (view !== "menu") go("menu");
          else close();
        }}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              s.stage,
              {
                paddingTop: Math.max(12, insets.top),
                paddingBottom: Math.max(12, insets.bottom),
              },
            ]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                Platform.OS === "web" &&
                  ({
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                  } as ViewStyle),
                shadeMotion,
              ]}
            >
              {Platform.OS !== "web" && (
                <BlurView
                  blurTarget={presentation?.blurTarget}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  intensity={70}
                  tint="default"
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss resident menu"
                onPress={() => close()}
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "#0c0a0973" },
                ]}
              />
            </Animated.View>
            <Animated.View
              accessibilityViewIsModal
              style={[
                s.window,
                {
                  width: Math.min(width - 24, width >= 640 ? 540 : 500),
                  height: Math.min(
                    width >= 640 ? 560 : 520,
                    height - insets.top - insets.bottom - 24,
                  ),
                  borderRadius: width >= 640 ? 36 : 32,
                  padding: width >= 640 ? 20 : 16,
                  paddingTop: width >= 640 ? 16 : 14,
                  borderColor: dark ? "#ffffff42" : "#ffffffe6",
                  backgroundColor: dark ? "#0f172ac7" : "#ffffffa6",
                },
                Platform.OS === "web" &&
                  ({
                    backdropFilter:
                      "blur(36px) saturate(210%) contrast(108%) brightness(104%)",
                    WebkitBackdropFilter:
                      "blur(36px) saturate(210%) contrast(108%) brightness(104%)",
                  } as ViewStyle),
                cardMotion,
              ]}
            >
              {Platform.OS !== "web" && (
                <BlurView
                  blurTarget={presentation?.blurTarget}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  intensity={90}
                  tint={dark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                pointerEvents="none"
                colors={
                  dark
                    ? ["#ffffff33", "#ffffff0a", "#ffffff26"]
                    : ["#ffffffe0", "#ffffffb3", "#ffffff94", "#ffffffd1"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, glintMotion]}
              >
                <LinearGradient
                  colors={[
                    "#ffffff00",
                    dark ? "#ffffff1f" : "#ffffff40",
                    "#ffffff00",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Resident Menu"
                onPress={() => close()}
                style={[s.close, panel]}
              >
                <X size={20} color={ink} />
              </Pressable>
              {view !== "menu" && (
                <View style={s.subheader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to resident menu"
                    onPress={() =>
                      go(
                        view === "friendDetail"
                          ? "friends"
                          : view === "conversation"
                            ? "inbox"
                            : "menu",
                      )
                    }
                    style={s.back}
                  >
                    <ChevronLeft size={20} color="#059669" />
                    <Text style={s.backText}>Back</Text>
                  </Pressable>
                  <Text style={[s.sectionTitle, { color: muted }]}>
                    {
                      (
                        {
                          inbox: "Mail (Inbox)",
                          friends: "Friends & Neighbors",
                          friendDetail: "Neighbor Profile",
                          compose: "Compose Message",
                          conversation: "Conversation",
                          account: "Resident Account",
                          logoutConfirm: "Log Out",
                          admin: "Admin Panel",
                        } as Record<string, string>
                      )[view]
                    }
                  </Text>
                </View>
              )}
              <Animated.View
                key={view}
                entering={FadeInRight.duration(reduced ? 0 : 220).reduceMotion(
                  ReduceMotion.System,
                )}
                exiting={FadeOutLeft.duration(reduced ? 0 : 140).reduceMotion(
                  ReduceMotion.System,
                )}
                style={{ flex: 1 }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
                >
                  {!!error && (
                    <Text accessibilityLiveRegion="polite" style={s.error}>
                      {error}
                    </Text>
                  )}
                  {!!notice && (
                    <Text accessibilityLiveRegion="polite" style={s.notice}>
                      {notice}
                    </Text>
                  )}
                  {view === "menu" && (
                    <>
                      <View style={s.profile}>
                        <View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Edit profile picture"
                            disabled={busy}
                            onPress={() =>
                              void act(async () => {
                                if (await updatePhoto())
                                  setNotice("Profile picture updated!");
                              })
                            }
                          >
                            <Avatar resident={user} size={72} />
                            <View style={s.camera}>
                              <Camera size={15} color="#fff" />
                            </View>
                          </Pressable>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.name, { color: ink }]}>
                            {user.name}
                          </Text>
                          <Text style={s.role}>
                            {getUserRole(user) || "Resident"}
                          </Text>
                          <Text style={[s.small, { color: muted }]}>
                            {user.address || "TownLoop Community"}
                          </Text>
                        </View>
                      </View>
                      {canAccessAdminPanel(user) && (
                        <Row
                          title="Admin Panel"
                          subtitle="Resident Approvals & Role Management"
                          icon={Shield}
                          tone="#d97706"
                          onPress={() => go("admin")}
                        />
                      )}
                      <Row
                        title="Mail (Inbox)"
                        subtitle="Friends, Community Office & Crew"
                        icon={Mail}
                        tone="#2563eb"
                        badge={data.threads.filter((t) => t.unread).length}
                        onPress={() => go("inbox")}
                      />
                      <Row
                        title="Friends & Neighbors"
                        subtitle={`All ${friends.length} neighbors • Profiles & phone`}
                        icon={Users}
                        onPress={() => go("friends")}
                      />
                      <Row
                        title="Account"
                        subtitle="Residency details & contacts"
                        icon={User}
                        tone="#d97706"
                        onPress={() => go("account")}
                      />
                      <View style={[s.theme, panel]}>
                        <Text style={[s.rowTitle, { color: ink }]}>Theme</Text>
                        <View style={s.segments}>
                          {[false, true].map((value) => (
                            <Pressable
                              key={String(value)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: dark === value }}
                              accessibilityLabel={
                                value ? "Dark theme" : "Light theme"
                              }
                              onPress={() => {
                                if (dark !== value) presentation?.toggleTheme();
                              }}
                              style={[s.segment, dark === value && panel]}
                            >
                              {value ? (
                                <Moon size={17} color="#818cf8" />
                              ) : (
                                <Sun size={17} color="#d97706" />
                              )}
                              <Text style={[s.rowTitle, { color: ink }]}>
                                {value ? "Dark" : "Light"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <Row
                        title="Log Out"
                        subtitle="Sign out of your resident portal"
                        icon={LogOut}
                        tone="#e11d48"
                        onPress={() => go("logoutConfirm")}
                      />
                    </>
                  )}
                  {view === "inbox" && (
                    <>
                      <Action
                        title="Compose Message"
                        onPress={() => compose("office")}
                      />
                      <View style={s.chips}>
                        {(
                          ["all", "friend", "office", "maintenance"] as const
                        ).map((v) => (
                          <Pressable
                            key={v}
                            accessibilityRole="button"
                            accessibilityState={{ selected: filter === v }}
                            onPress={() => setFilter(v)}
                            style={[
                              s.chip,
                              panel,
                              filter === v && { backgroundColor: "#059669" },
                            ]}
                          >
                            <Text
                              style={[
                                s.small,
                                { color: filter === v ? "#fff" : ink },
                              ]}
                            >
                              {v === "all"
                                ? "All"
                                : v === "friend"
                                  ? "Friends"
                                  : v === "office"
                                    ? "Office"
                                    : "Crew"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {data.loading && <ActivityIndicator color="#059669" />}
                      {data.errors.map((e, i) => (
                        <Text key={i} style={s.error}>
                          {e}
                        </Text>
                      ))}
                      {data.errors.length > 0 && (
                        <Action title="Retry messages" onPress={data.retry} />
                      )}
                      {data.threads
                        .filter(
                          (t) => filter === "all" || t.category === filter,
                        )
                        .map((t) => (
                          <Row
                            key={`${t.category}:${t.id}`}
                            title={t.name}
                            subtitle={`${t.subject}\n${t.messages.at(-1)?.body || "Conversation"}`}
                            icon={
                              t.category === "friend"
                                ? Users
                                : t.category === "office"
                                  ? Building2
                                  : Wrench
                            }
                            badge={t.unread ? 1 : 0}
                            onPress={() => openThread(t)}
                          />
                        ))}
                      {!data.loading &&
                        data.errors.length === 0 &&
                        data.threads.filter(
                          (t) => filter === "all" || t.category === filter,
                        ).length === 0 && (
                          <Text style={[s.empty, { color: muted }]}>
                            No messages yet. Start a conversation with a
                            neighbor, the office, or maintenance.
                          </Text>
                        )}
                    </>
                  )}
                  {view === "friends" && (
                    <>
                      <TextInput
                        accessibilityLabel="Search friends and neighbors"
                        placeholder="Search neighbors…"
                        placeholderTextColor={muted}
                        value={search}
                        onChangeText={setSearch}
                        style={textInput}
                      />
                      {data.directory.loading && (
                        <ActivityIndicator color="#059669" />
                      )}
                      {!!data.directory.error && (
                        <>
                          <Text style={s.error}>{data.directory.error}</Text>
                          <Action
                            title="Retry directory"
                            onPress={data.directory.retry}
                          />
                        </>
                      )}
                      {friends
                        .filter((p) =>
                          `${p.name} ${p.address}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <Pressable
                            accessibilityRole="button"
                            key={String(p.id)}
                            onPress={() => {
                              setPerson(p);
                              go("friendDetail");
                            }}
                            style={[s.row, panel]}
                          >
                            <Avatar resident={p} size={44} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.rowTitle, { color: ink }]}>
                                {p.name}
                              </Text>
                              <Text style={[s.small, { color: muted }]}>
                                {p.address}
                              </Text>
                            </View>
                            <ChevronRight size={18} color={muted} />
                          </Pressable>
                        ))}
                      {!data.directory.loading && friends.length === 0 && (
                        <Text style={[s.empty, { color: muted }]}>
                          No neighbors available.
                        </Text>
                      )}
                    </>
                  )}
                  {view === "friendDetail" && !!person && (
                    <>
                      <View style={s.profile}>
                        <Avatar resident={person} size={72} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.name, { color: ink }]}>
                            {person.name}
                          </Text>
                          <Text style={[s.small, { color: muted }]}>
                            {person.address}
                          </Text>
                        </View>
                      </View>
                      {!!person.phone && (
                        <Row
                          title={person.phone}
                          subtitle="Call neighbor"
                          icon={Phone}
                          onPress={() =>
                            void act(() =>
                              Linking.openURL(
                                `tel:${person.phone!.replace(/[^+\d]/g, "")}`,
                              ),
                            )
                          }
                        />
                      )}
                      <Action
                        title="Send Message"
                        onPress={() => compose("friend", person)}
                      />
                    </>
                  )}
                  {view === "compose" && (
                    <>
                      <View style={s.chips}>
                        {(
                          ["friend", "office", "maintenance"] as Category[]
                        ).map((v) => (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: category === v }}
                            key={v}
                            onPress={() => {
                              setCategory(v);
                              setPerson(null);
                            }}
                            style={[
                              s.chip,
                              panel,
                              category === v && { backgroundColor: "#059669" },
                            ]}
                          >
                            <Text
                              style={[
                                s.small,
                                { color: category === v ? "#fff" : ink },
                              ]}
                            >
                              {v === "friend"
                                ? "Friend"
                                : v === "office"
                                  ? "Community Office"
                                  : "Maintenance"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {(category === "friend" ||
                        (category === "office"
                          ? officeManager(user)
                          : isCrew(user))) && (
                        <>
                          <Text style={[s.rowTitle, { color: ink }]}>
                            Select a resident
                          </Text>
                          {friends.map((p) => (
                            <Pressable
                              accessibilityRole="button"
                              key={String(p.id)}
                              onPress={() => setPerson(p)}
                              style={[
                                s.chip,
                                panel,
                                person?.id === p.id && {
                                  borderColor: "#059669",
                                  borderWidth: 2,
                                },
                              ]}
                            >
                              <Text style={[s.small, { color: ink }]}>
                                {p.name} • {p.address}
                              </Text>
                            </Pressable>
                          ))}
                        </>
                      )}
                      <Text style={[s.rowTitle, { color: ink }]}>
                        To:{" "}
                        {person?.name ||
                          (category === "friend"
                            ? "Select a neighbor"
                            : category === "office"
                              ? "Community Office"
                              : "Maintenance Crew")}
                      </Text>
                      <TextInput
                        accessibilityLabel="Message subject"
                        placeholder="Subject"
                        placeholderTextColor={muted}
                        value={subject}
                        onChangeText={setSubject}
                        maxLength={160}
                        style={textInput}
                      />
                      <TextInput
                        accessibilityLabel="Message body"
                        placeholder="Write your message…"
                        placeholderTextColor={muted}
                        multiline
                        value={body}
                        onChangeText={setBody}
                        maxLength={10000}
                        style={[
                          ...textInput,
                          { minHeight: 120, textAlignVertical: "top" },
                        ]}
                      />
                      <Action
                        title={busy ? "Sending…" : "Send Message"}
                        onPress={() =>
                          void act(async () => {
                            if (
                              (category === "friend" ||
                                (category === "office"
                                  ? officeManager(user)
                                  : isCrew(user))) &&
                              !person
                            )
                              throw new Error("Select a resident first.");
                            await sendMessage(
                              category,
                              person || user,
                              subject,
                              body,
                            );
                            setBody("");
                            go("inbox");
                            setNotice("Message sent.");
                          })
                        }
                      />
                    </>
                  )}
                  {view === "conversation" && (
                    <>
                      {conversation ? (
                        <>
                          <Text style={[s.name, { color: ink }]}>
                            {conversation.name}
                          </Text>
                          <Text style={[s.small, { color: muted }]}>
                            {conversation.subject}
                          </Text>
                          {conversation.messages.map((m) => (
                            <View key={m.id} style={[s.bubble, panel]}>
                              <Text style={[s.rowTitle, { color: ink }]}>
                                {senderLabel(m, conversation.category, user)}
                              </Text>
                              <Text style={[s.message, { color: ink }]}>
                                {m.body}
                              </Text>
                              <Text style={[s.small, { color: muted }]}>
                                {new Date(m.createdAt).toLocaleString()}
                              </Text>
                            </View>
                          ))}
                          <TextInput
                            accessibilityLabel="Reply"
                            placeholder="Write a reply…"
                            placeholderTextColor={muted}
                            multiline
                            value={body}
                            onChangeText={setBody}
                            maxLength={10000}
                            style={textInput}
                          />
                          <Action
                            title={busy ? "Sending…" : "Send Reply"}
                            onPress={() =>
                              void act(async () => {
                                await sendMessage(
                                  conversation.category,
                                  conversation.recipient,
                                  conversation.subject,
                                  body,
                                  conversation,
                                );
                                setBody("");
                                setNotice("Reply sent.");
                              })
                            }
                          />
                        </>
                      ) : (
                        <Text style={[s.empty, { color: muted }]}>
                          This conversation is unavailable. Return to the inbox
                          and retry.
                        </Text>
                      )}
                    </>
                  )}
                  {view === "account" && (
                    <>
                      <View style={s.profile}>
                        <Avatar resident={user} />
                        <Text style={[s.name, { color: ink }]}>
                          {user.name}
                        </Text>
                      </View>
                      {[
                        ["Email", user.email],
                        ["Residency Address", user.address],
                        ["Resident Phone", user.phone],
                        [
                          "Emergency Contact",
                          user.emergencyContact || user.emergency_contact,
                        ],
                        [
                          "Dietary Preference",
                          user.dietaryPreference || user.dietary_preference,
                        ],
                      ].map(([label, value]) => (
                        <View key={label} style={[s.bubble, panel]}>
                          <Text style={[s.small, { color: muted }]}>
                            {label}
                          </Text>
                          <Text style={[s.rowTitle, { color: ink }]}>
                            {value || "Not provided"}
                          </Text>
                        </View>
                      ))}
                      <Action
                        title="Open Account / Profile"
                        onPress={() => close(onAccount)}
                      />
                      <Action
                        title="Contact office about profile"
                        onPress={() => compose("office")}
                      />
                    </>
                  )}
                  {view === "logoutConfirm" && (
                    <View
                      style={{
                        gap: 20,
                        alignItems: "center",
                        paddingVertical: 28,
                      }}
                    >
                      <LogOut size={48} color="#e11d48" />
                      <Text
                        style={[s.name, { color: ink, textAlign: "center" }]}
                      >
                        Log Out of Resident Portal?
                      </Text>
                      <Text
                        style={[
                          s.message,
                          { color: muted, textAlign: "center" },
                        ]}
                      >
                        You can easily sign back into your TownLoop account at
                        any time.
                      </Text>
                      <Action title="Cancel" onPress={() => go("menu")} />
                      <Action
                        title={busy ? "Signing out…" : "Yes, Log Out"}
                        danger
                        onPress={() =>
                          void act(async () => {
                            await signOut(auth);
                            close();
                          })
                        }
                      />
                    </View>
                  )}
                  {view === "admin" && canAccessAdminPanel(user) && (
                    <>
                      <Row
                        title="News & Publishing"
                        subtitle="Manage community editions and events"
                        icon={Mail}
                        onPress={() => close(() => router.navigate("/news"))}
                      />
                      <Row
                        title="Work Orders"
                        subtitle="Queue and maintenance tools"
                        icon={Wrench}
                        onPress={() =>
                          close(() => router.navigate("/workorders"))
                        }
                      />
                      {!!data.directory.error && (
                        <Text style={s.error}>{data.directory.error}</Text>
                      )}
                      {!!roleChange && (
                        <View style={[s.bubble, panel]}>
                          <Text style={[s.rowTitle, { color: ink }]}>
                            Change {roleChange.resident.name} to{" "}
                            {roleChange.role}?
                          </Text>
                          <Text style={[s.small, { color: muted }]}>
                            This changes the resident’s community permissions.
                          </Text>
                          <Action
                            title="Confirm role change"
                            onPress={() =>
                              void act(async () => {
                                await manageResident(
                                  String(roleChange.resident.id),
                                  { role: roleChange.role },
                                );
                                setRoleChange(null);
                              }, "Role updated.")
                            }
                          />
                          <Action
                            title="Cancel"
                            onPress={() => setRoleChange(null)}
                          />
                        </View>
                      )}
                      {data.directory.items
                        .filter((p) => String(p.id) !== String(user.id))
                        .map((p) => (
                          <View key={String(p.id)} style={[s.bubble, panel]}>
                            <Text style={[s.rowTitle, { color: ink }]}>
                              {p.name}
                            </Text>
                            <Text style={[s.small, { color: muted }]}>
                              {p.email} • {p.role || "Resident"} •{" "}
                              {p.approved === false
                                ? "Pending approval"
                                : "Approved"}
                            </Text>
                            {p.approved === false && (
                              <Action
                                title={`Approve ${p.name}`}
                                onPress={() =>
                                  void act(
                                    () =>
                                      manageResident(String(p.id), {
                                        approved: true,
                                      }),
                                    "Resident approved.",
                                  )
                                }
                              />
                            )}
                            <View style={s.chips}>
                              {["resident", "crew", "staff", "vip", "admin"]
                                .filter((role) => role !== p.role)
                                .map((role) => (
                                  <Pressable
                                    key={role}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Set ${p.name} role to ${role}`}
                                    disabled={busy}
                                    style={[s.chip, panel]}
                                    onPress={() =>
                                      setRoleChange({ resident: p, role })
                                    }
                                  >
                                    <Text style={[s.small, { color: ink }]}>
                                      {role}
                                    </Text>
                                  </Pressable>
                                ))}
                            </View>
                          </View>
                        ))}
                    </>
                  )}
                  {busy && <ActivityIndicator color="#059669" />}
                </ScrollView>
              </Animated.View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </MenuStyle.Provider>
  );
}
const s = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  window: {
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "#ffffff99",
    overflow: "hidden",
    padding: 20,
    boxShadow:
      "0px 30px 80px -15px rgba(0,10,30,0.25), 0px 12px 28px -5px rgba(0,0,0,0.1)",
  },
  close: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    zIndex: 20,
  },
  profile: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingRight: 44,
    paddingBottom: 10,
  },
  avatar: {
    borderWidth: 2,
    borderColor: "#05966980",
    backgroundColor: "#e7e5e4",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "JakartaBold",
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
    includeFontPadding: false,
    color: "#57534e",
  },
  camera: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: "PlayfairBlack", fontSize: 24, lineHeight: 30 },
  role: {
    alignSelf: "flex-start",
    color: "#047857",
    fontFamily: "JakartaExtra",
    fontSize: 10,
    textTransform: "uppercase",
    backgroundColor: "#d1fae5",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 5,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: "JakartaBold", fontSize: 14, lineHeight: 20 },
  small: { fontFamily: "Jakarta", fontSize: 12, lineHeight: 18 },
  badge: {
    fontFamily: "JakartaBold",
    fontSize: 10,
    color: "#fff",
    backgroundColor: "#e11d48",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  theme: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 10 },
  segments: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0000000a",
    padding: 4,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subheader: {
    paddingRight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#a8a29e33",
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  backText: { color: "#059669", fontFamily: "JakartaBold", fontSize: 13 },
  sectionTitle: {
    fontFamily: "JakartaExtra",
    fontSize: 11,
    textTransform: "uppercase",
    flex: 1,
  },
  action: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontFamily: "JakartaBold",
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    includeFontPadding: false,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    padding: 14,
    fontFamily: "Jakarta",
    fontSize: 14,
  },
  bubble: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  message: { fontFamily: "Jakarta", fontSize: 14, lineHeight: 22 },
  empty: {
    fontFamily: "Jakarta",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    paddingVertical: 28,
  },
  error: {
    fontFamily: "Jakarta",
    color: "#be123c",
    backgroundColor: "#ffe4e6",
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
  },
  notice: {
    fontFamily: "Jakarta",
    color: "#065f46",
    backgroundColor: "#d1fae5",
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
  },
});
