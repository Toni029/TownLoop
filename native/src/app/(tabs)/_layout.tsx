import { Tabs, router } from "expo-router";
import { useSession } from "../../lib/session";
import {
  BlurScene,
  FloatingDock,
  TownLoopShell,
  type TabName,
} from "../../shell/TownLoopShell";
export default function TabLayout() {
  const { profile } = useSession();
  const source = profile?.source;
  const photo = [
    source?.avatar_url,
    source?.avatar,
    source?.photoURL,
    source?.profilePhotoUrl,
    source?.avatarUrl,
  ].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return (
    <TownLoopShell
      name={profile?.name || "Resident"}
      role={profile?.role || "resident"}
      photo={photo}
      onAccount={() => router.push("/account")}
    >
      <Tabs
        screenLayout={({ children }) => <BlurScene>{children}</BlurScene>}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
          tabBarHideOnKeyboard: true,
        }}
        tabBar={({ state, navigation }) => (
          <FloatingDock
            active={state.routes[state.index].name as TabName}
            onSelect={(name) => {
              const route = state.routes.find((r) => r.name === name);
              if (!route) return;
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (
                state.routes[state.index].key !== route.key &&
                !event.defaultPrevented
              )
                navigation.navigate(route.name);
            }}
            onLongPress={(name) => {
              const route = state.routes.find((r) => r.name === name);
              if (route)
                navigation.emit({ type: "tabLongPress", target: route.key });
            }}
          />
        )}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="news" options={{ title: "News" }} />
        <Tabs.Screen name="workorders" options={{ title: "Work Orders" }} />
        <Tabs.Screen name="social" options={{ title: "Social" }} />
      </Tabs>
    </TownLoopShell>
  );
}
