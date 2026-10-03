import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  Animated,
  Image,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView, BlurView } from "expo-blur";
import {
  Home,
  FileText,
  Wrench,
  Users,
  Moon,
  Sun,
  User,
  X,
} from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { PlayfairDisplay_900Black } from "@expo-google-fonts/playfair-display/900Black";
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
  blurTarget: RefObject<View | null>;
  attachBlurTarget: (node: View | null) => () => void;
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
  const scheme = useColorScheme();
  const [dark, setDark] = useState(scheme === "dark");
  const blurTarget = useRef<View | null>(null);
  const attachBlurTarget = useCallback((node: View | null) => {
    blurTarget.current = node;
    return () => {
      if (blurTarget.current === node) blurTarget.current = null;
    };
  }, []);
  useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaSemi: PlusJakartaSans_600SemiBold,
    JakartaExtra: PlusJakartaSans_800ExtraBold,
    Playfair: PlayfairDisplay_700Bold,
    PlayfairBlack: PlayfairDisplay_900Black,
  });
  return (
    <Presentation.Provider
      value={{
        dark,
        toggleTheme: () => setDark((v) => !v),
        blurTarget,
        attachBlurTarget,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: dark ? "#020617" : "#f7f3ea",
          width: "100%",
          maxWidth: 448,
          alignSelf: "center",
          borderWidth: 1,
          borderColor: dark ? "#1e293b" : "#d8cdbc",
        }}
      >
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={
              dark ? ["#020617", "#0f172a"] : ["#f7f3ea", "#f1ebe0", "#e8decb"]
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Resident Profile & Menu"
          hitSlop={8}
          onPress={() => setMenu(true)}
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#f5f5f4", "#e7e5e4"]}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 2,
              borderColor: "#05966966",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
            ) : (
              <Text
                style={{
                  fontFamily: "JakartaBold",
                  fontSize: 14,
                  color: "#57534e",
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
          </LinearGradient>
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
        </Pressable>
      </View>
      {menu && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setMenu(false)}
        >
          <Pressable
            accessibilityLabel="Close profile menu"
            onPress={() => setMenu(false)}
            style={{
              flex: 1,
              backgroundColor: "#0c0a0966",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                padding: 20,
                borderRadius: 24,
                backgroundColor: dark ? "#0f172a" : "#fff",
                gap: 12,
                maxWidth: 390,
                width: "100%",
                alignSelf: "center",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontFamily: "Playfair", fontSize: 20, color: ink }}
                >
                  {name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={12}
                  onPress={() => setMenu(false)}
                >
                  <X size={18} color={ink} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenu(false);
                  onAccount();
                }}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <User size={18} color="#059669" />
                <Text style={{ fontFamily: "JakartaBold", color: ink }}>
                  Your account
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  dark
                    ? "Switch to light appearance"
                    : "Switch to dark appearance"
                }
                onPress={() => {
                  presentation?.toggleTheme();
                  setMenu(false);
                }}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {dark ? (
                  <Sun size={18} color="#059669" />
                ) : (
                  <Moon size={18} color="#059669" />
                )}
                <Text style={{ fontFamily: "JakartaBold", color: ink }}>
                  {dark ? "Light appearance" : "Dark appearance"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
// The scene owns the Android blur surface; the dock is rendered after it.
export function BlurScene({ children }: PropsWithChildren) {
  const p = usePresentation();
  const target = useRef<View | null>(null);
  useFocusEffect(useCallback(() => p?.attachBlurTarget(target.current), [p]));
  return (
    <BlurTargetView ref={target} style={{ flex: 1 }}>
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
  const index = townLoopTabs.findIndex((t) => t.name === active);
  const [position] = useState(() => new Animated.Value(index));
  useEffect(() => {
    const motion = Animated.spring(position, {
      toValue: index,
      stiffness: 420,
      damping: 30,
      mass: 1,
      useNativeDriver: true,
    });
    if (reduced) position.setValue(index);
    else motion.start();
    return () => motion.stop();
  }, [index, position, reduced]);
  const cell = (width - 20) / 4;
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
            borderColor: dark ? "#ffffff2e" : "#ffffff66",
          }}
        >
          <BlurView
            blurTarget={p?.blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={45}
            tint={dark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={
              dark
                ? ["#ffffff24", "#ffffff0a", "#ffffff17"]
                : ["#ffffff38", "#ffffff0f", "#ffffff05", "#ffffff1f"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              flexDirection: "row",
            }}
          >
            {width > 0 && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 6,
                  top: 4,
                  bottom: 4,
                  width: cell + 8,
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: dark ? "#ffffff2e" : "#ffffff59",
                  overflow: "hidden",
                  transform: [
                    { translateX: Animated.multiply(position, cell) },
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
                    dark ? "#fff" : active === name ? "#0f172a" : "#334155"
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
                      ? "#fff"
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
