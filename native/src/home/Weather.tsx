import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path,
  Circle,
  Line,
  RadialGradient,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import {
  MapPin,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  Wind,
  Snowflake,
  CloudFog,
  Clock,
  Calendar,
  Sparkles,
  ChevronRight,
} from "lucide-react-native";
import { Action, Box, Row, Txt } from "./ui";
import { useReducedMotion } from "./hooks";
import {
  OPEN_METEO_API_URL,
  parseWeather,
  type WeatherData,
  type WeatherConditionType,
} from "./weatherModel";
const icons = {
  sun: Sun,
  cloud: Cloud,
  cloudSun: CloudSun,
  rain: CloudRain,
  storm: CloudLightning,
  wind: Wind,
  snow: Snowflake,
  fog: CloudFog,
};
const backgrounds: Record<
  WeatherConditionType,
  readonly [string, string, string]
> = {
  sun: ["#165bb8", "#277ece", "#5ea7f7"],
  cloudSun: ["#1c4f7f", "#306695", "#558bb3"],
  cloud: ["#1b2636", "#2d3a4d", "#455468"],
  rain: ["#0b1625", "#142337", "#22364f"],
  wind: ["#173e63", "#24537c", "#3f739e"],
  snow: ["#2b3a4a", "#43576c", "#6c859e"],
  fog: ["#333d47", "#4a5560", "#6b7782"],
  storm: ["#070b14", "#0f1624", "#182133"],
};
const TTL = 45 * 60 * 1000;
let cache: { at: number; data: WeatherData } | undefined;
export function Weather() {
  const [data, setData] = useState<WeatherData | undefined>(cache?.data),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!cache),
    [attempt, setAttempt] = useState(0),
    [day, setDay] = useState(0),
    [hour, setHour] = useState(0);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      if (cache && Date.now() - cache.at < TTL) {
        setData(cache.data);
        setLoading(false);
        return;
      }
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      setLoading(true);
      try {
        const r = await fetch(OPEN_METEO_API_URL, {
          signal: controller.signal,
        });
        if (!r.ok) throw Error("Weather unavailable");
        const next = parseWeather(await r.json());
        if (active) {
          cache = { at: Date.now(), data: next };
          setData(next);
          setDay(0);
          setHour(0);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Weather could not be updated. Check your connection and retry.",
          );
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      sub.remove();
    };
  }, [attempt]);
  const d = data?.forecastDays[day] || data?.forecastDays[0],
    h = d?.hourly[hour] || d?.hourly[0];
  const Icon = h ? icons[h.icon] : Sun;
  return (
    <View style={{ gap: 8 }}>
      <Row
        style={{
          justifyContent: "space-between",
          paddingHorizontal: 4,
          flexWrap: "nowrap",
        }}
      >
        <Row style={{ gap: 6, flexShrink: 1 }}>
          <MapPin color="#047857" size={14} />
          <Txt
            bold
            style={{
              fontSize: 12,
              lineHeight: 16,
              color: "#1c1917",
              letterSpacing: -0.3,
            }}
          >
            Cecil Pines
          </Txt>
        </Row>
        {!!d && !!h && (
          <Row
            style={{
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: h.icon === "sun" ? "#fcd34d" : "#cbd5e1",
              backgroundColor: h.icon === "sun" ? "#fef3c7" : "#e7e5e4",
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: h.icon === "sun" ? "#f59e0b" : "#64748b",
              }}
            />
            <Txt
              bold
              style={{
                fontSize: 12,
                lineHeight: 16,
                color: h.icon === "sun" ? "#451a03" : "#1c1917",
              }}
            >
              {d.dayName.slice(0, 3)} •{" "}
              {h.time === "Now"
                ? data?.currentRealTimeWeather.label
                : `${h.time}: ${h.shortForecast}`}
            </Txt>
          </Row>
        )}
      </Row>
      {!!error && (
        <Box>
          <Txt accessibilityRole="alert">
            {error}
            {data ? " Showing the last received forecast." : ""}
          </Txt>
          <Action
            label="Retry weather"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </Box>
      )}
      {!d || !h ? (
        <Box>
          <ActivityIndicator color="#026aa7" />
          <Txt>{loading ? "Loading weather…" : "Weather unavailable."}</Txt>
        </Box>
      ) : (
        <LinearGradient
          colors={backgrounds[h.icon]}
          style={{
            borderRadius: 28,
            padding: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#7dd3fc66",
            boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
          }}
        >
          {h.icon === "sun" && (
            <LinearGradient
              pointerEvents="none"
              colors={["#fde68a4d", "#fef08a26", "#fef08a00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <WeatherAtmosphere condition={h.icon} />
          <Row
            style={{
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "nowrap",
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Row
                style={{ gap: 8, alignItems: "baseline", flexWrap: "nowrap" }}
              >
                <Txt
                  bold
                  style={{
                    fontFamily: "JakartaExtra",
                    color: "#fff",
                    fontSize: 48,
                    lineHeight: 48,
                    letterSpacing: -1.2,
                  }}
                >
                  {h.temp}
                </Txt>
                <Txt
                  bold
                  style={{ fontSize: 12, lineHeight: 18, color: "#ffffffe6" }}
                >
                  H: {d.high} L: {d.low}
                </Txt>
              </Row>
              <Row style={{ gap: 6, flexWrap: "nowrap" }}>
                <Sparkles size={14} color="#fde047" />
                <Txt
                  bold
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    color: "#fffffff2",
                    flexShrink: 1,
                  }}
                >
                  {h.condition}
                </Txt>
              </Row>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Txt
                bold
                style={{
                  fontSize: 10,
                  lineHeight: 15,
                  letterSpacing: 1,
                  color: "#ffffffbf",
                  textTransform: "uppercase",
                }}
              >
                Forecast • {h.time}
              </Txt>
              <Row
                style={{
                  marginTop: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#ffffff40",
                  backgroundColor: "#00000059",
                  gap: 6,
                  flexWrap: "nowrap",
                }}
              >
                <Icon size={14} color="#fde047" />
                <Txt
                  bold
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: 16,
                    letterSpacing: -0.3,
                  }}
                >
                  {h.shortForecast}
                </Txt>
              </Row>
            </View>
          </Row>
          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderColor: "#ffffff33",
              gap: 8,
            }}
          >
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "nowrap",
                gap: 4,
              }}
            >
              <Row style={{ gap: 6, flex: 1, flexWrap: "nowrap" }}>
                <Clock size={14} color="#ffffffcc" />
                <Txt
                  bold
                  style={{
                    fontSize: 11,
                    lineHeight: 16.5,
                    color: "#ffffffe6",
                    flexShrink: 1,
                  }}
                >
                  HOURLY FORECAST (NEXT 12 HOURS)
                </Txt>
              </Row>
              <Row style={{ gap: 4, width: 112, flexWrap: "nowrap" }}>
                <Txt
                  style={{
                    fontSize: 10,
                    lineHeight: 15,
                    color: "#ffffffbf",
                    flex: 1,
                  }}
                >
                  Swipe hours to preview
                </Txt>
                <ChevronRight size={12} color="#ffffff99" />
              </Row>
            </Row>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingVertical: 4,
                paddingHorizontal: 2,
              }}
            >
              <Row style={{ flexWrap: "nowrap", gap: 8 }}>
                {d.hourly.map((item, i) => {
                  const I = icons[item.icon];
                  const selected = hour === i;
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${item.time}, ${item.temp}, ${item.shortForecast}`}
                      onPress={() => setHour(i)}
                      style={{
                        minWidth: 64,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        alignItems: "center",
                        borderRadius: 16,
                        backgroundColor: selected ? "#ffffff59" : "#00000040",
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? "#fff" : "#ffffff26",
                        transform: [{ scale: selected ? 1.05 : 1 }],
                        boxShadow: selected
                          ? "0px 0px 0px 2px rgba(255,255,255,0.4)"
                          : undefined,
                      }}
                    >
                      <Txt
                        bold
                        style={{
                          fontSize: 10,
                          lineHeight: 12.5,
                          color: selected ? "#fff" : "#ffffffcc",
                        }}
                      >
                        {item.time}
                      </Txt>
                      <View style={{ marginVertical: 6 }}>
                        <I size={16} color="#fef08a" />
                      </View>
                      {!!item.pop && (
                        <Txt
                          bold
                          style={{
                            fontSize: 9,
                            lineHeight: 10,
                            color: "#67e8f9",
                            marginBottom: 4,
                          }}
                        >
                          {item.pop}
                        </Txt>
                      )}
                      <Txt
                        bold
                        style={{
                          fontFamily: "JakartaExtra",
                          color: "#fff",
                          fontSize: 12,
                          lineHeight: 15,
                        }}
                      >
                        {item.temp}
                      </Txt>
                      {selected && (
                        <View
                          style={{
                            marginTop: 4,
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: "#fff",
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </Row>
            </ScrollView>
          </View>
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderColor: "#ffffff33",
              gap: 8,
            }}
          >
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "nowrap",
                gap: 4,
              }}
            >
              <Row style={{ gap: 4 }}>
                <Calendar size={12} color="#ffffffb3" />
                <Txt
                  bold
                  style={{ fontSize: 11, lineHeight: 16.5, color: "#ffffffd9" }}
                >
                  5-DAY OUTLOOK
                </Txt>
              </Row>
              <Txt style={{ fontSize: 10, lineHeight: 15, color: "#ffffffb3" }}>
                Tap day to preview forecast
              </Txt>
            </Row>
            <Row style={{ alignItems: "stretch", gap: 6, flexWrap: "nowrap" }}>
              {data?.forecastDays.map((item, i) => {
                const I = icons[item.iconType];
                const selected = day === i;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.dayName}, ${item.dateStr}, high ${item.high}, low ${item.low}, ${item.shortForecast}`}
                    onPress={() => {
                      setDay(i);
                      setHour(0);
                    }}
                    style={{
                      flex: 1,
                      paddingHorizontal: 4,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderRadius: 12,
                      backgroundColor: selected ? "#fff" : "#00000040",
                      boxShadow: selected
                        ? "0px 0px 0px 2px rgba(255,255,255,0.9)"
                        : undefined,
                    }}
                  >
                    <Txt
                      bold
                      style={{
                        fontSize: 10,
                        lineHeight: 12.5,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        color: selected ? "#0f172a" : "#ffffffe6",
                      }}
                    >
                      {item.isToday ? "Today" : item.dayName.slice(0, 3)}
                    </Txt>
                    <View style={{ marginVertical: 4 }}>
                      <I size={14} color={selected ? "#f59e0b" : "#fef08a"} />
                    </View>
                    <Txt
                      bold
                      style={{
                        fontFamily: "JakartaExtra",
                        fontSize: 12,
                        lineHeight: 15,
                        color: selected ? "#0f172a" : "#fff",
                      }}
                    >
                      {item.high}
                    </Txt>
                    <Txt
                      style={{
                        fontSize: 9,
                        lineHeight: 11.25,
                        color: selected ? "#64748b" : "#ffffffb3",
                      }}
                    >
                      {item.low}
                    </Txt>
                  </Pressable>
                );
              })}
            </Row>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

function WeatherAtmosphere({ condition }: { condition: WeatherConditionType }) {
  const reduced = useReducedMotion(),
    v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    v.setValue(0);
    if (reduced) return;
    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration:
            condition === "rain" || condition === "storm"
              ? 1500
              : condition === "wind"
                ? 4000
                : 12000,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: condition === "rain" || condition === "storm" ? 0 : 12000,
          useNativeDriver: true,
        }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [v, reduced, condition]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      {(condition === "sun" || condition === "cloudSun") && (
        <Animated.View
          style={{
            position: "absolute",
            right: -125,
            top: -140,
            width: 400,
            height: 400,
            borderRadius: 200,
            opacity: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
            transform: [
              {
                scale: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.15],
                }),
              },
            ],
          }}
        >
          <Svg width={400} height={400} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id="sunGlow">
                <Stop offset="0" stopColor="#fff7cc" />
                <Stop offset="0.4" stopColor="#fde68a" stopOpacity={0.6} />
                <Stop offset="1" stopColor="#fde68a" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={100} cy={100} r={100} fill="url(#sunGlow)" />
            {Array.from({ length: 28 }, (_, i) => (
              <Line
                key={i}
                x1={100 + 22 * Math.cos((i * Math.PI) / 14)}
                y1={100 + 22 * Math.sin((i * Math.PI) / 14)}
                x2={100 + 130 * Math.cos((i * Math.PI) / 14)}
                y2={100 + 130 * Math.sin((i * Math.PI) / 14)}
                stroke="#fff7cc"
                strokeOpacity={0.32}
                strokeWidth={0.9}
              />
            ))}
          </Svg>
        </Animated.View>
      )}
      {condition !== "sun" && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: -50,
            right: -50,
            opacity: 0.3,
            transform: [
              {
                translateX: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-35, 35],
                }),
              },
            ],
          }}
        >
          <Svg height={190} width="100%" viewBox="0 0 360 140">
            <Defs>
              <SvgGradient id="cloud" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#e2e8f0" />
                <Stop offset="1" stopColor="#64748b" stopOpacity={0} />
              </SvgGradient>
            </Defs>
            <Path
              fill="url(#cloud)"
              d="M0 110 C35 65 85 55 135 70 C180 30 245 25 285 55 C310 45 335 65 360 95 L360 140 L0 140 Z"
            />
          </Svg>
        </Animated.View>
      )}
      {(condition === "rain" ||
        condition === "storm" ||
        condition === "snow") &&
        Array.from({ length: 14 }, (_, i) => (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: `${i * 7}%`,
              top: (i % 3) * 40,
              width: condition === "snow" ? 5 : 1,
              height: condition === "snow" ? 5 : 22,
              borderRadius: 4,
              backgroundColor: "#e0f2fe",
              opacity: 0.25,
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 220],
                  }),
                },
              ],
            }}
          />
        ))}
    </View>
  );
}
