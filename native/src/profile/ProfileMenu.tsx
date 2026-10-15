import { AdminMenu } from "./AdminMenu";
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
  FadeIn,
  FadeOut,

  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Search,
  Heart,
  Home,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { signOut } from "firebase/auth";
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
  deleteThread,
  markRead,
  sendMessage,
  updatePhoto,
  useProfileData,
} from "./data";
import {
  neighbors,
  officeManager,
  senderLabel,
  messageIsMine,
  messageAvatar,
  profileInterests,
  residentSince,
  matchesNeighbor,
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
          backgroundColor: dark ? "#1e293bf2" : "#fffffff2",
          boxShadow: dark
            ? "0px 2px 6px rgba(0,0,0,0.18)"
            : "0px 2px 6px rgba(28,25,23,0.08)",
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
            ? ["#ffffff0d", "#ffffff03", "#ffffff08"]
            : ["#ffffff99", "#ffffff66", "#ffffff80"]
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
  const history = useRef<MenuView[]>([]);
  const [direction, setDirection] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const transitionLock = useRef(false);
  const scene = useSharedValue(1);
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
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [deleting, setDeleting] = useState<Thread | null>(null);
  const lock = useRef(false),
    afterClose = useRef<(() => void) | null>(null);
  const glint = useSharedValue(-1);
  const progress = useSharedValue(0),
    shade = useSharedValue(0);
  const conversation = data.threads.find(
    (t) => t.id === selected?.id && t.category === selected.category,
  );
  useEffect(() => {
    if (view !== "conversation" || !conversation?.unread) return;
    void markRead(conversation).catch((e) =>
      setError(e.message || "Unable to mark messages read."),
    );
  }, [view, conversation]);
  const friends = user ? neighbors(data.directory.items, user) : [];
  const visibleFriends = friends.filter((p) => matchesNeighbor(p, search));
  const ink = dark ? "#f1f5f9" : "#1c1917",
    muted = dark ? "#94a3b8" : "#78716c";
  const panel = {
    backgroundColor: dark ? "#1e293bf2" : "#fffffff2",
    borderColor: dark ? "#64748b99" : "#a8a29e99",
  };
  useEffect(() => {
    onUnread(data.threads.filter((t) => t.unread).length);
  }, [data.threads, onUnread]);
  useEffect(() => {
    if (open) {
      // Native Modal needs its own mounted state so exit motion finishes before dismissal.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("menu");
      history.current = [];
      transitionLock.current = false;
      setTransitioning(false);
      cancelAnimation(scene);
      scene.value = 1;
      setError("");
      setNotice("");
      setDeleting(null);
      setMounted(true);
      setClosing(false);
      progress.value = 0;
      shade.value = 0;
      glint.value = -1;
    }
  }, [open, progress, shade, glint, scene]);
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
    cancelAnimation(scene);
    transitionLock.current = false;
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
  const sceneMotion = useAnimatedStyle(() => ({
    opacity: scene.value,
    transform: [{ translateX: direction * (1 - scene.value) * 18 },
      { scale: 0.985 + scene.value * 0.015 }],
  }));
  function finishNavigation(next: MenuView, backwards: boolean) {
    setView(next);
    setDirection(backwards ? -1 : 1);
    setError("");
    setNotice("");
    setRecipientOpen(false);
    scene.value = withTiming(1, {
      duration: reduced ? 0 : 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    transitionLock.current = false;
    setTransitioning(false);
  }
  function go(next: MenuView, backwards = false) {
    if (transitionLock.current || closing || next === view) return;
    transitionLock.current = true;
    setTransitioning(true);
    if (!backwards) {
      const previous = history.current.lastIndexOf(next);
      if (previous >= 0) {
        history.current = history.current.slice(0, previous);
        backwards = true;
      } else history.current.push(view);
    }
    setDirection(backwards ? 1 : -1);
    scene.value = withTiming(0, { duration: reduced ? 0 : 90 }, (finished) => {
      if (finished) runOnJS(finishNavigation)(next, backwards);
    });
  }
  function back() {
    if (transitionLock.current) return;
    go(history.current.pop() || "menu", true);
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
  async function copy(value: string) {
    await Clipboard.setStringAsync(value);
    setNotice("Copied to clipboard");
  }
  function compose(target: Category, recipient?: UserProfile) {
    setRecipientOpen(false);
    setCategory(target);
    setPerson(recipient || null);
    setSelected(null);
    setSubject(recipient ? `Hello ${recipient.name.split(" ")[0]}!` : "");
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
          if (view !== "menu") back();
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
                  // Every subview shares the same shell; only the contents scroll.
                  width: Math.min(width - 24, width >= 640 ? 540 : 500),
                  height: Math.min(
                    width >= 640 ? 680 : 640,
                    height - insets.top - insets.bottom - 24,
                  ),
                  borderRadius: width >= 640 ? 36 : 32,
                  padding: view === "admin" ? 0 : width >= 640 ? 20 : 16,
                  paddingTop: view === "admin" ? 0 : width >= 640 ? 16 : 14,
                  borderColor: dark ? "#ffffff42" : "#ffffffe6",
                  backgroundColor: dark ? "#0f172af5" : "#e7e5e4f5",
                },
                Platform.OS === "web" &&
                  ({
                    backdropFilter:
                      "blur(44px) saturate(210%) contrast(108%) brightness(104%)",
                    WebkitBackdropFilter:
                      "blur(44px) saturate(210%) contrast(108%) brightness(104%)",
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
                    ? ["#ffffff14", "#ffffff05", "#ffffff0d"]
                    : ["#e7e5e4eb", "#e7e5e4d9", "#d6d3d1cc", "#e7e5e4e6"]
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
                style={[
                  s.close,
                  panel,
                  {
                    width: width >= 640 ? 40 : 36,
                    height: width >= 640 ? 40 : 36,
                    borderRadius: width >= 640 ? 20 : 18,
                    top: width >= 640 ? 16 : 14,
                    right: width >= 640 ? 16 : 14,
                  },
                ]}
              >
                <X size={20} color={ink} />
              </Pressable>
              {view !== "menu" && view !== "admin" && (
                <View style={s.subheader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to resident menu"
                    onPress={back}
                    style={s.back}
                  >
                    <ChevronLeft size={20} color="#059669" />
                    <Text style={s.backText}>
                      {view === "friendDetail" ? "All Residents" : "Back"}
                    </Text>
                  </Pressable>
                  <Text
                    style={[
                      s.sectionTitle,
                      {
                        color: ink,
                        fontSize: width >= 640 ? 16 : 14,
                        textTransform:
                          view === "account" ? "uppercase" : "none",
                        textAlign: "center",
                        letterSpacing: view === "account" ? 1 : 0,
                      },
                    ]}
                  >
                    {
                      (
                        {
                          inbox: "Mail (Inbox)",
                          friends: "Friends & Residents",
                          friendDetail: "Resident Profile",
                          compose: "Compose Message",
                          conversation: "Conversation",
                          account: "Resident Account",
                          logoutConfirm: "Log Out",
                          admin: "Admin Portal",
                        } as Record<string, string>
                      )[view]
                    }
                  </Text>
                  {view === "inbox" && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() =>
                        void act(
                          () =>
                            Promise.all(
                              data.threads
                                .filter((t) => t.unread)
                                .map(markRead),
                            ),
                          "All messages marked read",
                        )
                      }
                    >
                      <Text style={[s.small, { color: muted, fontSize: 12 }]}>
                        Mark all read
                      </Text>
                    </Pressable>
                  )}
                  {view === "friends" && (
                    <Text
                      style={[
                        s.role,
                        {
                          fontSize: 11,
                          textTransform: "none",
                          paddingHorizontal: 8,
                        },
                      ]}
                    >
                      {friends.length} neighbors
                    </Text>
                  )}
                  {view === "account" && (
                    <Text
                      style={{
                        fontFamily: "JakartaBold",
                        fontSize: 12,
                        color: "#059669",
                      }}
                    >
                      Active
                    </Text>
                  )}
                </View>
              )}
              {view === "inbox" && (
                <View
                  style={{
                    flexDirection: "row",
                    padding: 4,
                    gap: 4,
                    borderRadius: 16,
                    backgroundColor: dark ? "#1e293b" : "#ffffffa6",
                    marginBottom: 10,
                  }}
                >
                  {(["all", "friend", "office", "maintenance"] as const).map(
                    (v) => (
                      <Pressable
                        key={v}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: filter === v }}
                        onPress={() => setFilter(v)}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor:
                            filter === v
                              ? v === "all"
                                ? dark
                                  ? "#334155"
                                  : "#fff"
                                : v === "office"
                                  ? "#2563eb"
                                  : v === "maintenance"
                                    ? "#d97706"
                                    : "#059669"
                              : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily:
                              filter === v ? "JakartaExtra" : "JakartaBold",
                            fontSize: width >= 640 ? 12 : 11,
                            color: filter === v && v !== "all" ? "#fff" : muted,
                          }}
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
                    ),
                  )}
                </View>
              )}
              <Animated.View
                pointerEvents={transitioning ? "none" : "auto"}
                style={[{ flex: 1 }, sceneMotion]}
              >
                {view === "admin" && canAccessAdminPanel(user) && (
                  <View style={{ flex: 1 }}>
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
                    {!!data.directory.error && (
                      <Text style={s.error}>{data.directory.error}</Text>
                    )}
                    <AdminMenu
                      user={user}
                      residents={data.directory.items}
                      dark={dark}
                      onError={setError}
                      onNotice={setNotice}
                      onBack={back}
                    />
                  </View>
                )}
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{
                    flex: 1,
                    display: view === "admin" ? "none" : "flex",
                  }}
                  contentContainerStyle={{ gap: 14, paddingBottom: 16, ...(view === "conversation" ? { flex: 1 } : {}) }}
                  scrollEnabled={view !== "conversation"}
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
                            <Avatar
                              resident={user}
                              size={width >= 640 ? 80 : 64}
                            />
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
                            {user.address || user.unit || "TownLoop Community"}{user.wing ? ` • ${user.wing}` : ""}
                          </Text>
                          <Text selectable style={[s.small, { color: muted, marginTop: 4 }]}>{user.email}</Text>
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
                        <Text style={[s.rowTitle, { color: ink }]}>{dark ? "Dark Mode" : "Light Mode"}</Text>
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
                      <Text style={[s.small, { color: muted, textAlign: "center", fontSize: 10 }]}>Version 1.0.0 • © 2026 TownLoop • All rights reserved.</Text>
                    </>
                  )}
                  {view === "inbox" && (
                    <>
                      {data.loading && <ActivityIndicator color="#059669" />}
                      {data.errors.map((e, i) => (
                        <Text key={i} style={s.error}>
                          {e}
                        </Text>
                      ))}
                      {data.errors.length > 0 && (
                        <Action title="Retry messages" onPress={data.retry} />
                      )}
                      {deleting && (
                        <View style={[s.bubble, panel]}>
                          <Text style={[s.rowTitle, { color: ink }]}>
                            Delete conversation?
                          </Text>
                          <Text style={[s.small, { color: muted }]}>
                            This removes the shared conversation and its
                            messages.
                          </Text>
                          <Action
                            danger
                            title="Delete conversation"
                            onPress={() =>
                              void act(async () => {
                                await deleteThread(deleting);
                                setDeleting(null);
                              }, "Conversation deleted")
                            }
                          />
                          <Action
                            title="Cancel"
                            onPress={() => setDeleting(null)}
                          />
                        </View>
                      )}
                      {data.threads
                        .filter(
                          (t) => filter === "all" || t.category === filter,
                        )
                        .map((t) => {
                          const tone =
                            t.category === "office"
                              ? "#2563eb"
                              : t.category === "maintenance"
                                ? "#d97706"
                                : "#059669";
                          const Glyph =
                            t.category === "office"
                              ? Building2
                              : t.category === "maintenance"
                                ? Wrench
                                : Users;
                          return (
                            <View key={`${t.category}:${t.id}`} style={{ position: "relative" }}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Open conversation: ${t.name}, ${t.subject}`}
                              onPress={() => openThread(t)}
                              style={({ pressed }) => ({
                                padding: width >= 640 ? 14 : 12,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderLeftWidth: 5,
                                borderColor: tone + "55",
                                borderLeftColor: tone,
                                backgroundColor: dark
                                  ? tone + "20"
                                  : tone + (t.unread ? "16" : "0a"),
                                opacity: pressed ? 0.7 : 1,
                                gap: 8,
                              })}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 10,
                                  alignItems: "center",
                                  paddingRight: 36,
                                }}
                              >
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 12,
                                    backgroundColor: tone + "20",
                                    borderWidth: 1,
                                    borderColor: tone + "33",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Glyph size={16} color={tone} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      gap: 6,
                                      alignItems: "center",
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={{
                                        fontFamily: "JakartaExtra",
                                        fontSize: width >= 640 ? 14 : 12,
                                        color: ink,
                                        flexShrink: 1,
                                      }}
                                    >
                                      {t.name
                                        .replace(/\s*\([^)]*\)/g, "")
                                        .trim()}
                                    </Text>
                                    <Text
                                      style={{
                                        fontFamily: "JakartaExtra",
                                        fontSize: 9,
                                        color: tone,
                                        backgroundColor: tone + "18",
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderWidth: 1,
                                        borderColor: tone + "33",
                                        borderRadius: 6,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {t.category === "friend"
                                        ? "Friend"
                                        : t.category === "office"
                                          ? "Office"
                                          : "Crew"}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      fontFamily: "Jakarta",
                                      fontSize: 11,
                                      color: muted,
                                    }}
                                  >
                                    {t.category === "friend"
                                      ? "Resident"
                                      : t.category === "office"
                                        ? officeManager(user)
                                          ? "Resident"
                                          : "Community Office"
                                        : isCrew(user)
                                          ? "Resident"
                                          : "Maintenance Crew"}
                                  </Text>
                                </View>
                                {t.unread && (
                                  <View
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 4,
                                      backgroundColor: tone,
                                    }}
                                  />
                                )}
                                <Text
                                  style={{
                                    fontFamily: "Jakarta",
                                    fontSize: 11,
                                    color: muted,
                                  }}
                                >
                                  {t.updatedAt
                                    ? new Date(t.updatedAt).toLocaleDateString(
                                        "en-US",
                                        { month: "short", day: "numeric" },
                                      )
                                    : "Recent"}
                                </Text>

                              </View>
                              <Text
                                numberOfLines={1}
                                style={[
                                  s.rowTitle,
                                  {
                                    color: ink,
                                    fontSize: width >= 640 ? 14 : 12,
                                  },
                                ]}
                              >
                                {t.subject}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={[
                                  s.small,
                                  {
                                    color: muted,
                                    fontSize: width >= 640 ? 12 : 11,
                                  },
                                ]}
                              >
                                {t.messages.at(-1)?.body || "Conversation"}
                              </Text>
                            </Pressable>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Delete conversation"
                                  hitSlop={6}
                                  onPress={() => setDeleting(t)}
                                  style={{
                                    position: "absolute",
                                    right: 8,
                                    top: 8,
                                    width: 40,
                                    height: 40,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Trash2 size={14} color={muted} />
                                </Pressable>
                            </View>
                          );
                        })}
                      {!data.loading &&
                        data.errors.length === 0 &&
                        !data.threads.some(
                          (t) => filter === "all" || t.category === filter,
                        ) && (
                          <View
                            style={{
                              alignItems: "center",
                              gap: 8,
                              paddingVertical: 48,
                            }}
                          >
                            <Mail
                              size={40}
                              color={muted}
                              style={{ opacity: 0.4 }}
                            />
                            <Text
                              style={{
                                fontFamily: "Jakarta",
                                fontSize: 14,
                                color: muted,
                              }}
                            >
                              No messages in this folder.
                            </Text>
                          </View>
                        )}
                    </>
                  )}
                  {view === "friends" && (
                    <>
                      <View style={{ justifyContent: "center" }}>
                        <Search
                          size={16}
                          color={muted}
                          style={{ position: "absolute", left: 14, zIndex: 1 }}
                        />
                        <TextInput
                          accessibilityLabel="Search friends and neighbors"
                          placeholder="Search name, apt, wing, or interests..."
                          placeholderTextColor={muted}
                          value={search}
                          onChangeText={setSearch}
                          style={[
                            ...textInput,
                            {
                              paddingLeft: 40,
                              fontSize: width >= 640 ? 14 : 12,
                              borderRadius: 12,
                              paddingVertical: 10,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={{
                          fontFamily: "Jakarta",
                          fontSize: 12,
                          textAlign: "center",
                          color: muted,
                        }}
                      >
                        Tap on any resident to view phone number, address &
                        profile.
                      </Text>
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
                      {visibleFriends.map((p) => (
                        <View key={String(p.id)} style={[s.row, panel]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`View ${p.name}`}
                          onPress={() => {
                            setPerson(p);
                            go("friendDetail");
                          }}
                          style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}
                        >
                          <Avatar resident={p} size={width >= 640 ? 56 : 48} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rowTitle, { color: ink }]}>
                              {p.name}
                            </Text>
                            <Text style={[s.small, { color: muted }]}>
                              {p.address || p.unit || "Resident Unit"}
                              {p.wing ? ` • ${p.wing}` : ""}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "JakartaBold",
                                fontSize: 12,
                                color: dark ? "#34d399" : "#065f46",
                                marginTop: 2,
                              }}
                            >
                              {p.phone || "Phone not provided"}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={muted} />
                        </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Message ${p.name}`}
                            onPress={() => compose("friend", p)}
                            style={{
                              padding: 10,
                              borderRadius: 12,
                              backgroundColor: dark ? "#022c22" : "#ecfdf5",
                            }}
                          >
                            <Mail size={16} color="#047857" />
                          </Pressable>
                        </View>
                      ))}
                      {!data.directory.loading &&
                        visibleFriends.length === 0 && (
                          <Text style={[s.empty, { color: muted }]}>
                            No residents found in directory. Registered
                            community members will appear here.
                          </Text>
                        )}
                    </>
                  )}
                  {view === "friendDetail" && !!person && (
                    <>
                      <View style={[panel, { borderWidth: 1, borderRadius: 24, padding: 20, alignItems: "center", gap: 10 }]}>
                        <Avatar resident={person} size={width >= 640 ? 112 : 96} />
                        <Text style={[s.name, { color: ink, textAlign: "center" }]}>{person.name}</Text>
                        <Text style={[s.role, { textAlign: "center" }]}>{person.address || person.unit || "TownLoop Resident"}{person.wing ? ` • ${person.wing}` : ""}</Text>
                        {!!residentSince(person) && <Text style={[s.small, { color: muted }]}>TownLoop Resident since {residentSince(person)}</Text>}
                      </View>
                      <View style={[panel, { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Phone size={20} color="#059669" /><Text style={[s.rowTitle, { color: ink }]}>Phone Number</Text></View>
                        <Text selectable style={[s.message, { color: ink }]}>{person.phone || "Phone not provided"}</Text>
                        {!!person.phone && <View style={{ flexDirection: "row", gap: 8 }}>
                          <Action title="Copy Phone" onPress={() => void act(() => copy(person.phone!))} />
                          <Action title="Call" onPress={() => void act(() => Linking.openURL(`tel:${person.phone!.replace(/[^+\d]/g, "")}`))} />
                        </View>}
                      </View>
                      <View style={[panel, { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Home size={20} color="#059669" /><Text style={[s.rowTitle, { color: ink }]}>Residency Address</Text></View>
                        <Text selectable style={[s.message, { color: ink }]}>{person.address || person.unit || "Address not provided"}</Text>
                        {!!(person.address || person.unit) && <Action title="Copy Address" onPress={() => void act(() => copy(person.address || person.unit!))} />}
                      </View>
                      <View style={[panel, { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }]}>
                        <Text style={[s.rowTitle, { color: ink }]}>Activities & Interests</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {profileInterests(person).map((interest) => <Text key={interest} style={[s.role, { textTransform: "none" }]}>{interest}</Text>)}
                          {profileInterests(person).length === 0 && <Text style={[s.small, { color: muted }]}>No interests shared yet.</Text>}
                        </View>
                      </View>
                      <Action title={`Send ${person.name.split(" ")[0]} a Message`} onPress={() => compose("friend", person)} />
                    </>
                  )}
                  {view === "compose" && (
                    <>
                      <View
                        style={[
                          s.composeHero,
                          {
                            backgroundColor:
                              category === "office"
                                ? "#2563eb18"
                                : category === "maintenance"
                                  ? "#d9770618"
                                  : "#05966918",
                          },
                        ]}
                      >
                        {category === "office" ? (
                          <Building2 size={28} color="#2563eb" />
                        ) : category === "maintenance" ? (
                          <Wrench size={28} color="#d97706" />
                        ) : (
                          <Users size={28} color="#059669" />
                        )}
                        <Text style={[s.rowTitle, { color: ink }]}>
                          {category === "office"
                            ? "Message Community Office"
                            : category === "maintenance"
                              ? "Message Maintenance Crew"
                              : "Message a Friend or Neighbor"}
                        </Text>
                        <Text
                          style={[
                            s.small,
                            { color: muted, textAlign: "center" },
                          ]}
                        >
                          {category === "office"
                            ? "Contact your community office in one private conversation."
                            : category === "maintenance"
                              ? "Your maintenance team can respond in this shared conversation."
                              : "Choose a resident to start a private conversation."}
                        </Text>
                      </View>
                      {category === "friend" && (
                        <>
                          <Text style={[s.rowTitle, { color: muted }]}>
                            Recipient
                          </Text>
                          <View style={[s.recipientPanel, panel]}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Choose recipient"
                              accessibilityState={{ expanded: recipientOpen }}
                              onPress={() => setRecipientOpen(!recipientOpen)}
                              style={s.recipientChoice}
                            >
                              <Text
                                style={[s.rowTitle, { color: ink, flex: 1 }]}
                              >
                                {person
                                  ? `${person.name}${person.address ? ` · ${person.address}` : ""}`
                                  : "Select a resident…"}
                              </Text>
                              <ChevronDown size={18} color={muted} />
                            </Pressable>
                            {recipientOpen && (
                              <Animated.View entering={FadeIn.duration(reduced ? 0 : 180)} exiting={FadeOut.duration(reduced ? 0 : 100)}>
                              <ScrollView
                                nestedScrollEnabled
                                style={{ maxHeight: 180 }}
                              >
                                {friends.length === 0 && (
                                  <Text
                                    style={[
                                      s.small,
                                      { color: muted, padding: 16 },
                                    ]}
                                  >
                                    No residents available.
                                  </Text>
                                )}
                                {friends.map((p) => (
                                  <Pressable
                                    key={String(p.id)}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: person?.id === p.id,
                                    }}
                                    onPress={() => {
                                      setPerson(p);
                                      if (!subject.trim()) setSubject(`Hello ${p.name.split(" ")[0]}!`);
                                      setRecipientOpen(false);
                                    }}
                                    style={[
                                      s.recipientChoice,
                                      person?.id === p.id && {
                                        backgroundColor: "#05966920",
                                      },
                                    ]}
                                  >
                                    <Text style={[s.small, { color: ink }]}>
                                      {p.name}
                                      {p.address ? ` · ${p.address}` : ""}
                                    </Text>
                                    {person?.id === p.id && <Check size={16} color="#059669" /> }
                                  </Pressable>
                                ))}
                              </ScrollView>
                              </Animated.View>
                            )}
                          </View>
                        </>
                      )}
                      <Text style={[s.rowTitle, { color: muted }]}>
                        Subject
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
                      <Text style={[s.rowTitle, { color: muted }]}>
                        Message
                      </Text>
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
                            if (!subject.trim()) throw new Error("Enter a subject for your message.");
                            if (category === "friend" && !person)
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
                          <View style={[panel, { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Avatar resident={conversation.recipient} size={36} />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[s.rowTitle, { color: ink }]}>{conversation.name}</Text>
                                <Text style={[s.small, { color: muted }]}>{conversation.category === "maintenance" ? "Maintenance Team" : conversation.category === "office" ? "Community Office" : "Resident Friend"}</Text>
                              </View>
                              <Pressable accessibilityRole="button" accessibilityLabel="Delete conversation" onPress={() => { setDeleting(conversation); go("inbox"); }} style={{ padding: 8 }}>
                                <Trash2 size={18} color={muted} />
                              </Pressable>
                            </View>
                            <Text style={[s.small, { color: muted }]}>{conversation.subject}</Text>
                            {!!conversation.recipient.phone && (
                              <Pressable accessibilityRole="button" accessibilityLabel="Copy phone" onPress={() => void act(() => copy(conversation.recipient.phone!))}>
                                <Text style={[s.small, { color: "#059669" }]}>Tel: {conversation.recipient.phone} · Copy Phone</Text>
                              </Pressable>
                            )}
                          </View>
                          {data.errors.map((message) => <Text key={message} style={s.error}>{message}</Text>)}
                          {data.errors.length > 0 && <Action title="Retry messages" onPress={data.retry} />}
                          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={[panel, { flex: 1, borderRadius: 16 }]} contentContainerStyle={{ padding: 10, gap: 8 }}>
                          {conversation.messages.length === 0 && <Text style={[s.empty, { color: muted }]}>No messages yet. Start the conversation below.</Text>}
                          {conversation.messages.map((m) => {
                            const mine = messageIsMine(m, user);
                            const avatar = messageAvatar(m, [
                              user,
                              ...data.directory.items,
                            ]);
                            const read = (m.readBy?.length || 0) > 0;
                            const role = m.senderRole;
                            const badge =
                              role === "crew"
                                ? require("../../assets/crew-badge.png")
                                : role === "admin" || role === "vip"
                                  ? require("../../assets/vip-badge.png")
                                  : null;
                            const label = mine
                              ? "You"
                              : senderLabel(m, conversation.category, user);
                            return (
                              <View
                                key={m.id}
                                style={{
                                  flexDirection: mine ? "row-reverse" : "row",
                                  alignItems: "flex-end",
                                  gap: 9,
                                  marginVertical: 3,
                                }}
                              >
                                <View style={{ width: 36, height: 40 }}>
                                  <View
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 18,
                                      backgroundColor: dark
                                        ? "#334155"
                                        : "#e7e5e4",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {avatar ? (
                                      <Image
                                        source={{ uri: avatar }}
                                        style={{ width: 36, height: 36 }}
                                      />
                                    ) : (
                                      <Text style={[s.small, { color: ink }]}>
                                        {label.slice(0, 1).toUpperCase()}
                                      </Text>
                                    )}
                                  </View>
                                  {badge && (
                                    <Image
                                      accessibilityLabel={
                                        role === "crew"
                                          ? "Crew badge"
                                          : "Staff badge"
                                      }
                                      source={badge}
                                      style={{
                                        position: "absolute",
                                        left: -2,
                                        bottom: -2,
                                        width: 24,
                                        height: 24,
                                      }}
                                    />
                                  )}
                                </View>
                                <View
                                  style={{
                                    maxWidth: "80%",
                                    padding: 13,
                                    gap: 6,
                                    borderRadius: 18,
                                    borderBottomRightRadius: mine ? 4 : 18,
                                    borderBottomLeftRadius: mine ? 18 : 4,
                                    backgroundColor: mine
                                      ? dark
                                        ? "#064e3b"
                                        : "#d1fae5"
                                      : dark
                                        ? "#334155"
                                        : "#fff",
                                    borderWidth: 1,
                                    borderColor: mine
                                      ? "#05966940"
                                      : "#78716c25",
                                  }}
                                >
                                  <Text
                                    style={[
                                      s.small,
                                      {
                                        color: mine
                                          ? dark
                                            ? "#6ee7b7"
                                            : "#047857"
                                          : muted,
                                        fontFamily: "JakartaBold",
                                      },
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                  <Text style={[s.message, { color: ink }]}>
                                    {m.body}
                                  </Text>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: "flex-end",
                                      gap: 5,
                                    }}
                                  >
                                    <Text
                                      style={{ color: muted, fontSize: 10 }}
                                    >
                                      {new Date(m.createdAt).toLocaleTimeString(
                                        [],
                                        { hour: "numeric", minute: "2-digit" },
                                      )}
                                    </Text>
                                    {mine && (
                                      <View
                                        accessibilityLabel={
                                          read ? "Read by recipient" : "Sent"
                                        }
                                      >
                                        {read ? (
                                          <CheckCheck
                                            size={16}
                                            color="#0284c7"
                                          />
                                        ) : (
                                          <Check size={16} color={muted} />
                                        )}
                                      </View>
                                    )}
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                          </ScrollView>
                          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                          <TextInput
                            accessibilityLabel="Reply"
                            placeholder="Write a reply…"
                            placeholderTextColor={muted}
                            multiline
                            value={body}
                            onChangeText={setBody}
                            maxLength={10000}
                            style={[...textInput, { flex: 1, maxHeight: 100 }]}
                          />
                          <Action
                            title={busy ? "Sending…" : "Send"}
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
                          </View>
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
                      {(
                        [
                          [
                            "Residency Address",
                            user.address || user.unit || "Not provided",
                            Home,
                            "#059669",
                          ],
                          [
                            "Resident Phone",
                            user.phone || "Not provided",
                            Phone,
                            "#059669",
                          ],
                          [
                            "Emergency Contact",
                            user.emergencyContact ||
                              user.emergency_contact ||
                              "Not provided",
                            Phone,
                            "#059669",
                          ],
                          [
                            "Dietary Preference",
                            user.dietaryPreference ||
                              user.dietary_preference ||
                              "Not provided",
                            Heart,
                            "#f43f5e",
                          ],
                          [
                            "Safety Check-In",
                            "Enrolled (Daily 9:00 AM)",
                            Shield,
                            "#f59e0b",
                          ],
                        ] as const
                      ).map(([label, value, Glyph, tone]) => (
                        <View
                          key={label}
                          style={[
                            panel,
                            {
                              padding: width >= 640 ? 16 : 14,
                              borderRadius: 16,
                              borderWidth: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            },
                          ]}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                              flexShrink: 1,
                            }}
                          >
                            <Glyph size={20} color={tone} />
                            <Text
                              style={{
                                fontFamily: "Jakarta",
                                fontSize: width >= 640 ? 14 : 12,
                                color: muted,
                                flexShrink: 1,
                              }}
                            >
                              {label}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontFamily: "JakartaBold",
                              fontSize: width >= 640 ? 14 : 12,
                              color:
                                label === "Safety Check-In" ? "#059669" : ink,
                              textAlign: "right",
                              maxWidth: "48%",
                            }}
                          >
                            {String(value)}
                          </Text>
                        </View>
                      ))}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          compose("office");
                          setSubject("Profile update request");
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          borderRadius: 16,
                          backgroundColor: dark ? "#1e293b" : "#1c1917",
                          alignItems: "center",
                          opacity: pressed ? 0.7 : 1,
                          marginTop: 8,
                        })}
                      >
                        <Text
                          style={{
                            fontFamily: "JakartaBold",
                            fontSize: width >= 640 ? 14 : 12,
                            color: "#fff",
                          }}
                        >
                          Request Profile Update
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => close(onAccount)}
                        style={{ alignItems: "center", padding: 8 }}
                      >
                        <Text
                          style={{
                            fontFamily: "JakartaBold",
                            fontSize: 12,
                            color: dark ? "#34d399" : "#047857",
                          }}
                        >
                          Open Account / Profile
                        </Text>
                      </Pressable>
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
                  {busy && <ActivityIndicator color="#059669" />}
                </ScrollView>
                {view === "inbox" && (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: width >= 640 ? 8 : 6,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderColor: dark ? "#1e293b" : "#d6d3d1",
                    }}
                  >
                    {(
                      [
                        ["office", "Msg Office", Building2, "#2563eb"],
                        ["maintenance", "Msg Crew", Wrench, "#d97706"],
                        ["friend", "Msg Friend", Users, "#059669"],
                      ] as const
                    ).map(([target, label, Glyph, tone]) => (
                      <Pressable
                        key={target}
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => compose(target)}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          gap: 4,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 8,
                          paddingHorizontal: 6,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tone + "44",
                          backgroundColor: dark ? tone + "22" : tone + "0d",
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Glyph size={14} color={tone} />
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: "JakartaBold",
                            fontSize: 12,
                            color: dark ? "#e2e8f0" : tone,
                            flexShrink: 1,
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </MenuStyle.Provider>
  );
}
const s = StyleSheet.create({
  composeHero: { padding: 20, borderRadius: 22, alignItems: "center", gap: 10 },
  recipientPanel: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  recipientChoice: {
    padding: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
