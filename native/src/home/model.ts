import type { TaskItem, MedicationItem } from "../../../src/types";
import type { MonthlyRecurringEvent } from "../../../src/data/monthlyActivities.ts";
export {
  MONTHLY_ACTIVITIES_LIST,
  getMonthlyCalendarEvents,
} from "../../../src/data/monthlyActivities.ts";
export type { TaskItem, MedicationItem, MonthlyRecurringEvent };
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const nextDate = (s: string) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + 1);
  return localDate(d);
};
export const friendlyDate = (s: string) =>
  parseDate(s).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
export const activityTitle = (e: MonthlyRecurringEvent) =>
  `${e.title} (${e.time})`;
export const matchesReminder = (
  t: TaskItem,
  e: MonthlyRecurringEvent,
  date: string,
) =>
  t.date === date &&
  (t.text.trim().toLowerCase() === activityTitle(e).toLowerCase() ||
    t.text.trim().toLowerCase().startsWith(e.title.trim().toLowerCase()));
export const nextTaskId = (tasks: TaskItem[]) =>
  tasks.reduce((id, t) => Math.max(id, t.id + 1), Date.now());
export function toggleReminder(
  tasks: TaskItem[],
  e: MonthlyRecurringEvent,
  date: string,
): TaskItem[] {
  return tasks.some((t) => matchesReminder(t, e, date))
    ? tasks.filter((t) => !matchesReminder(t, e, date))
    : [
        { id: nextTaskId(tasks), text: activityTitle(e), date, done: false },
        ...tasks,
      ];
}
export const slots = [
  { id: "morning", title: "Morning", sub: "With Breakfast" },
  { id: "noon", title: "Noon", sub: "Lunchtime" },
  { id: "evening", title: "Evening", sub: "With Dinner" },
  { id: "bedtime", title: "Bedtime", sub: "Before Sleep" },
] as const;
export function takeDose(
  m: MedicationItem,
  today: string,
  now = new Date(),
): MedicationItem {
  if (m.lastTakenDate === today) return m;
  return {
    ...m,
    bottleCount: Math.max(0, m.bottleCount - m.doseCount),
    lastTakenDate: today,
    lastTakenTime: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}
export function undoDose(m: MedicationItem, today: string): MedicationItem {
  return m.lastTakenDate === today
    ? {
        ...m,
        bottleCount: m.bottleCount + m.doseCount,
        lastTakenDate: undefined,
        lastTakenTime: undefined,
      }
    : m;
}
export interface HomeData {
  tasks: TaskItem[];
  medications: MedicationItem[];
}
export const storageKey = (uid: string) => `townloop:home:v1:${uid}`;
function validDate(s: unknown): boolean {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    localDate(parseDate(s)) === s
  );
}
export function readHome(raw: string | null): HomeData {
  if (raw === null) return { tasks: [], medications: [] };
  const d = JSON.parse(raw) as HomeData;
  if (
    !Array.isArray(d.tasks) ||
    !Array.isArray(d.medications) ||
    !d.tasks.every(
      (t) =>
        typeof t.id === "number" &&
        typeof t.text === "string" &&
        typeof t.done === "boolean" &&
        validDate(t.date),
    ) ||
    !d.medications.every(
      (m) =>
        typeof m.id === "string" &&
        typeof m.name === "string" &&
        Number.isInteger(m.doseCount) &&
        m.doseCount > 0 &&
        Number.isInteger(m.bottleCount) &&
        m.bottleCount >= 0 &&
        slots.some((s) => s.id === m.timeSlot),
    )
  )
    throw Error("Invalid saved Home data");
  return d;
}
