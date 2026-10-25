import { ScrollView } from '../keyboard/KeyboardScrollView';
import { SystemBars } from "./SystemBars";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, cancelAnimation, runOnJS, ReduceMotion } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,

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
  responsiveResize = false,
  nativeWindowKey = 0,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  initiallyFull?: boolean;
  sheet?: boolean;
  serif?: boolean;
  responsiveResize?: boolean;
  nativeWindowKey?: number;
}>) {
  const presentation = usePresentation();
  const dark = !!presentation?.dark;
  const [bodyHeight, setBodyHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const ready = !sheet || !!(bodyHeight && headerHeight);
  const [full, setFull] = useState(initiallyFull);
  const { height, width } = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState(height);
  const bottomSheet = sheet && width < 640;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const target = full
    ? availableHeight
    : sheet
      ? Math.min(
          availableHeight * 0.92 - insets.top - insets.bottom,
          (bodyHeight || 470) +
            (headerHeight || 100) +
            (bottomSheet ? 28 : 0) +
            insets.bottom,
        )
      : Math.min(660, availableHeight * 0.72);
  const size = useSharedValue(target);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  const opened = useRef(false);
  const lastFull = useRef(full);
  useEffect(() => {
    if (!ready || closing) return;
    if (!opened.current) {
      opened.current = true;
      lastFull.current = full;
      size.set(target);
      progress.set(withTiming(1, { duration: reduced ? 0 : 240, reduceMotion: ReduceMotion.System }));
    } else if (lastFull.current !== full) {
      lastFull.current = full;
      size.set(responsiveResize ? withSpring(target, { damping: 26, stiffness: 280, mass: 0.8, overshootClamping: true, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System }) : withTiming(target, { duration: reduced ? 0 : 240 }));
    } else {
      // KeyboardAvoidingView owns keyboard movement; never add a second height animation.
      size.set(target);
    }
  }, [ready, closing, target, full, reduced, responsiveResize, size, progress]);
  useEffect(() => () => { cancelAnimation(size); cancelAnimation(progress); cancelAnimation(drag); }, [size, progress, drag]);
  const close = () => {
    if (busy || closing) return;
    setClosing(true);
    progress.set(withTiming(0, { duration: reduced ? 0 : 180 }, finished => {
      if (finished) runOnJS(onClose)();
    }));
  };
  const pan = Gesture.Pan().enabled(!busy).activeOffsetY([-12, 12]).failOffsetX([-24, 24])
    .onUpdate(event => { drag.set(reduced ? 0 : Math.max(0, event.translationY)); })
    .onEnd(event => {
      if (event.translationY > 80 || event.velocityY > 800) {
        if (full) { runOnJS(setFull)(false); drag.set(withSpring(0, responsiveResize ? { damping: 26, stiffness: 280, mass: 0.8, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System } : undefined)); }
        else runOnJS(close)();
      } else {
        if (event.translationY < -60 || event.velocityY < -800) runOnJS(setFull)(true);
        drag.set(withSpring(0, { damping: 26, stiffness: 280 }));
      }
    }).onFinalize((_event, success) => { if (!success) drag.set(withSpring(0, responsiveResize ? { damping: 26, stiffness: 280, mass: 0.8, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System } : undefined)); });
  const sizeStyle = useAnimatedStyle(() => ({ height: size.value }));
  const panelMotion = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value),
    transform: [{ translateY: (1 - progress.value) * (bottomSheet ? height : 24) + drag.value },
      { scale: bottomSheet || reduced ? 1 : 0.88 + progress.value * 0.12 }],
  }));
  const backdropMotion = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value) }));
  return (
    <Modal
      key={nativeWindowKey}
      statusBarTranslucent navigationBarTranslucent
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <SystemBars dark={full ? dark : !bottomSheet || dark} statusStyle={full ? (dark ? "light" : "dark") : "light"} />
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)}
          style={{
            flex: 1,
            backgroundColor: "transparent",
            justifyContent: bottomSheet ? "flex-end" : "center",
            padding: full || bottomSheet ? 0 : 12,
            paddingTop: full ? 0 : insets.top,
            paddingBottom: full || bottomSheet ? 0 : insets.bottom,
          }}
        >
          <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }, backdropMotion]}>
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
          </Animated.View>
          <Animated.View
            style={[sizeStyle, {
              maxWidth: full ? undefined : 512,
              width: "100%",
              alignSelf: "center",
            }]}
          >
            <Animated.View
              style={[panelMotion, {
                flex: 1,
                backgroundColor: dark ? "#0f172a" : "#fff",
                borderRadius: full ? 0 : bottomSheet ? 0 : 24,
                borderTopLeftRadius: full ? 0 : bottomSheet ? 32 : 24,
                borderTopRightRadius: full ? 0 : bottomSheet ? 32 : 24,
                overflow: "hidden",
              }]}
            >
              <SafeAreaView
                edges={full ? ["top", "left", "right", "bottom"] : ["left", "right", "bottom"]}
                style={{ flex: 1 }}
              >
                <GestureDetector gesture={pan}><View>
                {bottomSheet && (
                  <View
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
                </View></GestureDetector>
                <ScrollView
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={(_, h) => setBodyHeight(h)}
                  contentContainerStyle={{
                    padding: 20,
                    paddingTop: sheet ? 6 : 16,
                  }}
                >
                  <Animated.View
                    style={{

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
      </GestureHandlerRootView>
    </Modal>
  );
}
