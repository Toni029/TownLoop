import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMonthlyCalendarEvents,
  MONTHLY_ACTIVITIES_LIST,
  toggleReminder,
  matchesReminder,
  nextDate,
  localDate,
  takeDose,
  undoDose,
  type MedicationItem,
} from "../src/home/model.ts";
import { HomeStore, type Storage } from "../src/home/store.ts";
import {
  parseWeather,
  type WeatherResponse,
} from "../src/home/weatherModel.ts";
const ids = (y: number, m: number, d: number) =>
  (getMonthlyCalendarEvents(y, m)[d] || []).map((e) => e.id);
test("October schedule keeps all 11 canonical rules and their original ordering", () => {
  assert.equal(MONTHLY_ACTIVITIES_LIST.length, 11);
  assert.deepEqual(ids(2026, 9, 7), [
    "garbage-day",
    "exercise",
    "wii-bowling",
    "gifted-hands",
  ]);
  assert.deepEqual(ids(2026, 9, 20), ["potluck"]);
  assert.deepEqual(ids(2026, 9, 13), ["bingo"]);
  assert.deepEqual(ids(2026, 9, 27), ["bingo"]);
  assert.deepEqual(ids(2026, 9, 5), [
    "exercise",
    "puppy-play-date",
    "game-night",
  ]);
  assert.deepEqual(ids(2026, 9, 8), ["koffee-klatch", "on-site-dermatology"]);
  assert.deepEqual(ids(2026, 9, 9), ["game-night", "lunch-bunch"]);
});
test("every occurrence in 2026–2032 matches weekly/ordinal requirements independently of month length", () => {
  const weekdays: Record<string, number[]> = {
    "garbage-day": [3],
    exercise: [1, 3],
    "puppy-play-date": [1],
    "koffee-klatch": [4],
    "game-night": [1, 5],
    "wii-bowling": [3],
    potluck: [2],
    bingo: [2],
    "gifted-hands": [3],
    "lunch-bunch": [5],
    "on-site-dermatology": [4],
  };
  const ordinals: Record<string, number[]> = {
    "puppy-play-date": [1],
    potluck: [3],
    bingo: [2, 4],
    "gifted-hands": [1, 3],
    "lunch-bunch": [2],
    "on-site-dermatology": [2],
  };
  for (let y = 2026; y <= 2032; y++)
    for (let m = 0; m < 12; m++) {
      const map = getMonthlyCalendarEvents(y, m),
        days = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++)
        for (const e of MONTHLY_ACTIVITIES_LIST) {
          const expected =
            weekdays[e.id].includes(new Date(y, m, d).getDay()) &&
            (!ordinals[e.id] || ordinals[e.id].includes(Math.ceil(d / 7)));
          assert.equal(
            (map[d] || []).some((x) => x.id === e.id),
            expected,
            `${y}-${m + 1}-${d} ${e.id}`,
          );
        }
      assert.ok(!map[days + 1]);
    }
});
test("month/year rollover, leap day, fifth weekdays and DST retain local calendar dates", () => {
  assert.equal(nextDate("2026-12-31"), "2027-01-01");
  assert.equal(nextDate("2028-02-28"), "2028-02-29");
  assert.equal(nextDate("2028-02-29"), "2028-03-01");
  assert.equal(nextDate("2027-02-28"), "2027-03-01");
  assert.equal(nextDate("2026-03-08"), "2026-03-09");
  assert.equal(nextDate("2026-11-01"), "2026-11-02");
  assert.ok(ids(2028, 1, 29).every((x) => x !== "bingo" && x !== "potluck"));
  assert.ok(ids(2026, 11, 30).includes("garbage-day"));
  assert.deepEqual(ids(2027, 0, 4), [
    "exercise",
    "puppy-play-date",
    "game-night",
  ]);
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});
test("reminders stay attached to their selected occurrence, survive serialization, remove independently", () => {
  const event = MONTHLY_ACTIVITIES_LIST.find((e) => e.id === "potluck")!;
  let tasks = toggleReminder([], event, "2026-12-15");
  tasks = toggleReminder(tasks, event, "2027-01-19");
  tasks = JSON.parse(JSON.stringify(tasks));
  assert.equal(tasks.length, 2);
  assert.notEqual(tasks[0].id, tasks[1].id);
  assert.ok(matchesReminder(tasks[0], event, "2027-01-19"));
  assert.equal(tasks[0].text, "Community Potluck Dinner (5:00 PM)");
  tasks = toggleReminder(tasks, event, "2026-12-15");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].date, "2027-01-19");
  assert.equal(
    toggleReminder(
      [
        {
          id: 1,
          text: "Community Potluck Dinner",
          date: "2027-01-19",
          done: true,
        },
      ],
      event,
      "2027-01-19",
    ).length,
    0,
  );
});
class Memory implements Storage {
  values = new Map<string, string>();
  failRead = false;
  failWrite = false;
  async getItem(k: string) {
    if (this.failRead) throw Error("read");
    return this.values.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    if (this.failWrite) throw Error("write");
    this.values.set(k, v);
  }
}
test("resident-isolated persistence, rapid queued writes, restart and empty list persistence", async () => {
  const memory = new Memory(),
    a = new HomeStore("resident-a", memory),
    b = new HomeStore("resident-b", memory);
  await Promise.all([a.load(), b.load()]);
  const event = MONTHLY_ACTIVITIES_LIST[0];
  await a.change((d) => ({
    ...d,
    tasks: toggleReminder(d.tasks, event, "2026-12-30"),
  }));
  await Promise.all([
    a.change((d) => ({
      ...d,
      tasks: d.tasks.map((t) => ({ ...t, done: true })),
    })),
    a.change((d) => ({
      ...d,
      tasks: [
        ...d.tasks,
        { id: 2, text: "Own task", date: "2027-01-01", done: false },
      ],
    })),
  ]);
  assert.equal(a.data.tasks.length, 2);
  assert.equal(a.data.tasks[0].done, true);
  assert.equal(b.data.tasks.length, 0);
  const restarted = new HomeStore("resident-a", memory);
  await restarted.load();
  assert.deepEqual(restarted.data, a.data);
  await restarted.change(() => ({ tasks: [], medications: [] }));
  await a.load();
  assert.deepEqual(a.data, { tasks: [], medications: [] });
});
test("corrupt/unavailable storage does not overwrite saved data; failed writes are visible and retryable", async () => {
  const memory = new Memory(),
    a = new HomeStore("a", memory);
  memory.values.set(a.key, "broken");
  await a.load();
  assert.equal(a.ready, false);
  assert.ok(a.error);
  assert.equal(await a.change(() => ({ tasks: [], medications: [] })), false);
  assert.equal(memory.values.get(a.key), "broken");
  memory.values.delete(a.key);
  await a.load();
  memory.failWrite = true;
  assert.equal(
    await a.change((d) => ({
      ...d,
      tasks: [{ id: 1, text: "Test", date: "2026-12-31", done: false }],
    })),
    false,
  );
  assert.equal(a.data.tasks.length, 0);
  assert.ok(a.error);
  memory.failWrite = false;
  assert.equal(
    await a.change((d) => ({
      ...d,
      tasks: [{ id: 1, text: "Test", date: "2026-12-31", done: false }],
    })),
    true,
  );
  assert.equal(a.error, "");
});
test("medication take is idempotent per day, undo/refill metadata survive and next day becomes available", () => {
  const m: MedicationItem = {
    id: "test",
    name: "Test only",
    doseCount: 2,
    bottleCount: 10,
    timeSlot: "morning",
    createdAt: 1,
  };
  const taken = takeDose(m, "2026-12-31");
  assert.equal(taken.bottleCount, 8);
  assert.deepEqual(takeDose(taken, "2026-12-31"), taken);
  assert.equal(undoDose(taken, "2026-12-31").bottleCount, 10);
  assert.equal(takeDose(taken, "2027-01-01").bottleCount, 6);
  assert.deepEqual(undoDose(m, "2026-12-31"), m);
});
test("weather uses live current temperature and 12 hours crossing midnight, not sample fallback", () => {
  const time = Array.from(
    { length: 48 },
    (_, i) =>
      `2026-12-${i < 24 ? "30" : "31"}T${String(i % 24).padStart(2, "0")}:00`,
  );
  const data: WeatherResponse = {
    current: {
      temperature_2m: 67.6,
      wind_speed_10m: 5,
      relative_humidity_2m: 80,
      weather_code: 0,
      time: "2026-12-30T23:15",
    },
    hourly: {
      time,
      temperature_2m: time.map(() => 60),
      wind_speed_10m: time.map(() => 5),
      relative_humidity_2m: time.map(() => 75),
      precipitation_probability: time.map(() => 40),
      weather_code: time.map(() => 3),
    },
    daily: {
      time: ["2026-12-30", "2026-12-31"],
      temperature_2m_max: [70, 69],
      temperature_2m_min: [50, 51],
      weather_code: [0, 3],
    },
  };
  const parsed = parseWeather(data);
  assert.equal(parsed.currentRealTimeWeather.temp, "68°");
  assert.equal(parsed.forecastDays[0].hourly.length, 12);
  assert.equal(parsed.forecastDays[0].hourly[1].time, "12 AM");
  assert.equal(parsed.forecastDays[0].hourly[0].temp, "68°");
  assert.throws(() => parseWeather({} as WeatherResponse));
});
