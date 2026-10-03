import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, TextInput, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
export const colors = { ink: '#0f172a', green: '#059669', cream: '#faf8f4', muted: '#78716c' };
export function Page({ children }: PropsWithChildren) { return <SafeAreaView edges={['left', 'right']} style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView></SafeAreaView>; }
export function Heading({ children }: PropsWithChildren) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Body({ children }: PropsWithChildren) { return <Text style={s.body}>{children}</Text>; }
export function Card({ children }: PropsWithChildren) { return <View style={s.card}>{children}</View>; }
export function Button({ title, onPress, disabled = false }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
}) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, (pressed || disabled) && { opacity: 0.6 }]}><Text style={s.buttonText}>{title}</Text></Pressable>; }
export function Field({ label, ...props }: TextInputProps & {
    label: string;
}) { return <View style={{ gap: 6 }}><Text style={s.body}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={s.input} {...props}/></View>; }
export function Loading() { return <View style={[s.page, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.green}/><Body>Loading TownLoop…</Body></View>; }
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.cream }, content: { padding: 18, gap: 16, flexGrow: 1, paddingBottom: 32 }, heading: { fontSize: 24, fontWeight: '700', color: colors.ink }, body: { fontSize: 16, lineHeight: 24, color: colors.ink }, card: { padding: 18, borderRadius: 24, backgroundColor: '#fffefc', borderWidth: 1, borderColor: '#e7e5e4', gap: 10 }, button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.green, borderRadius: 16, padding: 12 }, buttonText: { color: 'white', fontSize: 16, fontWeight: '700' }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#d6d3d1', padding: 12, fontSize: 16, backgroundColor: 'white', color: colors.ink } });
