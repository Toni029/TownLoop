import { useCallback, type PropsWithChildren } from "react";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "../home/hooks";
/** Keep tab state mounted; animate only opacity, never the screen's layout. */
export function ScreenMotion({ children }: PropsWithChildren) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useFocusEffect(useCallback(() => {
    opacity.set(withTiming(1, { duration: reduced ? 0 : 160 }));
    return () => { cancelAnimation(opacity); opacity.set(reduced ? 1 : 0); };
  }, [opacity, reduced]));
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
