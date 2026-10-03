import { useState } from "react";
import { Pressable } from "react-native";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Trash2,
  Square,
  SquareCheck,
} from "lucide-react-native";
import { Action, Box, Input, Row, Sheet, Tile, Txt, usePalette } from "./ui";
import { Calendar } from "./Calendar";
import { friendlyDate, nextDate, parseDate, type TaskItem } from "./model";
export function Checklist({
  today,
  tasks,
  busy,
  onAdd,
  onToggle,
  onDelete,
}: {
  today: string;
  tasks: TaskItem[];
  busy: boolean;
  onAdd: (text: string, date: string) => Promise<boolean>;
  onToggle: (id: number) => void;
  onDelete: (t: TaskItem) => void;
}) {
  const p = usePalette();
  const tomorrow = nextDate(today);
  const [filter, setFilter] = useState<"today" | "tomorrow" | "date" | "all">(
      "today",
    ),
    [selected, setSelected] = useState(today),
    [month, setMonth] = useState(() => parseDate(today)),
    [dialog, setDialog] = useState<"calendar" | "add" | null>(null);
  const target =
    filter === "date" ? selected : filter === "tomorrow" ? tomorrow : today;
  const list =
    filter === "all" ? tasks : tasks.filter((t) => t.date === target);
  const choose = (d: string) => {
    setSelected(d);
    setFilter(d === today ? "today" : d === tomorrow ? "tomorrow" : "date");
    setDialog(null);
  };
  const dots: Record<string, string[]> = {};
  tasks.forEach((t) => {
    (dots[t.date] ??= []).push(p.green);
  });
  return (
    <Tile tone="green">
      <Row>
        <CheckCircle2 color={p.green} size={22} />
        <Txt bold accessibilityRole="header" style={{ fontSize: 16, flex: 1 }}>
          Daily Checklist
        </Txt>
        <Txt bold style={{ color: p.green }}>
          {list.filter((t) => t.done).length}/{list.length} Done
        </Txt>
      </Row>
      <Txt style={{ fontSize: 12, color: p.green }}>
        {filter === "all"
          ? "All Scheduled Tasks"
          : `${filter === "today" ? "Today • " : filter === "tomorrow" ? "Tomorrow • " : ""}${friendlyDate(target)}`}
      </Txt>
      <Row>
        <Action
          icon={CalendarIcon}
          label="Choose Date on Calendar"
          iconOnly
          onPress={() => {
            setMonth(parseDate(target));
            setDialog("calendar");
          }}
        />
        <Action
          icon={Plus}
          label="Add Task"
          active
          disabled={busy}
          onPress={() => setDialog("add")}
        />
      </Row>
      <Row>
        <Action
          label="Today"
          active={filter === "today"}
          onPress={() => setFilter("today")}
        />
        <Action
          label="Tomorrow"
          active={filter === "tomorrow"}
          onPress={() => setFilter("tomorrow")}
        />
        {filter === "date" && (
          <Action
            label={`${friendlyDate(selected)} ×`}
            active
            onPress={() => setFilter("today")}
          />
        )}
        <Action
          icon={CalendarIcon}
          label="Choose Day"
          onPress={() => {
            setMonth(parseDate(target));
            setDialog("calendar");
          }}
        />
        <Action
          label="All Tasks"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
      </Row>
      {list.length === 0 ? (
        <Txt style={{ color: p.muted, textAlign: "center", padding: 12 }}>
          No tasks scheduled for this day.
        </Txt>
      ) : (
        list.map((t) => (
          <Box key={t.id}>
            <Row>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done, disabled: busy }}
                aria-checked={t.done}
                accessibilityLabel={t.text}
                disabled={busy}
                onPress={() => onToggle(t.id)}
                style={{
                  minHeight: 48,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {t.done ? (
                  <SquareCheck color={p.green} size={22} />
                ) : (
                  <Square color={p.green} size={22} />
                )}
                <Txt
                  style={{
                    flex: 1,
                    textDecorationLine: t.done ? "line-through" : "none",
                    color: t.done ? p.muted : p.ink,
                  }}
                >
                  {t.text}
                </Txt>
              </Pressable>
              <Action
                icon={Trash2}
                iconOnly
                label={`Remove task ${t.text}`}
                disabled={busy}
                onPress={() => onDelete(t)}
              />
            </Row>
            <Txt style={{ fontSize: 12, color: p.muted, textAlign: "right" }}>
              {t.date}
            </Txt>
          </Box>
        ))
      )}
      {dialog === "calendar" && (
        <Sheet title="Choose Day" onClose={() => setDialog(null)}>
          <Calendar
            month={month}
            setMonth={setMonth}
            selected={target}
            onSelect={choose}
            today={today}
            dots={dots}
          />
          <Action label="Jump to Today" onPress={() => choose(today)} />
          <Txt>Tap any day to view or schedule</Txt>
        </Sheet>
      )}
      {dialog === "add" && (
        <AddTask
          today={today}
          initial={target}
          busy={busy}
          onSave={onAdd}
          onClose={() => setDialog(null)}
        />
      )}
    </Tile>
  );
}
function AddTask({
  today,
  initial,
  busy,
  onSave,
  onClose,
}: {
  today: string;
  initial: string;
  busy: boolean;
  onSave: (t: string, d: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [date, setDate] = useState(initial),
    [month, setMonth] = useState(() => parseDate(initial)),
    [error, setError] = useState("");
  return (
    <Sheet title="Add New Task" onClose={onClose}>
      <Input
        label="Task Description"
        placeholder="e.g., Water porch plants"
        value={text}
        onChangeText={setText}
      />
      <Txt bold>Scheduled Date · {friendlyDate(date)}</Txt>
      <Calendar
        month={month}
        setMonth={setMonth}
        selected={date}
        onSelect={setDate}
        today={today}
      />
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      <Action
        active
        label="Add to Checklist"
        disabled={busy}
        onPress={async () => {
          if (!text.trim()) {
            setError("Please enter a task description.");
            return;
          }
          if (await onSave(text.trim(), date)) onClose();
          else setError("Your task could not be saved. Please try again.");
        }}
      />
    </Sheet>
  );
}
