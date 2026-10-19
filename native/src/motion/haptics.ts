import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
export function selectionFeedback() {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => undefined);
}

/** Native Android view haptics honor the device's touch-feedback setting. */
export function tabSelectionFeedback() {
  if (Platform.OS === 'android') void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap).catch(() => undefined);
  else if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => undefined);
}
