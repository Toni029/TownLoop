import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

/** Acknowledges actual OTA execution, exclusively in standalone Preview builds. */
export function PreviewUpdateNotice() {
  useEffect(() => {
    if (
      __DEV__ || Platform.OS === "web" || Updates.channel !== "preview" ||
      Updates.isEmbeddedLaunch || !Updates.updateId
    ) return;
    let active = true;
    const key = `townloop:preview-update-seen:${Updates.updateId}`;
    void AsyncStorage.getItem(key).then((seen) => {
      if (!active || seen) return;
      Alert.alert(
        "Preview update received",
        `This phone is running a downloaded TownLoop Preview update.\n\nUpdate: ${Updates.updateId}\nRuntime: ${Updates.runtimeVersion}\n\nYour account and community data have not been reset.`,
        [{ text: "Got it", onPress: () => { void AsyncStorage.setItem(key, "1").catch(() => {}); } }],
        { cancelable: false },
      );
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return null;
}
