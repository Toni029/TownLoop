import { useEffect, useState, type PropsWithChildren } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useReducedMotion } from "../home/hooks";
/** Measured content stays mounted so closing/reopening cannot discard form state. */
export function Collapsible({ open, children }: PropsWithChildren<{ open: boolean }>) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const [height, setHeight] = useState(0);
  const reduced = useReducedMotion();
  const size = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    size.set(withTiming(open ? height : 0, { duration: reduced ? 0 : 240, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    opacity.set(withTiming(open ? 1 : 0, { duration: reduced ? 0 : 160 }));
    return () => { cancelAnimation(size); cancelAnimation(opacity); };
  }, [open, height, reduced, size, opacity]);
  const style = useAnimatedStyle(() => ({ height: size.value, opacity: opacity.value }));
  return <Animated.View style={[{ overflow: "hidden" }, style]} pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
    {present && <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
      <View onLayout={e => setHeight(e.nativeEvent.layout.height)} style={{ paddingTop: 14, gap: 14 }}>{children}</View>
    </View>}
  </Animated.View>;
}
