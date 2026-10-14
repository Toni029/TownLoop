import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { friendlyError } from "../lib/profile";
export function ResidentRegistration({
  dark,
  wide,
  busy,
  setBusy,
  onError,
  onSignIn,
}: {
  dark: boolean;
  wide: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string) => void;
  onSignIn: () => void;
}) {
  const [fields, setFields] = useState({
      name: "",
      email: "",
      address: "",
      phone: "",
      password: "",
    }),
    [show, setShow] = useState(false);
  async function register() {
    if (busy) return;
    onError("");
    if (!fields.name.trim() || !fields.email.trim() || !fields.address.trim()) {
      onError("Please enter your name, email and street address.");
      return;
    }
    if (fields.password.length < 6) {
      onError("Password must be at least 6 characters long.");
      return;
    }
    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        fields.email.trim().toLowerCase(),
        fields.password,
      );
      await updateProfile(credential.user, { displayName: fields.name.trim() });
      await setDoc(doc(db, "users", credential.user.uid), {
        id: credential.user.uid,
        name: fields.name.trim(),
        email: credential.user.email,
        role: "resident",
        address: fields.address.trim(),
        phone: fields.phone.trim(),
        avatarUrl: "",
        approved: false,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      onError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const ink = dark ? "#e2e8f0" : "#243328",
    muted = dark ? "#94a3b8" : "#7e735e";
  return (
    <View style={{ gap: 14 }}>
      {(
        [
          ["name", "Resident Full Name", "e.g. Martha Stewart", User],
          ["email", "Resident Email Address", "resident@cecilpines.com", Mail],
          [
            "address",
            "Address (Street Address)",
            "e.g. 6100 Normandy Blvd",
            MapPin,
          ],
          ["phone", "Phone Number (optional)", "(904) 555-0100", Phone],
          [
            "password",
            "Create Password (min 6 characters)",
            "At least 6 characters",
            Lock,
          ],
        ] as const
      ).map(([key, label, placeholder, Icon]) => (
        <View key={key} style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: "JakartaBold",
              fontSize: wide ? 16 : 14,
              color: ink,
            }}
          >
            {label}
          </Text>
          <View style={{ justifyContent: "center" }}>
            <Icon
              size={20}
              color={muted}
              style={{ position: "absolute", left: 14, zIndex: 1 }}
            />
            <TextInput
              accessibilityLabel={label}
              value={fields[key]}
              editable={!busy}
              placeholder={placeholder}
              placeholderTextColor={dark ? "#64748b" : "#a8a29e"}
              onChangeText={(value) => setFields({ ...fields, [key]: value })}
              secureTextEntry={key === "password" && !show}
              keyboardType={
                key === "email"
                  ? "email-address"
                  : key === "phone"
                    ? "phone-pad"
                    : "default"
              }
              autoCapitalize={
                key === "email" || key === "password" ? "none" : "words"
              }
              style={{
                fontFamily: "JakartaMedium",
                fontSize: wide ? 18 : 16,
                color: dark ? "#fff" : "#1c1917",
                borderWidth: 2,
                borderColor: dark ? "#334155" : "#d4c8b6",
                backgroundColor: dark ? "#020617cc" : "#fcfaf5",
                borderRadius: 16,
                paddingLeft: 44,
                paddingRight: key === "password" ? 48 : 16,
                paddingVertical: wide ? 14 : 12,
                minHeight: wide ? 58 : 52,
              }}
            />
            {key === "password" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={show ? "Hide password" : "Show password"}
                onPress={() => setShow(!show)}
                style={{
                  position: "absolute",
                  right: 6,
                  width: 40,
                  height: 40,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {show ? (
                  <EyeOff size={20} color={muted} />
                ) : (
                  <Eye size={20} color={muted} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      ))}
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => void register()}
        style={({ pressed }) => ({
          marginTop: 12,
          borderRadius: 16,
          overflow: "hidden",
          opacity: busy ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          boxShadow: "0px 10px 15px -3px rgba(2,44,34,0.25)",
        })}
      >
        <LinearGradient
          colors={["#175d3a", "#124b2e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: wide ? 16 : 14,
            paddingHorizontal: 24,
            minHeight: 52,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "JakartaBold",
              fontSize: wide ? 18 : 16,
              color: "#fff",
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            {busy
              ? "Registering with Firestore..."
              : "Create Account & Request Approval"}
          </Text>
          <ArrowRight size={20} color="#fff" />
        </LinearGradient>
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 8,
        }}
      >
        <Text
          style={{
            fontFamily: "Jakarta",
            fontSize: wide ? 16 : 14,
            color: ink,
          }}
        >
          Already registered?
        </Text>
        <Pressable accessibilityRole="button" onPress={onSignIn}>
          <Text
            style={{
              fontFamily: "JakartaExtra",
              fontSize: wide ? 16 : 14,
              color: dark ? "#34d399" : "#047857",
            }}
          >
            Sign In
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
