import { ScrollView, TextInput } from '../keyboard/KeyboardScrollView';
import { ScreenSystemBars } from "../components/SystemBars";
import { ResidentRegistration } from "../components/ResidentRegistration";
import { googleSignIn } from "../lib/googleSignIn";
import Svg, { Path } from "react-native-svg";
import { useCommunity } from "../lib/community";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,

  StyleSheet,

  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  LogIn,
  UserPlus,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Moon,
  Sun,
} from "lucide-react-native";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { friendlyError } from "../lib/profile";
import { CecilPinesMark } from "../components/CecilPinesMark";
export default function SignIn() {
  const passwordInput = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState("");
  const [googleHovered, setGoogleHovered] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const wide = useWindowDimensions().width >= 640;
  const { community, clearCommunity } = useCommunity();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false),
    [dark, setDark] = useState(false);
  const ink = dark ? "#f1f5f9" : "#243328",
    muted = dark ? "#94a3b8" : "#7e735e";
  const inputStyle = [
    s.input,
    dark && {
      backgroundColor: "#020617",
      borderColor: "#334155",
      color: "#fff",
    },
  ];
  async function submit(reset = false) {
    if (busy) return;
    if (!email.trim() || (!reset && !password)) {
      setMessage("Please enter your email" + (reset ? "." : " and password."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (reset) {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage(
          "If an account exists for this email, check your inbox for a reset link.",
        );
      } else
        await signInWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password,
        );
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!community)
    return <View style={{ flex: 1, backgroundColor: "#f7f3ea" }} />;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={
          dark ? ["#020617", "#0f172a"] : ["#faf6f0", "#f5ede2", "#e9decb"]
        }
        style={{ flex: 1 }}
      >
        <ScreenSystemBars dark={dark} />
      <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            extraKeyboardSpace
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            automaticallyAdjustKeyboardInsets={false}
            contentContainerStyle={[s.page, { paddingVertical: wide ? 24 : 0 }]}
          >
            <LinearGradient
              colors={
                dark
                  ? ["#020617", "#0f172a"]
                  : ["#f7f3ea", "#f1ebe0", "#e8decb"]
              }
              style={[
                s.portal,
                { padding: wide ? 28 : 16, borderRadius: wide ? 44 : 0 },
              ]}
            >
              <View style={[s.utility, { marginBottom: wide ? 16 : 12 }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Switch Community"
                  hitSlop={6}
                  disabled={busy}
                  onPress={async () => {
                    try {
                      await clearCommunity();
                    } catch {
                      setMessage(
                        "Unable to switch communities. Please try again.",
                      );
                    }
                  }}
                  style={({ pressed }) => [
                    s.switchCommunity,
                    {
                      backgroundColor: dark ? "#1e293b" : "#fffffff2",
                      borderColor: dark ? "#334155" : "#e7e5e4",
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    },
                  ]}
                >
                  <Building2 size={14} color={dark ? "#34d399" : "#059669"} />
                  <Text
                    style={{
                      fontFamily: "JakartaBold",
                      fontSize: 12,
                      color: dark ? "#e2e8f0" : "#44403c",
                    }}
                  >
                    Switch Community
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    dark
                      ? "Switch to light appearance"
                      : "Switch to dark appearance"
                  }
                  onPress={() => setDark(!dark)}
                  style={[
                    s.theme,
                    {
                      minWidth: wide ? 38 : 34,
                      minHeight: wide ? 38 : 34,
                      borderWidth: 1,
                      borderColor: dark ? "#334155" : "#d6d3d1",
                      backgroundColor: dark ? "#1e293b" : "#f5f5f4f2",
                    },
                  ]}
                >
                  {dark ? (
                    <Sun size={16} color="#fbbf24" />
                  ) : (
                    <Moon size={16} color="#334155" />
                  )}
                </Pressable>
              </View>
              <View style={s.identity}>
                <LinearGradient
                  colors={["#185d3b", "#145334", "#0c3621"]}
                  style={[
                    s.emblem,
                    { width: wide ? 88 : 80, height: wide ? 88 : 80 },
                  ]}
                >
                  <CecilPinesMark size={wide ? 64 : 56} />
                </LinearGradient>
                <Text
                  accessibilityRole="header"
                  style={[
                    s.community,
                    {
                      fontSize: wide ? 36 : 30,
                      lineHeight: wide ? 36 : 30,
                      letterSpacing: wide ? -0.9 : -0.75,
                    },
                    dark && { color: "#34d399" },
                  ]}
                >
                  {community === "cecil_pines"
                    ? "Cecil Pines"
                    : "Upcoming Community"}
                </Text>
                <LinearGradient
                  colors={["#d99c0000", "#d99c00", "#d99c0000"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.goldRule, { width: wide ? 224 : 176 }]}
                />
                <Text
                  style={[
                    s.tagline,
                    {
                      fontSize: wide ? 16 : 14,
                      letterSpacing: wide ? 0.8 : 0.7,
                    },
                    dark && { color: "#6ee7b7" },
                  ]}
                >
                  Active Adult Living Community
                </Text>
                <View
                  style={[
                    s.residentPill,
                    dark && {
                      backgroundColor: "#1e293b",
                      borderColor: "#334155",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.residentText,
                      {
                        fontSize: wide ? 14 : 12,
                        color: dark ? "#6ee7b7" : "#124d2c",
                      },
                    ]}
                  >
                    Resident Portal
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.card,
                  { padding: wide ? 32 : 24, borderRadius: wide ? 44 : 38 },
                  dark && {
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    padding: 6,
                    gap: 4,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: dark ? "#1e293b" : "#ded2bc",
                    backgroundColor: dark ? "#020617cc" : "#ede6d8",
                    marginBottom: 2,
                  }}
                >
                  {(["signin", "register"] as const).map((tab) => {
                    const selected = mode === tab;
                    const Icon = tab === "signin" ? LogIn : UserPlus;
                    return (
                      <Pressable
                        key={tab}
                        disabled={busy}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setMode(tab);
                          setMessage("");
                        }}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor:
                            selected && !dark ? "#d8cdb8" : "transparent",
                          backgroundColor: selected
                            ? dark
                              ? "#1e293b"
                              : "#fff"
                            : pressed
                              ? dark
                                ? "#0f172a"
                                : "#e7decd"
                              : "transparent",
                          boxShadow: selected
                            ? "0px 1px 3px rgba(0,0,0,0.1)"
                            : "none",
                        })}
                      >
                        <Icon
                          size={wide ? 20 : 16}
                          color={
                            selected
                              ? dark
                                ? "#fff"
                                : "#0f4423"
                              : dark
                                ? "#94a3b8"
                                : "#6e6350"
                          }
                        />
                        <Text
                          style={{
                            fontFamily: "JakartaBold",
                            fontSize: wide ? 16 : 14,
                            color: selected
                              ? dark
                                ? "#fff"
                                : "#0f4423"
                              : dark
                                ? "#94a3b8"
                                : "#6e6350",
                          }}
                        >
                          {tab === "signin" ? "Sign In" : "Create Account"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={s.cardHeading}>
                  <Text
                    accessibilityRole="header"
                    style={[
                      s.title,
                      { fontSize: wide ? 20 : 16 },
                      { color: dark ? "#fff" : "#154628" },
                    ]}
                  >
                    {mode === "signin"
                      ? "Resident Sign In"
                      : "Create Resident Account"}
                  </Text>
                  <View
                    style={[
                      s.securePill,
                      dark && { backgroundColor: "#1e293b" },
                    ]}
                  >
                    <Text
                      style={[s.secureText, { fontSize: 12 }, { color: ink }]}
                    >
                      {mode === "signin"
                        ? "Secure Access"
                        : "Approval Required"}
                    </Text>
                  </View>
                </View>
                {mode === "register" ? (
                  <ResidentRegistration
                    dark={dark}
                    wide={wide}
                    busy={busy}
                    setBusy={setBusy}
                    onError={setMessage}
                    onSignIn={() => {
                      setMode("signin");
                      setMessage("");
                    }}
                  />
                ) : (
                  <>
                    <View style={s.field}>
                      <Text
                        style={[
                          s.label,
                          { color: ink, fontSize: wide ? 16 : 14 },
                        ]}
                      >
                        Resident Email Address
                      </Text>
                      <View style={s.inputWrap}>
                        <Mail pointerEvents="none" size={20} color={muted} style={[s.inputIcon, { opacity: focused === "email" || email ? 0 : 1 }]} />
                        <TextInput
                          accessibilityLabel="Resident Email Address"
                          returnKeyType="next"
                          submitBehavior="submit"
                          onSubmitEditing={() => passwordInput.current?.focus()}
                          placeholder={focused === "email" ? "" : "e.g. resident@cecilpines.com"}
                          placeholderTextColor={dark ? "#64748b" : "#a8a29e"}
                          onFocus={() => setFocused("email")}
                          onBlur={() => setFocused(current => current === "email" ? "" : current)}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          style={[
                            ...inputStyle,
                            focused === "email" && {
                              borderColor: dark ? "#10b981" : "#175d3a",
                              backgroundColor: dark ? "#0f172a" : "#fff",
                              boxShadow: "0px 0px 0px 4px rgba(23,93,58,0.15)",
                            },
                            {
                              fontSize: wide ? 18 : 16,
                              minHeight: wide ? 58 : 52,
                              paddingVertical: wide ? 14 : 12,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={s.field}>
                      <View style={s.passwordHeading}>
                        <Text
                          style={[
                            s.label,
                            { color: ink, fontSize: wide ? 16 : 14 },
                          ]}
                        >
                          Password
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => void submit(true)}
                          style={s.forgot}
                        >
                          <Text
                            style={[
                              s.forgotText,
                              { color: muted, fontSize: wide ? 16 : 14 },
                            ]}
                          >
                            Forgot password?
                          </Text>
                        </Pressable>
                      </View>
                      <View style={s.inputWrap}>
                        <Lock pointerEvents="none" size={20} color={muted} style={[s.inputIcon, { opacity: focused === "password" || password ? 0 : 1 }]} />
                        <TextInput
                          accessibilityLabel="Password"
                          ref={passwordInput}
                          returnKeyType="done"
                          placeholder={focused === "password" ? "" : "Enter your password"}
                          placeholderTextColor={dark ? "#64748b" : "#a8a29e"}
                          onFocus={() => setFocused("password")}
                          onBlur={() => setFocused(current => current === "password" ? "" : current)}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete="current-password"
                          onSubmitEditing={() => void submit()}
                          style={[
                            ...inputStyle,
                            focused === "password" && {
                              borderColor: dark ? "#10b981" : "#175d3a",
                              backgroundColor: dark ? "#0f172a" : "#fff",
                              boxShadow: "0px 0px 0px 4px rgba(23,93,58,0.15)",
                            },
                            {
                              paddingRight: 48,
                              fontSize: wide ? 18 : 16,
                              minHeight: wide ? 58 : 52,
                              paddingVertical: wide ? 14 : 12,
                            },
                          ]}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onPress={() => setShowPassword(!showPassword)}
                          style={s.eye}
                        >
                          {showPassword ? (
                            <EyeOff size={20} color={muted} />
                          ) : (
                            <Eye size={20} color={muted} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                    {!!message && (
                      <View
                        style={[
                          s.notice,
                          dark && { backgroundColor: "#1e293b" },
                        ]}
                      >
                        <Text
                          accessibilityLiveRegion="polite"
                          style={[s.noticeText, { color: ink }]}
                        >
                          {message}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => void submit()}
                      style={({ pressed }) => [
                        s.submit,
                        (pressed || busy) && { opacity: 0.65 },
                        { transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={["#175d3a", "#124b2e"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          s.submitInner,
                          { paddingVertical: wide ? 16 : 14, minHeight: 52 },
                        ]}
                      >
                        <Text
                          style={[
                            s.submitText,
                            { fontSize: wide ? 18 : 16, letterSpacing: 0.4 },
                          ]}
                        >
                          {busy ? "Signing in…" : "Sign In"}
                        </Text>
                        <ArrowRight size={20} color="#fff" />
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onHoverIn={() => setGoogleHovered(true)}
                      onHoverOut={() => setGoogleHovered(false)}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={async () => {
                        if (busy) return;
                        setBusy(true);
                        setMessage("");
                        try {
                          await googleSignIn();
                        } catch (e) {
                          setMessage(friendlyError(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      style={({ pressed }) => ({
                        paddingVertical: wide ? 14 : 12,
                        paddingHorizontal: 16,
                        minHeight: 50,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: dark ? "#334155" : "#d8cebe",
                        backgroundColor: dark
                          ? "#1e293be6"
                          : pressed || googleHovered
                            ? "#f2ebe0"
                            : "#faf6ee",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        opacity: busy ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24">
                        <Path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <Path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <Path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <Path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </Svg>
                      <Text
                        style={{
                          fontFamily: "JakartaBold",
                          fontSize: wide ? 16 : 14,
                          color: dark ? "#f1f5f9" : "#1c1917",
                        }}
                      >
                        Continue with Google
                      </Text>
                    </Pressable>
                  </>
                )}
                {mode === "register" && !!message && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{ fontFamily: "Jakarta", color: ink }}
                  >
                    {message}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontFamily: "Jakarta",
                  fontSize: wide ? 14 : 12,
                  textAlign: "center",
                  color: dark ? "#94a3b8" : "#635949",
                  marginTop: 16,
                }}
              >
                Cecil Pines Adult Living Community Concierge: (904) 555-0100
              </Text>
              <Text style={[s.footer, { color: muted }]}>
                Version 1.0.0 • © 2026 TownLoop • All rights reserved.
              </Text>
            </LinearGradient>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", paddingVertical: 24 },
  portal: {
    width: "100%",
    maxWidth: 576,
    flexGrow: 1,
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#d8cdbc",
  },
  utility: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  switchCommunity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
  },
  brandPill: {
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  brandText: { fontFamily: "JakartaBold", fontSize: 11, color: "#065f46" },
  theme: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#ffffffcc",
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { alignItems: "center", marginBottom: 16 },
  emblem: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#fbbf24b3",
    boxShadow: "0px 8px 20px rgba(13,71,34,0.2)",
  },
  community: {
    fontFamily: "Playfair",
    fontSize: 38,
    color: "#0d4722",
    letterSpacing: -1,
  },
  goldRule: { width: 220, height: 4, marginVertical: 6, borderRadius: 2 },
  tagline: {
    fontFamily: "JakartaBold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#155a33",
    textAlign: "center",
  },
  residentPill: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#edf5ee",
    borderWidth: 1,
    borderColor: "#bcdbc6",
  },
  residentText: { fontFamily: "JakartaBold", fontSize: 12, color: "#124d2c" },
  card: {
    backgroundColor: "#fffefc",
    borderWidth: 2,
    borderColor: "#dfd5c3",
    borderRadius: 38,
    padding: 24,
    gap: 16,
    boxShadow:
      "0px 35px 80px -15px rgba(50,35,15,0.28), 0px 15px 30px -8px rgba(0,0,0,0.12)",
  },
  cardHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#ece3d4",
    paddingBottom: 12,
  },
  title: { fontFamily: "JakartaExtra", fontSize: 18 },
  securePill: {
    backgroundColor: "#f2ecde",
    borderWidth: 1,
    borderColor: "#dcd3c3",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  secureText: { fontFamily: "JakartaBold", fontSize: 10 },
  field: { gap: 6 },
  label: { fontFamily: "JakartaBold", fontSize: 14 },
  inputWrap: { justifyContent: "center" },
  inputIcon: { position: "absolute", left: 14, zIndex: 1 },
  input: {
    width: "100%",
    minHeight: 56,
    borderWidth: 2,
    borderColor: "#d4c8b6",
    borderRadius: 16,
    paddingLeft: 44,
    paddingRight: 14,
    paddingVertical: 12,
    backgroundColor: "#fcfaf5",
    fontFamily: "JakartaMedium",
    fontSize: 16,
    color: "#1c1917",
  },
  passwordHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgot: { minHeight: 44, justifyContent: "center" },
  forgotText: { fontFamily: "Jakarta", fontSize: 12 },
  eye: {
    position: "absolute",
    right: 6,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  notice: { padding: 12, borderRadius: 16, backgroundColor: "#f2ecde" },
  noticeText: { fontFamily: "Jakarta", fontSize: 14, lineHeight: 21 },
  submit: {
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 6px 14px rgba(13,71,34,0.2)",
  },
  submitInner: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  submitText: { fontFamily: "JakartaBold", fontSize: 17, color: "#fff" },
  security: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  securityText: { fontFamily: "Jakarta", fontSize: 11 },
  footer: {
    fontFamily: "Jakarta",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});
