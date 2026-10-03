import { Component, useEffect, useState, type PropsWithChildren } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { Moon, Sun, User } from "lucide-react-native";
import { usePresentation } from "../shell/TownLoopShell";
import { Theme, Action, Box, Row, Txt, usePalette } from "./ui";
import { useHomeStore, useReducedMotion, useToday } from "./hooks";
import { friendlyDate, toggleReminder, nextTaskId } from "./model";
import { Weather } from "./Weather";
import { Medications } from "./Medications";
import { Checklist } from "./Checklist";
import { Activities } from "./Activities";
export function HomeScreen({
  uid,
  name,
  role,
  onAccount,
}: {
  uid: string;
  name: string;
  role: string;
  onAccount: () => void;
}) {
  const presentation = usePresentation();
  const scheme = useColorScheme();
  const [localDark, setDark] = useState(scheme === "dark");
  const dark = presentation?.dark ?? localDark;
  const [fonts, fontError] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    JakartaBold: PlusJakartaSans_700Bold,
    Playfair: PlayfairDisplay_700Bold,
  });
  if (!fonts && !fontError)
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator />
        <Txt>Loading Home…</Txt>
      </SafeAreaView>
    );
  return (
    <Theme.Provider value={dark}>
      <HomeContent
        key={uid}
        uid={uid}
        name={name}
        role={role}
        onAccount={onAccount}
        dark={dark}
        embedded={!!presentation}
        toggleTheme={() =>
          presentation ? presentation.toggleTheme() : setDark(!dark)
        }
      />
    </Theme.Provider>
  );
}
function HomeContent({
  uid,
  name,
  role,
  onAccount,
  dark,
  toggleTheme,
  embedded,
}: {
  uid: string;
  name: string;
  role: string;
  onAccount: () => void;
  dark: boolean;
  toggleTheme: () => void;
  embedded: boolean;
}) {
  const p = usePalette(),
    store = useHomeStore(uid),
    today = useToday(),
    reduced = useReducedMotion();
  const [toast, setToast] = useState("");
  const opacity = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduced]);
  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast);
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const busy = store.saving || !store.ready;
  return (
    <SafeAreaView
      edges={embedded ? ["left", "right"] : ["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: embedded ? "transparent" : p.bg }}
    >
      {!embedded && (
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderColor: p.line,
          }}
        >
          <Row
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Txt
                accessibilityRole="header"
                style={{ fontFamily: "Playfair", fontSize: 30, lineHeight: 34 }}
              >
                Good Morning,
              </Txt>
              <Txt
                style={{
                  fontFamily: "Playfair",
                  fontSize: 30,
                  lineHeight: 36,
                  color: dark ? "#34d399" : "#000",
                }}
              >
                {name.split(" ")[0] || "Resident"}
              </Txt>
              <Txt
                bold
                style={{
                  fontSize: 13,
                  marginTop: 8,
                  textTransform: "uppercase",
                }}
              >
                {friendlyDate(today)}
              </Txt>
              {!!role && role !== "resident" && (
                <Txt
                  bold
                  style={{
                    color: p.green,
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  {role}
                </Txt>
              )}
            </View>
            <View style={{ gap: 6 }}>
              <Action
                icon={User}
                iconOnly
                label="Your account"
                onPress={onAccount}
              />
              <Action
                icon={dark ? Sun : Moon}
                iconOnly
                label={
                  dark
                    ? "Switch to light appearance"
                    : "Switch to dark appearance"
                }
                onPress={toggleTheme}
              />
            </View>
          </Row>
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 16,
          paddingBottom: embedded ? 128 : 32,
        }}
      >
        <Animated.View style={{ gap: 16, opacity }}>
          <HomeBoundary name="Weather Widget">
            <Weather />
          </HomeBoundary>
          {!!store.error && (
            <Box>
              <Txt accessibilityRole="alert" style={{ color: "#e11d48" }}>
                {store.error}
              </Txt>
              {!store.ready && (
                <Action
                  label="Retry loading reminders"
                  onPress={() => void store.load()}
                />
              )}
            </Box>
          )}
          {!store.ready ? (
            <Box>
              {!store.error && <ActivityIndicator color={p.green} />}
              <Txt>
                {store.error
                  ? "Saved reminders are unavailable."
                  : "Loading your reminders…"}
              </Txt>
            </Box>
          ) : (
            <>
              <HomeBoundary name="Daily Medications">
                <Medications
                  today={today}
                  items={store.data.medications}
                  busy={busy}
                  notify={setToast}
                  onChange={(fn) =>
                    store.change((d) => ({
                      ...d,
                      medications: fn(d.medications),
                    }))
                  }
                />
              </HomeBoundary>
              <HomeBoundary name="Daily Checklist">
                <Checklist
                  today={today}
                  tasks={store.data.tasks}
                  busy={busy}
                  onAdd={async (text, date) => {
                    const ok = await store.change((d) => ({
                      ...d,
                      tasks: [
                        { id: nextTaskId(d.tasks), text, date, done: false },
                        ...d.tasks,
                      ],
                    }));
                    if (ok) setToast("Added to Daily Checklist.");
                    return ok;
                  }}
                  onToggle={(id) =>
                    void store.change((d) => ({
                      ...d,
                      tasks: d.tasks.map((t) =>
                        t.id === id ? { ...t, done: !t.done } : t,
                      ),
                    }))
                  }
                  onDelete={async (t) => {
                    if (
                      await store.change((d) => ({
                        ...d,
                        tasks: d.tasks.filter((x) => x.id !== t.id),
                      }))
                    )
                      setToast(`Removed "${t.text}" from checklist.`);
                  }}
                />
              </HomeBoundary>
            </>
          )}
          <HomeBoundary name="Monthly Activities">
            <Activities
              today={today}
              tasks={store.data.tasks}
              busy={busy}
              onToggle={async (e, date) => {
                if (
                  await store.change((d) => ({
                    ...d,
                    tasks: toggleReminder(d.tasks, e, date),
                  }))
                )
                  setToast(
                    `Updated "${e.title}" in your Daily Checklist for ${date}.`,
                  );
              }}
            />
          </HomeBoundary>
        </Animated.View>
      </ScrollView>
      {!!toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            bottom: 12,
            left: 20,
            right: 20,
            padding: 14,
            borderRadius: 16,
            backgroundColor: p.paper,
            borderWidth: 1,
            borderColor: p.green,
          }}
        >
          <Txt>{toast}</Txt>
        </View>
      )}
    </SafeAreaView>
  );
}
class HomeBoundary extends Component<
  PropsWithChildren<{ name: string }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Box>
        <Txt accessibilityRole="alert">
          {this.props.name} could not be displayed.
        </Txt>
        <Action
          label={`Retry ${this.props.name}`}
          onPress={() => this.setState({ failed: false })}
        />
      </Box>
    ) : (
      this.props.children
    );
  }
}
