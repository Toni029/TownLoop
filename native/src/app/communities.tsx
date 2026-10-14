import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useCommunity } from "../lib/community";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Moon,
  Sun,
  ShieldCheck,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";
import { CecilPinesMark } from "../components/CecilPinesMark";
const features = [
  "Full Resident Portal & Daily Check-Ins",
  "Direct Maintenance Work Order Tracking",
  "Neighborhood Social Feed & Marketplace",
  "Daily Community Activities & Calendars",
];
export default function Communities() {
  const { selectCommunity } = useCommunity();
  const [dark, setDark] = useState(false),
    [hovered, setHovered] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const wide = useWindowDimensions().width >= 640;
  const ink = dark ? "#fff" : "#1c1917",
    muted = dark ? "#cbd5e1" : "#57534e";
  const text = (size: number, bold = false) => ({
    fontFamily: bold ? "JakartaBold" : "Jakarta",
    fontSize: size,
    color: ink,
  });
  async function select(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await selectCommunity(id);
    } catch {
      setError("Unable to save your community. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <LinearGradient
      colors={
        dark
          ? ["#020617", "#0f172a", "#020617"]
          : ["#faf6f0", "#f5ede2", "#e9decb"]
      }
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: wide ? 24 : 0,
          }}
        >
          <LinearGradient
            colors={
              dark
                ? ["#020617", "#0f172a", "#020617"]
                : ["#f7f3ea", "#f1ebe0", "#e8decb"]
            }
            style={{
              width: "100%",
              maxWidth: 576,
              borderRadius: wide ? 44 : 0,
              borderWidth: 1,
              borderColor: dark ? "#1e293b" : "#d8cdbc",
              boxShadow: "0px 24px 50px -12px rgba(110,85,60,0.12)",
            }}
          >
            <Animated.View
              entering={FadeIn.duration(150)}
              style={{ padding: wide ? 28 : 16, gap: 0 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 4,
                  marginBottom: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor: dark ? "#065f46" : "#a7f3d0",
                    backgroundColor: dark ? "#022c22b3" : "#d1fae5",
                  }}
                >
                  <Image
                    source={require("../../assets/townloop-brand.png")}
                    accessibilityLabel="TownLoop Logo"
                    style={{ width: 16, height: 16 }}
                  />
                  <Text
                    style={{
                      ...text(12, true),
                      color: dark ? "#6ee7b7" : "#065f46",
                    }}
                  >
                    TownLoop Log in Portal
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    dark ? "Switch to Light Mode" : "Switch to Dark Mode"
                  }
                  hitSlop={8}
                  onPress={() => setDark(!dark)}
                  style={{
                    padding: 6,
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor: dark ? "#334155" : "#e7e5e4",
                    backgroundColor: dark ? "#1e293be6" : "#ffffffe6",
                  }}
                >
                  {dark ? (
                    <Sun size={14} color="#fbbf24" />
                  ) : (
                    <Moon size={14} color="#334155" />
                  )}
                </Pressable>
              </View>
              <View style={{ alignItems: "center", gap: 8, marginBottom: 24 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    ...text(wide ? 30 : 24, true),
                    fontFamily: "JakartaExtra",
                    letterSpacing: -0.6,
                    textAlign: "center",
                    lineHeight: wide ? 36 : 30,
                  }}
                >
                  Welcome to TownLoop
                </Text>
                <Text
                  style={{
                    ...text(wide ? 16 : 14),
                    fontFamily: "JakartaSemi",
                    color: muted,
                    textAlign: "center",
                  }}
                >
                  Select your community to continue
                </Text>
              </View>
              <View style={{ gap: 16, marginVertical: 8 }}>
                {["cecil_pines", "upcoming_community"].map((id) => {
                  const primary = id === "cecil_pines",
                    hover = hovered === id;
                  const name = primary ? "Cecil Pines" : "Upcoming Community";
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={`Continue with ${name}`}
                      disabled={busy}
                      onHoverIn={() => setHovered(id)}
                      onHoverOut={() => setHovered("")}
                      onPress={() => void select(id)}
                      style={({ pressed }) => ({
                        padding: wide ? 24 : 20,
                        borderRadius: wide ? 36 : 32,
                        borderWidth: 2,
                        borderColor: primary
                          ? hover
                            ? "#047857"
                            : "#059669"
                          : dark
                            ? "#334155"
                            : "#d6d3d1",
                        backgroundColor: dark
                          ? hover
                            ? "#1e293bf2"
                            : "#0f172af2"
                          : primary
                            ? hover
                              ? "#ecfdf566"
                              : "#fff"
                            : hover
                              ? "#fafaf9"
                              : "#ffffffe6",
                        opacity: pressed ? 0.9 : 1,
                        boxShadow: primary
                          ? "0px 20px 50px -10px rgba(50,35,15,0.2)"
                          : "0px 15px 35px -10px rgba(50,35,15,0.12)",
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 14,
                          alignItems: "flex-start",
                        }}
                      >
                        <LinearGradient
                          colors={
                            primary
                              ? ["#185d3b", "#145334", "#0c3621"]
                              : dark
                                ? ["#1e293b", "#1e293b", "#0f172a"]
                                : ["#e7e5e4", "#d6d3d1", "#a8a29e"]
                          }
                          style={{
                            width: wide ? 56 : 52,
                            height: wide ? 56 : 52,
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: primary ? "#fbbf24b3" : "#a8a29ecc",
                            borderStyle: primary ? "solid" : "dashed",
                            justifyContent: "center",
                            alignItems: "center",
                            transform: [{ scale: hover ? 1.05 : 1 }],
                          }}
                        >
                          {primary ? (
                            <CecilPinesMark size={wide ? 40 : 36} />
                          ) : (
                            <Svg
                              width={wide ? 36 : 32}
                              height={wide ? 36 : 32}
                              viewBox="0 0 100 100"
                            >
                              <Path
                                d="M50 14 L80 26 C80 58 50 82 50 86 C50 82 20 58 20 26 Z"
                                stroke="#78716c"
                                strokeWidth={3.5}
                                strokeDasharray="4 3"
                                fill="none"
                              />
                              <Path
                                d="M36 58 L50 44 L64 58 M42 58 L42 68 L58 68 L58 58"
                                stroke="#78716c"
                                strokeWidth={3}
                                fill="none"
                              />
                            </Svg>
                          )}
                        </LinearGradient>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <Text style={text(wide ? 20 : 18, true)}>
                              {name}
                            </Text>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 99,
                                borderWidth: 1,
                                borderColor: primary ? "#6ee7b7" : "#d6d3d1",
                                backgroundColor: primary
                                  ? dark
                                    ? "#022c22"
                                    : "#d1fae5"
                                  : dark
                                    ? "#1e293b"
                                    : "#e7e5e4",
                              }}
                            >
                              <Text
                                style={{
                                  ...text(10, true),
                                  color: primary
                                    ? dark
                                      ? "#6ee7b7"
                                      : "#065f46"
                                    : muted,
                                  textTransform: "uppercase",
                                }}
                              >
                                {primary
                                  ? "Primary Community"
                                  : "Upcoming Community"}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={{
                              ...text(wide ? 14 : 12, true),
                              color: muted,
                            }}
                          >
                            Active Adult Living Community
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              alignItems: "center",
                              marginTop: 4,
                            }}
                          >
                            <MapPin size={12} color="#059669" />
                            <Text
                              style={{
                                ...text(11),
                                color: dark ? "#94a3b8" : "#78716c",
                              }}
                            >
                              Jacksonville, Florida
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            width: wide ? 40 : 36,
                            height: wide ? 40 : 36,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: primary
                              ? "#059669"
                              : dark
                                ? "#1e293b"
                                : "#f5f5f4",
                            transform: [{ translateX: hover ? 4 : 0 }],
                          }}
                        >
                          <ArrowRight
                            size={wide ? 20 : 16}
                            color={primary ? "#fff" : muted}
                            strokeWidth={2.5}
                          />
                        </View>
                      </View>
                      <View
                        style={{
                          marginTop: 14,
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderColor: dark ? "#1e293b" : "#f5f5f4",
                          flexDirection: "row",
                          flexWrap: "wrap",
                          rowGap: 6,
                        }}
                      >
                        {features.map((feature) => (
                          <View
                            key={feature}
                            style={{
                              width: wide ? "50%" : "100%",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              paddingRight: 4,
                            }}
                          >
                            <CheckCircle2
                              size={14}
                              color={primary ? "#059669" : "#a8a29e"}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                ...text(wide ? 12 : 11),
                                color: muted,
                                flex: 1,
                              }}
                            >
                              {feature}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View
                        style={{
                          marginTop: 14,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          backgroundColor: primary
                            ? hover
                              ? "#047857"
                              : "#059669"
                            : dark
                              ? "#1e293b"
                              : "#e7e5e4e6",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          style={{
                            ...text(wide ? 14 : 12, true),
                            color: primary ? "#fff" : ink,
                            textAlign: "center",
                          }}
                        >
                          Continue with {name}
                        </Text>
                        <ArrowRight size={14} color={primary ? "#fff" : ink} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {!!error && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ ...text(12), textAlign: "center" }}
                >
                  {error}
                </Text>
              )}
              <View style={{ paddingTop: 16, gap: 6, alignItems: "center" }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 4,
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={14} color="#059669" />
                  <Text
                    style={{
                      ...text(11),
                      color: dark ? "#94a3b8" : "#78716c",
                      textAlign: "center",
                      flexShrink: 1,
                    }}
                  >
                    Your selection is saved securely on this device. You can
                    switch communities anytime in Settings.
                  </Text>
                </View>
                <Text
                  style={{ ...text(11), color: "#a8a29e", textAlign: "center" }}
                >
                  Version 1.0.0 • © 2026 TownLoop • All rights reserved.
                </Text>
              </View>
            </Animated.View>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
