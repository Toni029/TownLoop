import { PreviewUpdateNotice } from "../development/PreviewUpdateNotice";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useReducedMotion } from "../home/hooks";
import { CommunityProvider, useCommunity } from "../lib/community";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { Stack } from "expo-router";
import { SystemBars } from "../components/SystemBars";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { Loading, colors } from "../components/ui";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { PlayfairDisplay_900Black } from "@expo-google-fonts/playfair-display/900Black";
function Navigation() {
  const reduced = useReducedMotion();
  const { user, profile, loading } = useSession();
  const { community, ready } = useCommunity();
  if (loading || !ready) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.cream },
        animation: reduced ? "none" : "default",
      }}
    >
      <Stack.Protected guard={!community}>
        <Stack.Screen name="communities" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!community && !user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!community && !!user && !profile?.approved}>
        <Stack.Screen name="pending" options={{ title: "Your account" }} />
      </Stack.Protected>
      <Stack.Protected guard={!!community && !!user && !!profile?.approved}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: "Account" }} />
      </Stack.Protected>
    </Stack>
  );
}
export default function Root() {
  const [fonts, error] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    JakartaMedium: PlusJakartaSans_500Medium,
    JakartaSemi: PlusJakartaSans_600SemiBold,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaExtra: PlusJakartaSans_800ExtraBold,
    Playfair: PlayfairDisplay_700Bold,
    PlayfairBlack: PlayfairDisplay_900Black,
  });
  if (!fonts && !error)
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ backgroundColor: colors.cream }}>
        <SystemBars />
        <Loading />
      </SafeAreaProvider>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ backgroundColor: colors.cream }}>
      <CommunityProvider>
        <SessionProvider>
          <SystemBars />
          <Navigation />
          <PreviewUpdateNotice />
        </SessionProvider>
      </CommunityProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
