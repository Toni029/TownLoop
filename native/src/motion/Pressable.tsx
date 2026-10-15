import { useState } from "react";
import { Pressable as NativePressable, type PressableProps } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, ReduceMotion } from "react-native-reanimated";
const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);
/** Starts feedback immediately; interpolation stays off the JS thread. */
export function MotionPressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const settle = (value: number) => scale.set(withSpring(value, { damping: 28, stiffness: 450, mass: 0.5, reduceMotion: ReduceMotion.System }));
  return <AnimatedPressable {...props}
    onPressIn={event => { setPressed(true); settle(0.98); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); settle(1); onPressOut?.(event); }}
    style={[typeof style === "function" ? style({ pressed }) : style, motion]} />;
}
