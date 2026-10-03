import { useContext, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  List,
  Trash2,
  Dumbbell,
  Dog,
  Coffee,
  Dices,
  Trophy,
  UtensilsCrossed,
  Sparkles,
  Palette,
  Utensils,
  Stethoscope,
  Clock,
  MapPin,
  Plus,
  Check,
} from "lucide-react-native";
import {
  MONTHLY_ACTIVITIES_LIST,
  getMonthlyCalendarEvents,
  matchesReminder,
  parseDate,
  localDate,
  type TaskItem,
  type MonthlyRecurringEvent,
} from "./model";
import { Action, Box, Row, Tile, Txt, Theme, usePalette } from "./ui";
import { Calendar } from "./Calendar";
const icons = {
  trash: Trash2,
  exercise: Dumbbell,
  puppy: Dog,
  coffee: Coffee,
  game: Dices,
  bowling: Trophy,
  potluck: UtensilsCrossed,
  bingo: Sparkles,
  crafts: Palette,
  lunch: Utensils,
  doctor: Stethoscope,
};
const categoryColors = {
  health: "#2563eb",
  wellness: "#059669",
  dining: "#e11d48",
  creative: "#db2777",
  service: "#d97706",
  social: "#4f46e5",
  games: "#4f46e5",
};
const filters = [
  ["all", "All Activities"],
  ["wellness", "Wellness"],
  ["social", "Social & Fun"],
  ["dining", "Dining"],
  ["creative", "Creative"],
  ["games", "Games"],
  ["health", "Health"],
  ["service", "Services"],
];
export function Activities({
  today,
  tasks,
  onToggle,
  busy,
}: {
  today: string;
  tasks: TaskItem[];
  onToggle: (e: MonthlyRecurringEvent, date: string) => void;
  busy: boolean;
}) {
  const p = usePalette();
  const dark = useContext(Theme);
  const [selected, setSelected] = useState(today),
    [month, setMonth] = useState(() => parseDate(today)),
    [mode, setMode] = useState<"calendar" | "list">("calendar"),
    [filter, setFilter] = useState("all");
  const events = useMemo(
    () => getMonthlyCalendarEvents(month.getFullYear(), month.getMonth()),
    [month],
  );
  const dots = Object.fromEntries(
    Object.entries(events).map(([d, list]) => [
      localDate(new Date(month.getFullYear(), month.getMonth(), Number(d))),
      list.map((e) => categoryColors[e.category]),
    ]),
  );
  const selectedEvents = events[parseDate(selected).getDate()] || [];
  return (
    <Tile>
      <Row>
        <CalendarDays color={p.blue} size={20} />
        <Txt bold accessibilityRole="header" style={{ fontSize: 16, flex: 1 }}>
          Monthly Activity Reminder
        </Txt>
      </Row>
      <Txt
        bold
        style={{
          color: dark ? "#93c5fdcc" : "#026aa7cc",
          fontFamily: "JakartaSemi",
          fontSize: 11,
          lineHeight: 16.5,
          marginTop: -12,
        }}
      >
        Recurring monthly gatherings, health visits & weekly routines
      </Txt>
      <Row
        style={{
          alignSelf: "flex-start",
          gap: 4,
          padding: 4,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: dark ? "#334155" : "#bcd6ee",
          backgroundColor: dark ? "#1e293bcc" : "#ffffffcc",
        }}
      >
        <Action
          square
          icon={CalendarIcon}
          label="Calendar"
          active={mode === "calendar"}
          borderless
          color={mode === "calendar" ? p.blue : dark ? "#cbd5e1" : "#57534e"}
          onPress={() => setMode("calendar")}
        />
        <Action
          square
          icon={List}
          label="All Activities"
          active={mode === "list"}
          borderless
          color={mode === "list" ? p.blue : dark ? "#cbd5e1" : "#57534e"}
          onPress={() => setMode("list")}
        />
      </Row>
      {mode === "calendar" ? (
        <>
          <Calendar
            month={month}
            setMonth={(d) => {
              setMonth(d);
              setSelected(localDate(d));
            }}
            selected={selected}
            onSelect={setSelected}
            today={today}
            dots={dots}
            color={p.blue}
          />
          <Box
            style={{
              padding: 14,
              borderColor: dark ? "#1e293b" : "#cfe1f2",
              gap: 10,
            }}
          >
            <Row
              style={{
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderColor: dark ? "#1e293b" : "#f5f5f4",
                paddingBottom: 10,
              }}
            >
              <Row style={{ gap: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: p.blue,
                  }}
                />
                <Txt
                  bold
                  style={{
                    fontFamily: "JakartaExtra",
                    fontSize: 12,
                    lineHeight: 18,
                  }}
                >
                  {parseDate(selected).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </Txt>
              </Row>
              <Txt
                bold
                style={{
                  color: p.blue,
                  fontSize: 11,
                  lineHeight: 16.5,
                  backgroundColor: dark ? "#17255499" : "#e3eef8",
                  borderColor: dark ? "#1e40af" : "#bcd6ee",
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                  borderRadius: 99,
                }}
              >
                {selectedEvents.length}{" "}
                {selectedEvents.length === 1 ? "Activity" : "Activities"}
              </Txt>
            </Row>
            {!selectedEvents.length ? (
              <View style={{ paddingVertical: 16, gap: 2 }}>
                <Txt
                  bold
                  style={{
                    color: dark ? "#64748b" : "#a8a29e",
                    fontSize: 12,
                    lineHeight: 18,
                    textAlign: "center",
                    fontFamily: "JakartaSemi",
                  }}
                >
                  No recurring activities scheduled for this date.
                </Txt>
                <Txt
                  style={{
                    color: dark ? "#64748b" : "#a8a29e",
                    fontSize: 10,
                    lineHeight: 15,
                    textAlign: "center",
                  }}
                >
                  Select a day with color dots to see reminders and routines.
                </Txt>
              </View>
            ) : (
              selectedEvents.map((e) => (
                <Activity
                  key={e.id}
                  event={e}
                  added={tasks.some((t) => matchesReminder(t, e, selected))}
                  toggle={() => onToggle(e, selected)}
                  busy={busy}
                />
              ))
            )}
          </Box>
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row>
              {filters.map(([id, label]) => (
                <Action
                  key={id}
                  label={label}
                  active={filter === id}
                  color={p.blue}
                  onPress={() => setFilter(id)}
                />
              ))}
            </Row>
          </ScrollView>
          {MONTHLY_ACTIVITIES_LIST.filter(
            (e) => filter === "all" || e.category === filter,
          ).map((e) => (
            <Activity
              key={e.id}
              event={e}
              list
              added={tasks.some((t) => matchesReminder(t, e, today))}
              toggle={() => onToggle(e, today)}
              busy={busy}
            />
          ))}
        </>
      )}
    </Tile>
  );
}
function Activity({
  event: e,
  added,
  toggle,
  list = false,
  busy,
}: {
  event: MonthlyRecurringEvent;
  added: boolean;
  toggle: () => void;
  list?: boolean;
  busy: boolean;
}) {
  const p = usePalette(),
    Icon = icons[e.iconType];
  return (
    <Box>
      <Row>
        <Icon size={20} color={categoryColors[e.category]} />
        <Txt bold style={{ fontSize: 14, lineHeight: 20, flex: 1 }}>
          {e.title}
        </Txt>
      </Row>
      <Row>
        <CalendarDays size={16} color={categoryColors[e.category]} />
        <Txt bold style={{ flex: 1 }}>
          {e.recurrenceLabel}
        </Txt>
      </Row>
      <Row>
        <Clock size={16} color={p.blue} />
        <Txt bold>{e.time}</Txt>
      </Row>
      <Row>
        <MapPin size={16} color={p.muted} />
        <Txt style={{ color: p.muted, flex: 1 }}>{e.location}</Txt>
      </Row>
      <Txt style={{ fontSize: 12, lineHeight: 19.5 }}>{e.description}</Txt>
      <Action
        disabled={busy}
        icon={added ? Check : Plus}
        color={added ? p.green : p.blue}
        label={
          list
            ? added
              ? "Added Today (Tap to Remove)"
              : "Add to Today's Checklist"
            : added
              ? "Added to Checklist (Tap to Remove)"
              : "Add to Daily Checklist"
        }
        onPress={toggle}
      />
    </Box>
  );
}
