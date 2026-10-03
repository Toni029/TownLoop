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
      <Row>
        <MapPin color="#047857" size={16} />
        <Txt bold>Cecil Pines</Txt>
        <Txt style={{ fontSize: 12 }}>• Jacksonville, FL</Txt>
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
        <>
          <Txt bold style={{ fontSize: 12 }}>
            {d.dayName.slice(0, 3)} •{" "}
            {h.time === "Now"
              ? data?.currentRealTimeWeather.label
              : `${h.time}: ${h.shortForecast}`}
          </Txt>
          <LinearGradient
            colors={backgrounds[h.icon]}
            style={{
              borderRadius: 28,
              padding: 20,
              overflow: "hidden",
              gap: 14,
              borderWidth: 1,
              borderColor: "#7dd3fc66",
            }}
          >
            <WeatherAtmosphere condition={h.icon} />
            <Row>
              <Txt
                bold
                style={{ color: "white", fontSize: 50, lineHeight: 62 }}
              >
                {h.temp}
              </Txt>
              <Txt bold style={{ color: "white", fontSize: 12 }}>
                H: {d.high} L: {d.low}
              </Txt>
            </Row>
            <Txt bold style={{ color: "white" }}>
              {h.condition}
            </Txt>
            <Row>
              <Txt style={{ color: "#ffffffcc", fontSize: 12 }}>
                Forecast • {h.time}
              </Txt>
              <Icon color="#fef3c7" size={20} />
              <Txt bold style={{ color: "white" }}>
                {h.shortForecast}
              </Txt>
            </Row>
            <View style={{ height: 1, backgroundColor: "#ffffff33" }} />
            <Row>
              <Clock size={16} color="white" />
              <Txt bold style={{ color: "white", fontSize: 11 }}>
                HOURLY FORECAST (NEXT 12 HOURS)
              </Txt>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Row style={{ flexWrap: "nowrap" }}>
                {d.hourly.map((item, i) => {
                  const I = icons[item.icon];
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityState={{ selected: hour === i }}
                      accessibilityLabel={`${item.time}, ${item.temp}, ${item.shortForecast}`}
                      onPress={() => setHour(i)}
                      style={{
                        minWidth: 66,
                        minHeight: 88,
                        padding: 10,
                        gap: 6,
                        alignItems: "center",
                        borderRadius: 16,
                        backgroundColor: hour === i ? "#ffffff44" : "#ffffff15",
                        borderWidth: 1,
                        borderColor: hour === i ? "#ffffffaa" : "transparent",
                      }}
                    >
                      <Txt bold style={{ color: "white", fontSize: 12 }}>
                        {item.time}
                      </Txt>
                      <I color="#fef3c7" size={20} />
                      <Txt bold style={{ color: "white" }}>
                        {item.temp}
                      </Txt>
                      {!!(item.pop) && (
                        <Txt style={{ color: "white", fontSize: 11 }}>
                          {item.pop}
                        </Txt>
                      )}
                    </Pressable>
                  );
                })}
              </Row>
            </ScrollView>
            <View style={{ height: 1, backgroundColor: "#ffffff33" }} />
            <Row>
              <Calendar size={16} color="white" />
              <Txt bold style={{ color: "white", fontSize: 12 }}>
                5-DAY OUTLOOK
              </Txt>
            </Row>
            <Txt style={{ color: "#ffffffcc", fontSize: 11 }}>
              Tap day to preview forecast
            </Txt>
            <Row style={{ alignItems: "stretch", gap: 4 }}>
              {data?.forecastDays.map((item, i) => {
                const I = icons[item.iconType];
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityState={{ selected: day === i }}
                    accessibilityLabel={`${item.dayName}, ${item.dateStr}, high ${item.high}, low ${item.low}, ${item.shortForecast}`}
                    onPress={() => {
                      setDay(i);
                      setHour(0);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 46,
                      minHeight: 100,
                      padding: 6,
                      gap: 4,
                      alignItems: "center",
                      borderRadius: 14,
                      backgroundColor: day === i ? "#fffffff2" : "#ffffff15",
                    }}
                  >
                    <Txt
                      bold
                      style={{
                        fontSize: 11,
                        color: day === i ? "#0f172a" : "white",
                      }}
                    >
                      {item.isToday ? "Today" : item.dayName.slice(0, 3)}
                    </Txt>
                    <I color={day === i ? "#64748b" : "#fde68a"} size={20} />
                    <Txt
                      bold
                      style={{
                        fontSize: 12,
                        color: day === i ? "#0f172a" : "white",
                      }}
                    >
                      {item.high}
                    </Txt>
                    <Txt
                      style={{
                        fontSize: 11,
                        color: day === i ? "#64748b" : "white",
                      }}
                    >
                      {item.low}
                    </Txt>
                  </Pressable>
                );
              })}
            </Row>
          </LinearGradient>
        </>
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
            right: -40,
            top: -50,
            width: 200,
            height: 200,
            borderRadius: 100,
            opacity: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.4],
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
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id="sunGlow">
                <Stop offset="0" stopColor="#fff7cc" />
                <Stop offset="0.4" stopColor="#fde68a" stopOpacity={0.6} />
                <Stop offset="1" stopColor="#fde68a" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={100} cy={100} r={100} fill="url(#sunGlow)" />
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
