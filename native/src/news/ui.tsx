import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, ChevronDown, type LucideIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { useReducedMotion } from "../home/hooks";
export const palette = {
  ink: "#1c1917",
  muted: "#78716c",
  green: "#047857",
  line: "#e7e5e4",
  paper: "#fff",
  bg: "#faf8f4",
};
export function useNewsFonts() {
  return useFonts({
    NewsRegular: PlusJakartaSans_400Regular,
    NewsSemi: PlusJakartaSans_600SemiBold,
    NewsBold: PlusJakartaSans_700Bold,
    NewsExtra: PlusJakartaSans_800ExtraBold,
    NewsSerif: PlayfairDisplay_700Bold,
  });
}
export function Copy({
  style,
  weight = "regular",
  ...props
}: TextProps & { weight?: "regular" | "semi" | "bold" | "extra" | "serif" }) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: {
            regular: "NewsRegular",
            semi: "NewsSemi",
            bold: "NewsBold",
            extra: "NewsExtra",
            serif: "NewsSerif",
          }[weight],
          color: palette.ink,
          fontSize: 12,
          lineHeight: 18,
        },
        style,
      ]}
    />
  );
}
export function Action({
  label,
  icon: Icon,
  onPress,
  disabled = false,
  tone = "green",
  compact = false,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  tone?: "green" | "glass" | "sky" | "amber" | "rose" | "light" | "dark";
  compact?: boolean;
}) {
  const tones = {
    green: ["#047857", "#fff"],
    glass: ["#ffffff30", "#fff"],
    sky: ["#0284c7", "#fff"],
    amber: ["#b45309", "#fff"],
    rose: ["#4c0519", "#fecdd3"],
    light: ["#d1fae5", "#064e3b"],
    dark: ["#292524", "#e7e5e4"],
  };
  const [bg, fg] = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={compact ? 5 : 2}
      style={({ pressed }) => ({
        minHeight: compact && tone === "rose" ? 30 : 36,
        paddingHorizontal: compact ? 12 : 14,
        paddingVertical: compact && tone === "rose" ? 5 : 8,
        borderRadius: compact ? 12 : 16,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: tone === "glass" ? "#ffffff33" : bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {Icon && <Icon size={15} color={fg} />}
      <Copy weight="bold" style={{ color: fg, flexShrink: 1 }}>
        {label}
      </Copy>
    </Pressable>
  );
}
export function IconAction({
  label,
  icon: Icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed ? "#ecfdf5" : "transparent",
      })}
    >
      <Icon size={16} color="#78716c" />
    </Pressable>
  );
}
export function Badge({
  children,
  tone = "green",
}: PropsWithChildren<{ tone?: "green" | "amber" | "sky" }>) {
  const c = {
    green: ["#ecfdf5", "#065f46", "#a7f3d0"],
    amber: ["#fffbeb", "#92400e", "#fde68a"],
    sky: ["#082f49", "#7dd3fc", "#075985"],
  }[tone];
  return (
    <View
      style={{
        backgroundColor: c[0],
        borderColor: c[2],
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Copy weight="semi" style={{ fontSize: 10, lineHeight: 14, color: c[1] }}>
        {children}
      </Copy>
    </View>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Copy
        weight="bold"
        style={{ textTransform: "uppercase", color: "#57534e" }}
      >
        {label}
      </Copy>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#a8a29e"
        style={[
          s.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          style,
        ]}
      />
    </View>
  );
}
export function Choices({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Copy weight="bold">{label}</Copy>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.input, s.row, { justifyContent: "space-between" }]}
      >
        <Copy weight="semi">{value || "Choose"}</Copy>
        <ChevronDown size={16} color="#78716c" />
      </Pressable>
      {open && (
        <View style={[s.card, { gap: 4 }]}>
          {values.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ checked: v === value }}
              onPress={() => {
                onChange(v);
                setOpen(false);
              }}
              style={{
                padding: 12,
                backgroundColor: v === value ? "#ecfdf5" : "#fff",
                borderRadius: 10,
              }}
            >
              <Copy>{v}</Copy>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
export function NewsDialog({
  title,
  subtitle,
  onClose,
  children,
  busy = false,
  tone,
  icon: HeaderIcon,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  tone?: "green" | "amber";
  icon?: LucideIcon;
}>) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [progress, reduced]);
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0c0a09a6",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <Pressable
            accessibilityLabel="Close dialog"
            disabled={busy}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={{
              maxHeight: "92%",
              width: "100%",
              maxWidth: 512,
              alignSelf: "center",
              borderRadius: 24,
              backgroundColor: "#fff",
              overflow: "hidden",
              opacity: progress,
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.84, 1],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
              ],
            }}
          >
            <SafeAreaView edges={["bottom"]} style={{ flexShrink: 1 }}>
              <LinearGradient
                colors={
                  tone === "amber"
                    ? ["#92400e", "#b45309"]
                    : tone === "green"
                      ? ["#065f46", "#115e59"]
                      : ["#fff", "#fff"]
                }
                style={[
                  s.row,
                  {
                    padding: 20,
                    flexWrap: "nowrap",
                    borderBottomWidth: 1,
                    borderColor: palette.line,
                  },
                ]}
              >
                {HeaderIcon && (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 16,
                      backgroundColor: "#ffffff1a",
                      borderWidth: 1,
                      borderColor: "#ffffff33",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <HeaderIcon
                      size={20}
                      color={tone === "amber" ? "#fde68a" : "#6ee7b7"}
                    />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Copy
                    weight="serif"
                    style={{
                      fontSize: 18,
                      lineHeight: 25,
                      color: tone ? "#fff" : palette.ink,
                    }}
                  >
                    {title}
                  </Copy>
                  {subtitle && (
                    <Copy
                      style={{
                        fontSize: 11,
                        lineHeight: 16,
                        color:
                          tone === "amber"
                            ? "#fef3c7"
                            : tone
                              ? "#a7f3d0"
                              : palette.muted,
                      }}
                    >
                      {subtitle}
                    </Copy>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  disabled={busy}
                  hitSlop={6}
                  onPress={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#ffffff1a",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} color={tone ? "#fff" : palette.muted} />
                </Pressable>
              </LinearGradient>
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
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[s.card, { borderColor: "#fecaca", gap: 10 }]}
    >
      <Copy style={{ color: "#9f1239" }}>{message}</Copy>
      {retry && <Action label="Try again" onPress={retry} />}
    </View>
  );
}
export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.04)",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 12,
    padding: 12,
    fontFamily: "NewsRegular",
    fontSize: 14,
    color: palette.ink,
    backgroundColor: "#fafaf9",
  },
});
