import { useState } from "react";
import { Image, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, ReduceMotion } from "react-native-reanimated";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react-native";
import { Copy, Action, s } from "../news/ui";
const clamp = (value: number, limit: number) => { "worklet"; return Math.max(-limit, Math.min(limit, value)); };
export function ZoomImage({ uri, title }: { uri: string; title: string }) {
  const scale = useSharedValue(1), startScale = useSharedValue(1);
  const x = useSharedValue(0), y = useSharedValue(0);
  const startX = useSharedValue(0), startY = useSharedValue(0);
  const width = useSharedValue(0), height = useSharedValue(0);
  const [label, setLabel] = useState(1), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const zoom = (value: number) => {
    const next = Math.max(1, Math.min(5, value));
    scale.set(withSpring(next, { damping: 28, stiffness: 300, reduceMotion: ReduceMotion.System }));
    x.set(withSpring(0)); y.set(withSpring(0)); setLabel(next);
  };
  const pinch = Gesture.Pinch().onStart(() => { startScale.value = scale.value; })
    .onUpdate(event => {
      scale.value = Math.max(1, Math.min(5, startScale.value * event.scale));
      x.value = clamp(x.value, width.value * (scale.value - 1) / 2);
      y.value = clamp(y.value, height.value * (scale.value - 1) / 2);
    }).onFinalize(() => { runOnJS(setLabel)(scale.value); });
  const pan = Gesture.Pan().minDistance(8).averageTouches(true)
    .onStart(() => { startX.value = x.value; startY.value = y.value; })
    .onUpdate(event => {
      x.value = clamp(startX.value + event.translationX, width.value * (scale.value - 1) / 2);
      y.value = clamp(startY.value + event.translationY, height.value * (scale.value - 1) / 2);
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd((_event, success) => {
    if (success) runOnJS(zoom)(scale.value > 1 ? 1 : 2);
  });
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return <View style={{ flex: 1, gap: 10 }}>
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View accessibilityLabel={title} accessibilityActions={[{ name: "increment", label: "Zoom in" }, { name: "decrement", label: "Zoom out" }]}
        onAccessibilityAction={event => zoom(label + (event.nativeEvent.actionName === "increment" ? 0.5 : -0.5))}
        onLayout={event => { width.set(event.nativeEvent.layout.width); height.set(event.nativeEvent.layout.height); }}
        style={{ flex: 1, overflow: "hidden", justifyContent: "center" }}>
        <Animated.View style={[{ width: "100%", height: "100%" }, motion]}>
          <Image key={retry} source={{ uri }} accessibilityLabel={title} resizeMode="contain" onError={() => setError(true)} style={{ width: "100%", height: "100%" }} />
        </Animated.View>
        {error && <View style={{ position: "absolute", alignSelf: "center", gap: 10 }}><Copy style={{ color: "#fff" }}>Unable to load this picture.</Copy><Action label="Retry Picture" onPress={() => { setError(false); setRetry(v => v + 1); }} /></View>}
      </View>
    </GestureDetector>
    <View style={[s.row, { justifyContent: "center" }]}>
      <Action label="Zoom Out" icon={ZoomOut} disabled={label <= 1} onPress={() => zoom(label - 0.5)} />
      <Copy style={{ color: "#fff" }}>{Math.round(label * 100)}%</Copy>
      <Action label="Zoom In" icon={ZoomIn} disabled={label >= 5} onPress={() => zoom(label + 0.5)} />
      <Action label="Reset Zoom" icon={RotateCcw} onPress={() => zoom(1)} />
    </View>
  </View>;
}
