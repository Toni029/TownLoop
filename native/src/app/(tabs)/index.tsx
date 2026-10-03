import { router, Tabs } from "expo-router";
import { useSession } from "../../lib/session";
import { HomeScreen } from "../../home/HomeScreen";
export default function Home() {
  const { user, profile } = useSession();
  if (!user || !profile) return null;
  return (
    <>
      <Tabs.Screen options={{ headerShown: false }} />
      <HomeScreen
        uid={user.uid}
        name={profile.name}
        role={profile.role}
        onAccount={() => router.push("/account")}
      />
    </>
  );
}
