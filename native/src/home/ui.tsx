import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { X, type LucideIcon } from "lucide-react-native";
import { useReducedMotion } from "./hooks";
export const Theme = createContext(false);
export function usePalette() {
  return useContext(Theme)
    ? {
        ink: "#f1f5f9",
        muted: "#94a3b8",
        paper: "#0f172a",
        line: "#334155",
        green: "#34d399",
        blue: "#93c5fd",
        bg: "#020617",
      }
    : {
        ink: "#1e293b",
        muted: "#64748b",
        paper: "#ffffff",
        line: "#dbe5e9",
        green: "#047857",
        blue: "#026aa7",
        bg: "#f7f3ea",
      };
}
export function Txt({
  style,
  bold = false,
  ...props
}: TextProps & { bold?: boolean }) {
  const p = usePalette();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: bold ? "JakartaBold" : "Jakarta",
          fontSize: 14,
          lineHeight: 21,
          color: p.ink,
        },
        style,
      ]}
    />
  );
}
export function Row({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Tile({
  children,
  tone = "blue",
}: PropsWithChildren<{ tone?: "blue" | "green" }>) {
  const dark = useContext(Theme);
  return (
    <LinearGradient
      colors={
        dark
          ? ["#0f172a", "#020617"]
          : tone === "green"
            ? ["#f2f7f4", "#e8f1ec"]
            : ["#f0f6fc", "#e1edf8"]
      }
      style={{
        padding: 20,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: dark
          ? "#1e293b"
          : tone === "green"
            ? "#bbdfca"
            : "#bcd6ee",
        gap: 14,
      }}
    >
      {children}
    </LinearGradient>
  );
}
export function Box({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line,
          backgroundColor: p.paper,
          gap: 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Action({
  label,
  onPress,
  icon: Icon,
  active = false,
  color,
  disabled = false,
  iconOnly = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  active?: boolean;
  color?: string;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  const p = usePalette();
  const tint = color || p.green;
  const fill =
    tint === p.blue ? "#026aa7" : tint === p.green ? "#047857" : tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      aria-selected={active}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 48,
        minHeight: 48,
        paddingHorizontal: iconOnly ? 10 : 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? tint : p.line,
        backgroundColor: active ? fill : p.paper,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        flexShrink: 1,
      })}
    >
      {Icon && <Icon size={18} color={active ? "#fff" : tint} />}
      {!iconOnly && (
        <Txt
          bold
          style={{ color: active ? "#fff" : tint, flexShrink: 1, fontSize: 13 }}
        >
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Txt bold>{label}</Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={p.muted}
        style={{
          fontFamily: "Jakarta",
          fontSize: 16,
          minHeight: 50,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.line,
          color: p.ink,
          backgroundColor: p.paper,
          padding: 12,
          textAlignVertical: props.multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const progress = useState(() => new Animated.Value(0))[0];
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduced]);
  const close = () => {
    if (closing) return;
    setClosing(true);
    Animated.timing(progress, {
      toValue: 0,
      duration: reduced ? 0 : 220,
      useNativeDriver: true,
    }).start(onClose);
  };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60 || g.vy > 0.25) close();
    },
  });
  return (
    <Modal transparent visible onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(12,10,9,.65)", opacity: progress },
            ]}
          >
            <Pressable
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss dialog"
              onPress={close}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            style={{
              maxHeight: "92%",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              backgroundColor: p.paper,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                },
              ],
            }}
          >
            <SafeAreaView
              edges={["bottom", "left", "right"]}
              style={{ flexShrink: 1 }}
            >
              <View
                {...pan.panHandlers}
                style={{ alignItems: "center", padding: 12 }}
              >
                <View
                  style={{
                    width: 48,
                    height: 5,
                    borderRadius: 5,
                    backgroundColor: p.line,
                  }}
                />
              </View>
              <Row
                style={{
                  paddingHorizontal: 20,
                  justifyContent: "space-between",
                }}
              >
                <Txt
                  bold
                  accessibilityRole="header"
                  style={{ fontSize: 18, flex: 1 }}
                >
                  {title}
                </Txt>
                <Action
                  icon={X}
                  iconOnly
                  label={`Close ${title}`}
                  onPress={close}
                />
              </Row>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0, flexShrink: 1 }}
                contentContainerStyle={{ padding: 20, gap: 16 }}
              >
                {children}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
