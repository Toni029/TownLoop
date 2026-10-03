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
import {
  X,
  ChevronDown,
  Upload,
  Camera,
  type LucideIcon,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { PlayfairDisplay_800ExtraBold } from "@expo-google-fonts/playfair-display/800ExtraBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { usePresentation } from "../shell/TownLoopShell";
import { useReducedMotion } from "../home/hooks";
export const palette = {
  ink: "#1c1917",
  muted: "#78716c",
  green: "#047857",
  line: "#e7e5e4",
  paper: "#fff",
  bg: "#faf8f4",
};
export function useNewsStyles() {
  const dark = !!usePresentation()?.dark;
  return dark
    ? {
        ...s,
        card: { ...s.card, backgroundColor: "#0f172a", borderColor: "#1e293b" },
        input: {
          ...s.input,
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          color: "#f1f5f9",
        },
      }
    : s;
}
const darkText: Record<string, string> = {
  "#1c1917": "#fff",
  "#0f172a": "#f1f5f9",
  "#1e293b": "#f1f5f9",
  "#44403c": "#cbd5e1",
  "#57534e": "#cbd5e1",
  "#64748b": "#94a3b8",
  "#78716c": "#94a3b8",
  "#a8a29e": "#64748b",
};
export function useNewsFonts() {
  return useFonts({
    NewsRegular: PlusJakartaSans_400Regular,
    NewsSemi: PlusJakartaSans_600SemiBold,
    NewsBold: PlusJakartaSans_700Bold,
    NewsExtra: PlusJakartaSans_800ExtraBold,
    NewsSerif: PlayfairDisplay_700Bold,
    NewsSerifExtra: PlayfairDisplay_800ExtraBold,
  });
}
export function Copy({
  style,
  weight = "regular",
  ...props
}: TextProps & { weight?: "regular" | "semi" | "bold" | "extra" | "serif" }) {
  const dark = !!usePresentation()?.dark;
  const color = StyleSheet.flatten(style)?.color;
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
        dark && {
          color:
            typeof color === "string" ? darkText[color] || color : "#f1f5f9",
        },
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
  square = false,
  size = "default",
  radius,
  maxWidth,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  tone?:
    "green" | "emerald" | "glass" | "sky" | "amber" | "rose" | "light" | "dark";
  compact?: boolean;
  square?: boolean;
  size?: "default" | "small" | "short" | "large";
  radius?: number;
  maxWidth?: number;
}) {
  const dark = !!usePresentation()?.dark;
  const tones = {
    green: ["#047857", "#fff"],
    emerald: ["#059669", "#fff"],
    glass: ["#ffffff30", "#fff"],
    sky: ["#0284c7", "#fff"],
    amber: ["#b45309", "#fff"],
    rose: ["#4c0519", "#fecdd3"],
    light: dark ? ["#022c22", "#d1fae5"] : ["#d1fae5", "#064e3b"],
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
      hitSlop={compact && tone === "rose" ? 9 : 6}
      style={({ pressed }) => ({
        minHeight:
          size === "large"
            ? 44
            : size === "small"
              ? 32
              : size === "short"
                ? 28
                : compact && tone === "rose"
                  ? 30
                  : 36,
        paddingHorizontal: compact ? 12 : 14,
        paddingVertical:
          size === "large"
            ? 11
            : size === "small"
              ? 7
              : size === "short"
                ? 5
                : compact && tone === "rose"
                  ? 5
                  : 8,
        borderRadius: radius ?? (compact || square ? 12 : 99),
        maxWidth,
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
      <Copy
        weight="bold"
        style={{
          color: fg,
          flexShrink: 1,
          fontSize: size === "large" ? 14 : 12,
          lineHeight: size === "large" ? 20 : size === "default" ? 18 : 16,
        }}
      >
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
  pill = false,
  uppercase = false,
}: PropsWithChildren<{
  tone?: "green" | "amber" | "sky";
  pill?: boolean;
  uppercase?: boolean;
}>) {
  const dark = !!usePresentation()?.dark;
  const c = {
    green: dark
      ? ["#022c22b3", "#a7f3d0", "#065f46"]
      : ["#ecfdf5", "#065f46", "#a7f3d0"],
    amber: dark
      ? ["#451a03b3", "#fcd34d", "#92400e"]
      : ["#fffbeb", "#92400e", "#fde68a"],
    sky: ["#082f49", "#7dd3fc", "#075985"],
  }[tone];
  return (
    <View
      style={{
        backgroundColor: c[0],
        borderColor: c[2],
        borderWidth: 1,
        borderRadius: tone === "sky" || pill ? 99 : 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Copy
        weight={uppercase ? "extra" : "semi"}
        style={{
          fontSize: 10,
          lineHeight: 14,
          color: c[1],
          textTransform: uppercase ? "uppercase" : "none",
          letterSpacing: uppercase ? 0.5 : 0,
        }}
      >
        {children}
      </Copy>
    </View>
  );
}
export function Field({
  label,
  style,
  labelCase = "upper",
  ...props
}: TextInputProps & { label: string; labelCase?: "upper" | "natural" }) {
  const styles = useNewsStyles();
  return (
    <View style={{ gap: 6 }}>
      <Copy
        weight="bold"
        style={{
          textTransform: labelCase === "upper" ? "uppercase" : "none",
          lineHeight: labelCase === "natural" ? 16 : 18,
          color: labelCase === "upper" ? "#57534e" : "#1c1917",
        }}
      >
        {label}
      </Copy>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#a8a29e"
        style={[
          styles.input,
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
  optionIcon,
}: {
  optionIcon?: (value: string) => string | undefined;
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useNewsStyles();
  const dark = !!usePresentation()?.dark;
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Copy weight="bold">{label}</Copy>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[
          styles.input,
          s.row,
          { justifyContent: "space-between" },
          !!optionIcon && { minHeight: 42, paddingVertical: 10 },
        ]}
      >
        <Copy
          weight={optionIcon ? "bold" : "semi"}
          style={optionIcon ? { fontSize: 14, lineHeight: 20 } : undefined}
        >
          {optionIcon?.(value)}
          {optionIcon?.(value) ? "  " : ""}
          {value || "Choose"}
        </Copy>
        <ChevronDown size={16} color="#78716c" />
      </Pressable>
      {open && (
        <View style={[styles.card, { gap: 4 }]}>
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
                backgroundColor:
                  v === value
                    ? dark
                      ? "#022c22"
                      : "#ecfdf5"
                    : dark
                      ? "#0f172a"
                      : "#fff",
                borderRadius: 10,
              }}
            >
              <Copy>
                {optionIcon?.(v)}
                {optionIcon?.(v) ? "  " : ""}
                {v}
              </Copy>
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
  const dark = !!usePresentation()?.dark;
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (busy || closing) return;
    setClosing(true);
    Animated.timing(progress, {
      toValue: 0,
      duration: reduced ? 0 : 200,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };
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
        if (!busy) close();
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
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={{
              maxHeight: "92%",
              width: "100%",
              maxWidth: 512,
              alignSelf: "center",
              borderRadius: 24,
              backgroundColor: dark ? "#0f172a" : "#fff",
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
                      : dark
                        ? ["#0f172a", "#0f172a"]
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
                  {!!subtitle && (
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
                  onPress={close}
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
  const styles = useNewsStyles();
  const dark = !!usePresentation()?.dark;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.card, { borderColor: "#fecaca", gap: 10 }]}
    >
      <Copy style={{ color: dark ? "#fda4af" : "#9f1239" }}>{message}</Copy>
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

/** Native media entry keeps the reference drop-zone silhouette and the existing camera action. */
export function UploadTarget({
  label,
  note,
  disabled,
  onUpload,
  onCamera,
}: {
  label: string;
  note?: string;
  disabled: boolean;
  onUpload: () => void;
  onCamera: () => void;
}) {
  const dark = !!usePresentation()?.dark;
  return (
    <View style={{ position: "relative" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onUpload}
        style={({ pressed }) => ({
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: dark ? "#334155" : "#d6d3d1",
          backgroundColor: dark ? "#1e293b66" : "#fafaf980",
          borderRadius: 16,
          minHeight: note ? 114 : 76,
          padding: 14,
          gap: 6,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: dark ? "#064e3b" : "#d1fae5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Upload size={20} color={dark ? "#a7f3d0" : "#047857"} />
        </View>
        {!!note && (
          <>
            <Copy weight="bold">{label}</Copy>
            <Copy style={{ fontSize: 10, lineHeight: 15, color: "#78716c" }}>
              {note}
            </Copy>
          </>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take Picture"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onCamera}
        hitSlop={10}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: dark ? "#1e293b" : "#f5f5f4",
        }}
      >
        <Camera size={16} color={dark ? "#cbd5e1" : "#78716c"} />
      </Pressable>
    </View>
  );
}
