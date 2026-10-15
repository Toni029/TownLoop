import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { useIsFocused } from "expo-router";

/** Only icon contrast is changed: the actual screen paints beneath both system bars.
 * SDK 57 native code interprets both styles as foreground colors.
 * Declarative entries restore the previous screen's styles when an overlay unmounts.
 */
export function SystemBars({ dark = false, statusStyle }: { dark?: boolean; statusStyle?: "light" | "dark" }) {
  return <>
    <StatusBar style={statusStyle ?? (dark ? "light" : "dark")} hidden={false} />
    <NavigationBar style={dark ? "light" : "dark"} hidden={false} />
  </>;
}

/** Retained navigation screens must not override the currently visible screen. */
export function ScreenSystemBars({ dark = false }: { dark?: boolean }) {
  const focused = useIsFocused();
  return focused ? <SystemBars dark={dark} /> : null;
}
