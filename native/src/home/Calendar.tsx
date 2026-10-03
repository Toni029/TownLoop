import { View, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Action, Box, Row, Txt, usePalette } from "./ui";
import { localDate, parseDate } from "./model";
export function Calendar({
  month,
  setMonth,
  selected,
  onSelect,
  today,
  dots = {},
  color,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  selected: string;
  onSelect: (s: string) => void;
  today: string;
  dots?: Record<string, string[]>;
  color?: string;
}) {
  const p = usePalette();
  const y = month.getFullYear(),
    m = month.getMonth();
  const start = new Date(y, m, 1).getDay(),
    count = new Date(y, m + 1, 0).getDate();
  return (
    <Box style={{ padding: 8 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Action
          icon={ChevronLeft}
          iconOnly
          label="Previous Month"
          onPress={() => setMonth(new Date(y, m - 1, 1))}
        />
        <Txt bold style={{ flex: 1, textAlign: "center" }}>
          {month.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Txt>
        <Action
          icon={ChevronRight}
          iconOnly
          label="Next Month"
          onPress={() => setMonth(new Date(y, m + 1, 1))}
        />
      </Row>
      <Action
        label="Today"
        onPress={() => {
          setMonth(parseDate(today));
          onSelect(today);
        }}
        color={color}
      />
      <Row style={{ gap: 0 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <View key={d} style={{ width: "14.2857%", alignItems: "center" }}>
            <Txt bold style={{ color: p.muted, fontSize: 12 }}>
              {d}
            </Txt>
          </View>
        ))}
      </Row>
      <Row style={{ gap: 0 }}>
        {Array.from({ length: start + count }, (_, i) => {
          const day = i - start + 1;
          if (day < 1)
            return <View key={i} style={{ width: "14.2857%", height: 54 }} />;
          const date = localDate(new Date(y, m, day)),
            marks = dots[date] || [];
          return (
            <View
              key={i}
              style={{ width: "14.2857%", minHeight: 54, alignItems: "center" }}
            >
              <Day
                day={day}
                date={date}
                active={date === selected}
                today={date === today}
                dots={marks}
                onPress={() => onSelect(date)}
                color={color || p.green}
              />
            </View>
          );
        })}
      </Row>
    </Box>
  );
}
function Day({
  day,
  date,
  active,
  today,
  dots,
  onPress,
  color,
}: {
  day: number;
  date: string;
  active: boolean;
  today: boolean;
  dots: string[];
  onPress: () => void;
  color: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${parseDate(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${today ? ", Today" : ""}${dots.length ? `, ${dots.length} scheduled` : ""}`}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active
          ? color === p.blue
            ? "#026aa7"
            : "#047857"
          : p.paper,
        borderWidth: today ? 1 : 0,
        borderColor: color,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Txt bold style={{ color: active ? "#fff" : p.ink }}>
        {day}
      </Txt>
      <Row style={{ gap: 2, height: 9 }}>
        {dots.slice(0, 3).map((c, i) => (
          <View
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: 4,
              backgroundColor: active ? "#fff" : c,
            }}
          />
        ))}
        {dots.length > 3 && (
          <Txt
            style={{
              fontSize: 9,
              lineHeight: 9,
              color: active ? "#fff" : p.ink,
            }}
          >
            +
          </Txt>
        )}
      </Row>
    </Pressable>
  );
}
