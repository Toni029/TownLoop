import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { Loading, colors } from '../components/ui';
function Navigation() {
    const { user, profile, loading } = useSession();
    if (loading)
        return <Loading />;
    return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.cream }, headerTintColor: colors.ink }}>
    <Stack.Protected guard={!user}><Stack.Screen name="sign-in" options={{ headerShown: false }}/></Stack.Protected>
    <Stack.Protected guard={!!user && !profile?.approved}><Stack.Screen name="pending" options={{ title: 'Your account' }}/></Stack.Protected>
    <Stack.Protected guard={!!user && !!profile?.approved}><Stack.Screen name="(tabs)" options={{ headerShown: false }}/><Stack.Screen name="account" options={{ title: 'Account' }}/></Stack.Protected>
  </Stack>;
}
export default function Root() {
    return <SafeAreaProvider><SessionProvider><StatusBar style="dark"/><Navigation /></SessionProvider></SafeAreaProvider>;
}
