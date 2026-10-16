import { ScreenSystemBars } from "../components/SystemBars";
import {
  createContext,
  useMemo,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView, BlurView } from "expo-blur";
import { Home, FileText, Wrench, Users } from "lucide-react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback } from "react";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { PlayfairDisplay_900Black } from "@expo-google-fonts/playfair-display/900Black";
import Motion, {
  useSharedValue,
  useAnimatedStyle,
  Easing,
  withTiming,
  ReduceMotion,
} from "react-native-reanimated";
import { ProfileMenu } from "../profile/ProfileMenu";
import { useReducedMotion, useToday } from "../home/hooks";
import { parseDate } from "../home/model";
export type TabName = "index" | "news" | "workorders" | "social";
export const townLoopTabs = [
  { name: "index", label: "Home", icon: Home },
  { name: "news", label: "News", icon: FileText },
  { name: "workorders", label: "Work Orders", icon: Wrench },
  { name: "social", label: "Social", icon: Users },
] as const;
const Presentation = createContext<{
  dark: boolean;
  toggleTheme: () => void;
  blurTarget: RefObject<View | null> | undefined;
  attachBlurTarget: (target: RefObject<View | null>) => () => void;
} | null>(null);
export const usePresentation = () => useContext(Presentation);
export function TownLoopShell({
  name,
  role,
  photo,
  onAccount,
  children,
}: PropsWithChildren<{
  name: string;
  role: string;
  photo?: string;
  onAccount: () => void;
}>) {
  const { width } = useWindowDimensions();
  const framed = Platform.OS === "web" && width >= 640;
  const [dark, setDark] = useState(false);
  const [blurTarget, setBlurTarget] = useState<RefObject<View | null>>();
  const attachBlurTarget = useCallback((target: RefObject<View | null>) => {
    setBlurTarget(target);
    return () =>
      setBlurTarget((current) => (current === target ? undefined : current));
  }, []);
  const [fonts, fontError] = useFonts({
    NewsRegular: PlusJakartaSans_400Regular,
    NewsSemi: PlusJakartaSans_600SemiBold,
    NewsBold: PlusJakartaSans_700Bold,
    NewsExtra: PlusJakartaSans_800ExtraBold,
    NewsSerif: PlayfairDisplay_700Bold,
    Jakarta: PlusJakartaSans_400Regular,
    JakartaBold: PlusJakartaSans_700Bold,
    TicketDotrice: require("../../assets/fonts/Dotrice-Bold.otf"),
    JakartaSemi: PlusJakartaSans_600SemiBold,
    JakartaExtra: PlusJakartaSans_800ExtraBold,
    Playfair: PlayfairDisplay_700Bold,
    PlayfairBlack: PlayfairDisplay_900Black,
  });
  const presentation = useMemo(() => ({ dark, toggleTheme: () => setDark(v => !v), blurTarget, attachBlurTarget }), [dark, blurTarget, attachBlurTarget]);
  if (!fonts && !fontError)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f3ea",
        }}
      >
        <ActivityIndicator color="#047857" />
        <Text>Loading TownLoop…</Text>
      </View>
    );
  return (
    <Presentation.Provider
      value={presentation}
    >
      <ScreenSystemBars dark={dark} />
      <LinearGradient
        colors={
          dark ? ["#020617", "#0f172a"] : ["#faf6f0", "#f5ede2", "#e9decb"]
        }
        style={{
          flex: 1,
          paddingVertical: framed ? 24 : 0,
          paddingHorizontal: framed ? 16 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: dark ? "#020617" : "#f7f3ea",
            width: "100%",
            maxWidth: 448,
            alignSelf: "center",
            borderWidth: Platform.OS === "web" ? 1 : 0,
            borderColor: dark ? "#1e293b" : "#d8cdbc",
            borderRadius: framed ? 44 : 0,
            overflow: "hidden",
            boxShadow: framed
              ? "0px 24px 50px -12px rgba(110,85,60,0.12)"
              : undefined,
          }}
        >
          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={
                dark
                  ? ["#020617", "#0f172a"]
                  : ["#f7f3ea", "#f1ebe0", "#e8decb"]
              }
              style={{ flex: 1 }}
            >
              <PortalHeader
                name={name}
                role={role}
                photo={photo}
                onAccount={onAccount}
              />
              <View style={{ flex: 1 }}>{children}</View>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </Presentation.Provider>
  );
}
export function PortalHeader({
  name,
  role,
  photo,
  onAccount,
}: {
  name: string;
  role: string;
  photo?: string;
  onAccount: () => void;
}) {
  const presentation = usePresentation();
  const dark = presentation?.dark ?? false;
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const reducedAvatarMotion = useReducedMotion();
  const avatarCircleScale = useSharedValue(1),
    avatarScale = useSharedValue(1),
    avatarTilt = useSharedValue(0),
    avatarSheen = useSharedValue(0);
  const hover = useRef(false);
  function avatarFeedback(pressed = false) {
    const duration = reducedAvatarMotion ? 0 : 300;
    avatarScale.set(
      withTiming(pressed ? 0.9 : 1, {
        duration,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        reduceMotion: reducedAvatarMotion
          ? ReduceMotion.Always
          : ReduceMotion.System,
      }),
    );
    avatarCircleScale.set(
      withTiming(pressed ? 0.95 : hover.current ? 1.05 : 1, {
        duration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
    );
    avatarTilt.set(
      withTiming(pressed ? -2 : 0, {
        duration,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      }),
    );
    avatarSheen.set(
      withTiming(hover.current ? 1 : 0, {
        duration: reducedAvatarMotion ? 0 : 300,
      }),
    );
  }
  const avatarMotion = useAnimatedStyle(() => ({
    transform: [
      { scale: avatarScale.value },
      { rotate: `${avatarTilt.value}deg` },
    ],
  }));
  const avatarCircleMotion = useAnimatedStyle(() => ({
    transform: [{ scale: avatarCircleScale.value }],
  }));
  const avatarLight = useAnimatedStyle(() => ({ opacity: avatarSheen.value }));
  const today = useToday();
  const ink = dark ? "#fff" : "#0f172a";
  const label =
    role === "crew"
      ? "Maintenance Crew"
      : role === "vip"
        ? "VIP"
        : role === "admin"
          ? "Admin"
          : role === "staff"
            ? "Staff"
            : "";
  const roleTone =
    role === "crew"
      ? ["#dbeafe", "#1e3a8a", "#93c5fd"]
      : role === "vip"
        ? ["#f3e8ff", "#581c87", "#d8b4fe"]
        : role === "staff"
          ? ["#e0e7ff", "#312e81", "#a5b4fc"]
          : ["#fef3c7", "#78350f", "#fcd34d"];
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{
        backgroundColor: dark ? "#020617e6" : "#f7f3eae6",
        borderBottomWidth: 1,
        borderColor: dark ? "#1e293bcc" : "#d8cdbcb3",
      }}
    >
      <View
        style={{
          paddingTop: 24,
          paddingHorizontal: 24,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "PlayfairBlack",
              fontSize: 30,
              lineHeight: 30,
              letterSpacing: -0.75,
              color: ink,
            }}
          >
            Good Morning,
          </Text>
          <Text
            style={{
              fontFamily: "Playfair",
              fontSize: 30,
              lineHeight: 29,
              marginTop: 4,
              letterSpacing: -0.75,
              color: dark ? "#34d399" : "#000",
            }}
          >
            {name.split(" ")[0] || "Resident"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{
                fontFamily: "JakartaSemi",
                fontSize: 13,
                lineHeight: 20,
                letterSpacing: 0.65,
                textTransform: "uppercase",
                color: dark ? "#94a3b8" : "#000",
              }}
            >
              {parseDate(today).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
            {!!label && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: roleTone[2],
                  backgroundColor: roleTone[0],
                }}
              >
                <Image
                  source={
                    role === "crew"
                      ? require("../../assets/crew-badge.png")
                      : require("../../assets/vip-badge.png")
                  }
                  style={{ width: 14, height: 14 }}
                />
                <Text
                  style={{
                    fontFamily: "JakartaExtra",
                    fontSize: 10,
                    lineHeight: 15,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: roleTone[1],
                  }}
                >
                  {label}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Motion.View style={avatarMotion}>
          <Pressable
            onHoverIn={() => {
              hover.current = true;
              setAvatarHovered(true);
              avatarFeedback();
            }}
            onHoverOut={() => {
              hover.current = false;
              setAvatarHovered(false);
              avatarFeedback();
            }}
            onPressIn={() => avatarFeedback(true)}
            onPressOut={() => avatarFeedback()}
            accessibilityRole="button"
            accessibilityLabel={`Open Resident Profile & Menu${unread ? `, ${unread} unread messages` : ""}`}
            hitSlop={8}
            onPress={() => setMenu(true)}
            style={{
              width: 64,
              height: 64,
            }}
          >
            <Motion.View style={avatarCircleMotion}>
              <LinearGradient
                colors={dark ? ["#1e293b", "#334155"] : ["#f5f5f4", "#e7e5e4"]}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderWidth: 2,
                  borderColor: avatarHovered
                    ? "#10b981cc"
                    : dark
                      ? "#a7f3d0aa"
                      : "#05966966",
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: avatarHovered
                    ? "0px 4px 8px rgba(0,0,0,0.12)"
                    : "0px 1px 2px rgba(0,0,0,0.1)",
                }}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <Text
                    style={{
                      fontFamily: "JakartaBold",
                      fontSize: 20,
                      lineHeight: 24,
                      textAlign: "center",
                      includeFontPadding: false,
                      color: dark ? "#cbd5e1" : "#57534e",
                    }}
                  >
                    {(name.trim().includes(" ")
                      ? name
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                      : name.slice(0, 2)
                    ).toUpperCase() || "RE"}
                  </Text>
                )}
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: "#0478571a" },
                  ]}
                />
                <Motion.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, avatarLight]}
                >
                  <LinearGradient
                    colors={["#ffffff00", "#ffffff40", "#ffffff00"]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Motion.View>
              </LinearGradient>
            </Motion.View>
            {!!label && (
              <Image
                source={
                  role === "crew"
                    ? require("../../assets/crew-badge.png")
                    : require("../../assets/vip-badge.png")
                }
                style={{
                  position: "absolute",
                  bottom: -2,
                  left: -2,
                  width: 24,
                  height: 24,
                }}
              />
            )}
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 3,
                borderColor: "#fff",
                backgroundColor: "#10b981",
                boxShadow: "0px 1px 3px rgba(0,0,0,0.15)",
              }}
            />
            {unread > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 4,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: "#fff",
                  backgroundColor: "#e11d48",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "JakartaBold",
                    fontSize: 10,
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </Pressable>
        </Motion.View>
      </View>
      <ProfileMenu
        open={menu}
        onClose={() => setMenu(false)}
        onAccount={onAccount}
        onUnread={setUnread}
      />
    </SafeAreaView>
  );
}
// The scene owns the Android blur surface; the dock is rendered after it.
export function BlurScene({ children }: PropsWithChildren) {
  const focused = useIsFocused();
  const attach = usePresentation()?.attachBlurTarget;
  const target = useRef<View | null>(null);
  useFocusEffect(useCallback(() => attach?.(target), [attach]));
  return (
    <BlurTargetView
      ref={target}
      pointerEvents={focused ? "auto" : "none"}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? "auto" : "no-hide-descendants"}
      style={{ flex: 1, display: focused ? "flex" : "none" }}
    >
      {children}
    </BlurTargetView>
  );
}
export function FloatingDock({
  active,
  onSelect,
  onLongPress,
}: {
  active: TabName;
  onSelect: (name: TabName) => void;
  onLongPress?: (name: TabName) => void;
}) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const p = usePresentation();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<TabName, { x: number; width: number }>>>({});
  // Preserve the bubble's dimensions, but center it on the actual Yoga layout.
  const bubbleWidth = (width - 20) / 4 + (active === "workorders" ? 20 : 8);
  const selectedLayout = tabLayouts[active];
  const targetX = selectedLayout
    ? selectedLayout.x + selectedLayout.width / 2 - bubbleWidth / 2
    : null;
  const positioned = useRef(false);
  const [position] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (targetX === null) return;
    const motion = Animated.spring(position, {
      toValue: targetX,
      stiffness: 420,
      damping: 30,
      mass: 1,
      useNativeDriver: true,
    });
    if (reduced || !positioned.current) position.setValue(targetX);
    else motion.start();
    positioned.current = true;
    return () => motion.stop();
  }, [targetX, position, reduced]);
  const dark = p?.dark;
  if (keyboard) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 20 + insets.bottom,
        alignSelf: "center",
        width: "92%",
        maxWidth: 430,
        zIndex: 30,
      }}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          borderRadius: 99,
          boxShadow:
            "0px 18px 36px -8px rgba(0,10,30,0.22), 0px 6px 12px -3px rgba(0,0,0,0.1)",
        }}
      >
        <View
          style={{
            borderRadius: 99,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: dark ? "#ffffff33" : "#ffffff66",
            boxShadow: dark
              ? "inset 0px 1px 1px rgba(255,255,255,0.35), inset 0px -1px 1.5px rgba(255,255,255,0.1)"
              : "inset 0px 1px 1px rgba(255,255,255,0.75), inset 0px -1px 1.5px rgba(255,255,255,0.25)",
          }}
        >
          {!!p?.blurTarget && (
            <BlurView
              blurTarget={p?.blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={45}
              tint={dark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={
              dark
                ? ["#ffffff1a", "#ffffff05", "#ffffff01", "#ffffff12"]
                : ["#ffffff38", "#ffffff0f", "#ffffff05", "#ffffff1f"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={
              dark
                ? ["#ffffff40", "#ffffff0d", "#ffffff00"]
                : ["#ffffff73", "#ffffff14", "#ffffff00"]
            }
            style={{
              position: "absolute",
              top: 1,
              left: "6%",
              right: "6%",
              height: "35%",
              borderRadius: 99,
            }}
          />
          <LinearGradient
            pointerEvents="none"
            colors={
              dark
                ? ["#ffffff59", "#ffffff1a", "#ffffff00"]
                : ["#ffffff8c", "#ffffff2e", "#ffffff00"]
            }
            start={{ x: 1, y: 0 }}
            end={{ x: 0.1, y: 0.9 }}
            style={{
              position: "absolute",
              top: 1,
              right: "6%",
              width: "44%",
              height: "68%",
              borderRadius: 99,
            }}
          />
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              flexDirection: "row",
            }}
          >
            {width > 0 && selectedLayout && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: bubbleWidth,
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: dark ? "#ffffff2e" : "#ffffff59",
                  overflow: "hidden",
                  transform: [
                    { translateX: position },
                  ],
                  boxShadow: "0px 4px 14px -2px rgba(0,0,0,0.1)",
                }}
              >
                <LinearGradient
                  colors={
                    dark
                      ? ["#ffffff24", "#ffffff0a", "#ffffff17"]
                      : ["#ffffff59", "#ffffff1a", "#ffffff38"]
                  }
                  style={{ flex: 1 }}
                />
              </Animated.View>
            )}
            {townLoopTabs.map(({ name, label, icon: Icon }) => (
              <Pressable
                key={name}
                onLayout={({ nativeEvent: { layout } }) => {
                  setTabLayouts(previous => {
                    const old = previous[name];
                    if (old?.x === layout.x && old.width === layout.width) return previous;
                    return { ...previous, [name]: { x: layout.x, width: layout.width } };
                  });
                }}
                accessibilityRole="tab"
                accessibilityLabel={`${label} tab`}
                accessibilityState={{ selected: active === name }}
                hitSlop={{ top: 4, bottom: 4 }}
                onPress={() => onSelect(name)}
                onLongPress={() => onLongPress?.(name)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: active === name ? 1.05 : 1 }],
                })}
              >
                <Icon
                  size={20}
                  strokeWidth={2.2}
                  color={
                    dark
                      ? active === name
                        ? "#fff"
                        : "#cbd5e1"
                      : active === name
                        ? "#0f172a"
                        : "#334155"
                  }
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "JakartaExtra",
                    fontSize: 12,
                    lineHeight: 16,
                    letterSpacing: -0.3,
                    color: dark
                      ? active === name
                        ? "#fff"
                        : "#cbd5e1"
                      : active === name
                        ? "#0f172a"
                        : "#334155",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
