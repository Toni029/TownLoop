import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Mail,
  Lock,
  ShieldCheck,
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
  const [community, setCommunity] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("selected_community")
      .then((value) => {
        if (!active) return;
        if (!value) router.replace("/communities");
        else setCommunity(value);
      })
      .catch(() => router.replace("/communities"));
    return () => {
      active = false;
    };
  }, []);
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={
          dark ? ["#020617", "#0f172a"] : ["#faf6f0", "#f5ede2", "#e9decb"]
        }
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.page}
          >
            <LinearGradient
              colors={
                dark
                  ? ["#020617", "#0f172a"]
                  : ["#f7f3ea", "#f1ebe0", "#e8decb"]
              }
              style={s.portal}
            >
              <View style={s.utility}>
                <View style={s.brandPill}>
                  <Text style={s.brandText}>TownLoop Resident Portal</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    dark
                      ? "Switch to light appearance"
                      : "Switch to dark appearance"
                  }
                  onPress={() => setDark(!dark)}
                  style={[s.theme, dark && { backgroundColor: "#1e293b" }]}
                >
                  {dark ? (
                    <Sun size={18} color="#fbbf24" />
                  ) : (
                    <Moon size={18} color="#334155" />
                  )}
                </Pressable>
              </View>
              <View style={s.identity}>
                <LinearGradient
                  colors={["#155a33", "#0d4722"]}
                  style={s.emblem}
                >
                  <CecilPinesMark />
                </LinearGradient>
                <Text
                  accessibilityRole="header"
                  style={[s.community, dark && { color: "#34d399" }]}
                >
                  {community === "cecil_pines"
                    ? "Cecil Pines"
                    : "Upcoming Community"}
                </Text>
                <LinearGradient
                  colors={["#d99c0000", "#d99c00", "#d99c0000"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.goldRule}
                />
                <Text style={[s.tagline, dark && { color: "#6ee7b7" }]}>
                  Active Adult Living Community
                </Text>
                <View style={s.residentPill}>
                  <Text style={s.residentText}>Resident Portal</Text>
                </View>
              </View>
              <View
                style={[
                  s.card,
                  dark && {
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                  },
                ]}
              >
                <View style={s.cardHeading}>
                  <Text
                    accessibilityRole="header"
                    style={[s.title, { color: dark ? "#fff" : "#154628" }]}
                  >
                    Resident Sign In
                  </Text>
                  <View
                    style={[
                      s.securePill,
                      dark && { backgroundColor: "#1e293b" },
                    ]}
                  >
                    <Text style={[s.secureText, { color: ink }]}>
                      Secure Access
                    </Text>
                  </View>
                </View>
                <View style={s.field}>
                  <Text style={[s.label, { color: ink }]}>
                    Resident Email Address
                  </Text>
                  <View style={s.inputWrap}>
                    <Mail size={20} color={muted} style={s.inputIcon} />
                    <TextInput
                      accessibilityLabel="Resident Email Address"
                      placeholder="e.g. resident@cecilpines.com"
                      placeholderTextColor={muted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      style={inputStyle}
                    />
                  </View>
                </View>
                <View style={s.field}>
                  <View style={s.passwordHeading}>
                    <Text style={[s.label, { color: ink }]}>Password</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void submit(true)}
                      style={s.forgot}
                    >
                      <Text style={[s.forgotText, { color: muted }]}>
                        Forgot password?
                      </Text>
                    </Pressable>
                  </View>
                  <View style={s.inputWrap}>
                    <Lock size={20} color={muted} style={s.inputIcon} />
                    <TextInput
                      accessibilityLabel="Password"
                      placeholder="Enter your password"
                      placeholderTextColor={muted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="current-password"
                      onSubmitEditing={() => void submit()}
                      style={[...inputStyle, { paddingRight: 52 }]}
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
                    style={[s.notice, dark && { backgroundColor: "#1e293b" }]}
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
                  ]}
                >
                  <LinearGradient
                    colors={["#1a643b", "#0d4722"]}
                    style={s.submitInner}
                  >
                    <Text style={s.submitText}>
                      {busy ? "Signing in…" : "Sign In"}
                    </Text>
                    <ArrowRight size={20} color="#fff" />
                  </LinearGradient>
                </Pressable>
                <View style={s.security}>
                  <ShieldCheck size={15} color={muted} />
                  <Text style={[s.securityText, { color: muted }]}>
                    Secure resident access
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/communities")}
                style={{ alignItems: "center", padding: 14 }}
              >
                <Text
                  style={{
                    fontFamily: "JakartaBold",
                    fontSize: 12,
                    color: muted,
                  }}
                >
                  Switch community
                </Text>
              </Pressable>
              <Text style={[s.footer, { color: muted }]}>
                © 2026 TownLoop • All rights reserved.
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
    marginBottom: 24,
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
  identity: { alignItems: "center", marginBottom: 24 },
  emblem: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#c99b3c",
    boxShadow: "0px 8px 20px rgba(13,71,34,0.2)",
  },
  community: {
    fontFamily: "PlayfairBlack",
    fontSize: 38,
    color: "#0d4722",
    letterSpacing: -1,
  },
  goldRule: { width: 220, height: 4, marginVertical: 8, borderRadius: 2 },
  tagline: {
    fontFamily: "JakartaBold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#155a33",
    textAlign: "center",
  },
  residentPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
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
    gap: 18,
    boxShadow: "0px 24px 50px -15px rgba(50,35,15,0.28)",
  },
  cardHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#ece3d4",
    paddingBottom: 16,
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
  field: { gap: 8 },
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
    fontFamily: "Jakarta",
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
    marginTop: 32,
  },
});
