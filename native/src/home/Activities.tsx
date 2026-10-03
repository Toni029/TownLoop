import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
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
import { Action, Box, Row, Tile, Txt, usePalette } from "./ui";
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
          color: p.blue,
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
          borderColor: "#bcd6ee",
          backgroundColor: "#ffffffcc",
        }}
      >
        <Action
          square
          icon={CalendarIcon}
          label="Calendar"
          active={mode === "calendar"}
          color={p.blue}
          onPress={() => setMode("calendar")}
        />
        <Action
          square
          icon={List}
          label="All Activities"
          active={mode === "list"}
          color={p.blue}
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
          <Box>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt bold>
                {parseDate(selected).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Txt>
              <Txt bold style={{ color: p.blue }}>
                {selectedEvents.length}{" "}
                {selectedEvents.length === 1 ? "Activity" : "Activities"}
              </Txt>
            </Row>
            {!selectedEvents.length ? (
              <>
                <Txt style={{ color: p.muted }}>
                  No recurring activities scheduled for this date.
                </Txt>
                <Txt style={{ color: p.muted }}>
                  Select a day with color dots to see reminders and routines.
                </Txt>
              </>
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
