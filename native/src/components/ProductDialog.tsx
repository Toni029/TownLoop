import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Maximize2, Minimize2, X } from "lucide-react-native";
import { usePresentation } from "../shell/TownLoopShell";
import { Copy, s } from "../news/ui";
import { useReducedMotion } from "../home/hooks";
export function ProductDialog({
  title,
  subtitle,
  children,
  busy = false,
  onClose,
  initiallyFull = false,
  sheet = false,
  serif = false,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  initiallyFull?: boolean;
  sheet?: boolean;
  serif?: boolean;
}>) {
  const presentation = usePresentation();
  const dark = !!presentation?.dark;
  const [bodyHeight, setBodyHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const ready = !sheet || !!(bodyHeight && headerHeight);
  const [full, setFull] = useState(initiallyFull);
  const { height, width } = useWindowDimensions();
  const bottomSheet = sheet && width < 640;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const target = full
    ? height - insets.top - insets.bottom
    : sheet
      ? Math.min(
          height * 0.92 - insets.top - insets.bottom,
          (bodyHeight || 470) +
            (headerHeight || 100) +
            (bottomSheet ? 28 : 0) +
            insets.bottom,
        )
      : Math.min(660, height * 0.72);
  const [size] = useState(() => new Animated.Value(target));
  const [open] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const motion = Animated.parallel([
      Animated.timing(open, {
        toValue: 1,
        duration: reduced ? 0 : 430,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        delay: reduced ? 0 : sheet && serif ? 120 : 185,
        duration: reduced ? 0 : sheet && serif ? 400 : 570,
        useNativeDriver: true,
      }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [open, fade, reduced, sheet, serif, ready]);
  useEffect(() => {
    const motion = Animated.timing(size, {
      toValue: target,
      duration: reduced ? 0 : 430,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [size, target, reduced]);
  const close = () => {
    if (busy || closing) return;
    setClosing(true);
    Animated.timing(open, {
      toValue: 0,
      duration: reduced ? 0 : 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy && Math.abs(g.dy) > 12,
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60 || g.vy > 0.25) {
        if (full) setFull(false);
        else close();
      } else if (g.dy < -40 || g.vy < -0.25) setFull(true);
    },
  });
  return (
    <Modal
      statusBarTranslucent
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "transparent",
            justifyContent: bottomSheet ? "flex-end" : "center",
            padding: full || bottomSheet ? 0 : 12,
            paddingTop: insets.top,
            paddingBottom: bottomSheet && !full ? 0 : insets.bottom,
          }}
        >
          {!!presentation?.blurTarget && (
            <BlurView
              blurTarget={presentation.blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={40}
              tint={dark ? "dark" : "default"}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              }}
            />
          )}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#0c0a09a6",
            }}
          />
          <Animated.View
            style={{
              height: size,
              maxWidth: full ? undefined : 512,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: dark ? "#0f172a" : "#fff",
                borderRadius: full ? 0 : bottomSheet ? 0 : 24,
                borderTopLeftRadius: full ? 0 : bottomSheet ? 32 : 24,
                borderTopRightRadius: full ? 0 : bottomSheet ? 32 : 24,
                overflow: "hidden",
                opacity: open,
                transform: [
                  {
                    translateY: open.interpolate({
                      inputRange: [0, 1],
                      outputRange: bottomSheet ? [height, 0] : [24, 0],
                    }),
                  },
                  {
                    scale: open.interpolate({
                      inputRange: [0, 1],
                      outputRange: bottomSheet ? [1, 1] : [0.88, 1],
                    }),
                  },
                ],
              }}
            >
              <SafeAreaView
                edges={["left", "right", "bottom"]}
                style={{ flex: 1 }}
              >
                {bottomSheet && (
                  <View
                    {...pan.panHandlers}
                    style={{
                      alignItems: "center",
                      paddingTop: 12,
                      paddingBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: full ? 64 : 48,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: full
                          ? "#059669"
                          : dark
                            ? "#334155"
                            : "#d6d3d1",
                      }}
                    />
                  </View>
                )}
                <View
                  onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                  {...pan.panHandlers}
                  style={[
                    s.row,
                    {
                      padding: 20,
                      paddingBottom: 12,
                      borderBottomWidth: 1,
                      borderColor: dark ? "#1e293b" : "#e7e5e4",
                      flexWrap: "nowrap",
                      gap: 6,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Copy
                      accessibilityRole="header"
                      weight="bold"
                      style={{
                        fontFamily: serif ? "PlayfairBlack" : "NewsBold",
                        fontSize: 16,
                        lineHeight: 24,
                      }}
                    >
                      {title}
                    </Copy>
                    {!!subtitle && (
                      <Copy
                        style={{
                          color: "#78716c",
                          lineHeight: 16,
                          marginTop: 2,
                        }}
                      >
                        {subtitle}
                      </Copy>
                    )}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      full ? "Exit full screen" : "Expand to full screen"
                    }
                    disabled={busy}
                    onPress={() => setFull((v) => !v)}
                    hitSlop={8}
                    style={{
                      width: 32,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      backgroundColor: dark ? "#1e293b" : "#f5f5f4",
                    }}
                  >
                    {full ? (
                      <Minimize2 size={16} color="#78716c" />
                    ) : (
                      <Maximize2 size={16} color="#78716c" />
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    disabled={busy}
                    onPress={close}
                    hitSlop={8}
                    style={{
                      width: 32,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      backgroundColor: dark ? "#1e293b" : "#f5f5f4",
                    }}
                  >
                    <X size={16} color="#78716c" />
                  </Pressable>
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={(_, h) => setBodyHeight(h)}
                  contentContainerStyle={{
                    padding: 20,
                    paddingTop: sheet ? 6 : 16,
                  }}
                >
                  <Animated.View
                    style={{
                      opacity: fade,
                      gap: sheet ? (serif ? 14 : 12) : 16,
                    }}
                  >
                    {children}
                  </Animated.View>
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
