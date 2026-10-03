import { useState } from "react";
import { LayoutAnimation, Linking, View, Pressable } from "react-native";
import Svg, { Rect, Path, Line } from "react-native-svg";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  PlusCircle,
  Phone,
  FileText,
  Sun,
  Clock,
  Sunset,
  Moon,
  Pill,
  AlertTriangle,
} from "lucide-react-native";
import { Action, Box, Input, Row, Sheet, Tile, Txt, usePalette } from "./ui";
import { slots, takeDose, undoDose, type MedicationItem } from "./model";
import { useReducedMotion } from "./hooks";
const slotIcons = { morning: Sun, noon: Clock, evening: Sunset, bedtime: Moon };
const suggestions = [
  "Take with food / meal",
  "Take with a full glass of water",
  "Take on an empty stomach (1 hr before food)",
  "Take 30 minutes before bedtime",
  "Do not crush or chew",
  "Avoid grapefruit / citrus juice",
  "Keep refrigerated",
  "Check blood pressure before taking",
];
export function Bottle() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Rect
        x={7}
        y={2}
        width={10}
        height={3.5}
        rx={1}
        fill="#F3F4F6"
        stroke="#6B7280"
        strokeWidth={1.2}
      />
      <Line x1={8.5} y1={3.8} x2={15.5} y2={3.8} stroke="#9CA3AF" />
      <Rect
        x={5.5}
        y={5.5}
        width={13}
        height={15.5}
        rx={2.5}
        fill="#F97316"
        stroke="#C2410C"
        strokeWidth={1.3}
      />
      <Rect x={7.5} y={9} width={9} height={8.5} rx={1.2} fill="white" />
      <Path
        d="M12 11V15.5M9.8 13.2H14.2"
        stroke="#DC2626"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M7 7.5V19" stroke="#FED7AA" strokeWidth={1.2} />
    </Svg>
  );
}
export function Medications({
  today,
  items,
  busy,
  onChange,
  notify,
}: {
  today: string;
  items: MedicationItem[];
  busy: boolean;
  onChange: (fn: (m: MedicationItem[]) => MedicationItem[]) => Promise<boolean>;
  notify: (s: string) => void;
}) {
  const p = usePalette(),
    reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false),
    [editor, setEditor] = useState<MedicationItem | "new" | null>(null);
  const taken = items.filter((m) => m.lastTakenDate === today).length;
  async function update(
    id: string,
    fn: (m: MedicationItem) => MedicationItem,
    message: string,
  ) {
    if (await onChange((ms) => ms.map((m) => (m.id === id ? fn(m) : m))))
      notify(message);
  }
  return (
    <Tile>
      <Row>
        <Bottle />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse Daily Medications" : "Expand Daily Medications"
          }
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={() => {
            if (!reduced)
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
            setExpanded(!expanded);
          }}
          style={{ flex: 1, minHeight: 48, justifyContent: "center" }}
        >
          <Row>
            <Txt
              bold
              accessibilityRole="header"
              style={{ fontSize: 16, flex: 1 }}
            >
              Daily Medications
            </Txt>
            {expanded ? (
              <ChevronUp color={p.blue} />
            ) : (
              <ChevronDown color={p.blue} />
            )}
          </Row>
          <Txt style={{ color: p.blue, fontSize: 12 }}>
            {taken === items.length && items.length > 0
              ? "All doses completed for today! 🎉"
              : `${taken} of ${items.length} doses taken today`}
          </Txt>
        </Pressable>
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold style={{ color: p.blue }}>
          {taken}/{items.length} Done
        </Txt>
        <Action
          icon={Plus}
          label="Add Medication"
          active
          color={p.blue}
          disabled={busy}
          onPress={() => setEditor("new")}
        />
      </Row>
      {expanded && (
        <View style={{ gap: 14 }}>
          {items.length === 0 ? (
            <Box>
              <Bottle />
              <Txt bold>No medications scheduled yet.</Txt>
              <Txt>
                Tap &quot;+ Add Medication&quot; above to set up your daily pill
                reminder and doctor directions.
              </Txt>
            </Box>
          ) : (
            [...items]
              .sort(
                (a, b) =>
                  slots.findIndex((s) => s.id === a.timeSlot) -
                  slots.findIndex((s) => s.id === b.timeSlot),
              )
              .map((m) => {
                const done = m.lastTakenDate === today,
                  slot = slots.find((s) => s.id === m.timeSlot)!,
                  Icon = slotIcons[m.timeSlot];
                return (
                  <Box
                    key={m.id}
                    style={{
                      borderWidth: 2,
                      borderColor: done ? "#6ee7b7" : p.line,
                    }}
                  >
                    <Row>
                      <Bottle />
                      <Txt bold style={{ fontSize: 17, flex: 1 }}>
                        {m.name}
                      </Txt>
                      <Action
                        icon={Pencil}
                        iconOnly
                        label={`Edit ${m.name}`}
                        disabled={busy}
                        onPress={() => setEditor(m)}
                      />
                      <Action
                        icon={Trash2}
                        iconOnly
                        label={`Delete ${m.name}`}
                        disabled={busy}
                        onPress={async () => {
                          if (
                            await onChange((ms) =>
                              ms.filter((x) => x.id !== m.id),
                            )
                          )
                            notify(`Removed ${m.name} from reminders.`);
                        }}
                      />
                    </Row>
                    {done && (
                      <Txt bold style={{ color: p.green }}>
                        ✓ Taken {m.lastTakenTime || "Today"}
                      </Txt>
                    )}
                    <Row>
                      <Pill size={18} color={p.blue} />
                      <Txt bold>
                        Take {m.doseCount}{" "}
                        {m.doseCount === 1 ? "pill" : "pills"}
                      </Txt>
                      <Bottle />
                      <Txt
                        bold
                        style={{
                          color: m.bottleCount <= 5 ? "#e11d48" : p.ink,
                        }}
                      >
                        {m.bottleCount} left in bottle
                      </Txt>
                    </Row>
                    <Box>
                      <Row>
                        <FileText size={18} color={p.blue} />
                        <Txt bold style={{ flex: 1 }}>
                          Doctor&apos;s Directions & Instructions
                        </Txt>
                      </Row>
                      <Row>
                        <Icon color={p.blue} size={16} />
                        <Txt bold>
                          {slot.title} ({slot.sub})
                        </Txt>
                      </Row>
                      <Action
                        icon={Pencil}
                        label={m.instructions ? "Edit Notes" : "+ Add Notes"}
                        disabled={busy}
                        onPress={() => setEditor(m)}
                      />
                      <Txt style={{ color: m.instructions ? p.ink : p.muted }}>
                        {m.instructions ||
                          'No special instructions entered. Tap "Edit Notes" to add meal, water, or timing directions.'}
                      </Txt>
                    </Box>
                    <Txt style={{ color: done ? p.green : p.muted }}>
                      {done
                        ? `Dose recorded for today at ${m.lastTakenTime || "Recorded"}`
                        : `Scheduled for ${slot.title} (${slot.sub})`}
                    </Txt>
                    <Row>
                      <Action
                        icon={done ? RotateCcw : Check}
                        label={done ? "Undo Dose" : "Take Now"}
                        active={!done}
                        disabled={busy}
                        onPress={() =>
                          update(
                            m.id,
                            (x) =>
                              done ? undoDose(x, today) : takeDose(x, today),
                            done
                              ? `Undid ${m.name}. Restored dose to bottle.`
                              : `✓ Marked ${m.name} as taken.`,
                          )
                        }
                      />
                      <Action
                        icon={PlusCircle}
                        label="+30 Refill"
                        disabled={busy}
                        onPress={() =>
                          update(
                            m.id,
                            (x) => ({ ...x, bottleCount: x.bottleCount + 30 }),
                            "Added +30 pills to prescription bottle.",
                          )
                        }
                      />
                    </Row>
                    {m.bottleCount <= 5 && (
                      <Box style={{ borderColor: "#fda4af" }}>
                        <Row>
                          <AlertTriangle size={18} color="#e11d48" />
                          <Txt bold style={{ color: "#e11d48" }}>
                            Low Supply: {m.bottleCount} pills remaining
                          </Txt>
                        </Row>
                        <Action
                          icon={Phone}
                          label="Call Pharmacy"
                          color="#e11d48"
                          onPress={async () => {
                            if (!m.pharmacyPhone?.trim()) {
                              setEditor(m);
                              notify(
                                "Enter your pharmacy phone number to call.",
                              );
                              return;
                            }
                            try {
                              await Linking.openURL(
                                `tel:${m.pharmacyPhone.replace(/[^\d+]/g, "")}`,
                              );
                            } catch {
                              notify(
                                "Unable to open the phone app. Please call your pharmacy directly.",
                              );
                            }
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })
          )}
        </View>
      )}
      {editor && (
        <MedicationEditor
          initial={editor === "new" ? undefined : editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={async (m) => {
            const saved = await onChange((ms) =>
              editor === "new"
                ? [...ms, m]
                : ms.map((x) => (x.id === m.id ? m : x)),
            );
            if (saved)
              notify(
                `${editor === "new" ? "Added" : "Updated"} ${m.name} details & instructions.`,
              );
            return saved;
          }}
        />
      )}
    </Tile>
  );
}
function MedicationEditor({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial?: MedicationItem;
  busy: boolean;
  onClose: () => void;
  onSave: (m: MedicationItem) => Promise<boolean>;
}) {
  const p = usePalette();
  const [name, setName] = useState(initial?.name || ""),
    [dose, setDose] = useState(initial?.doseCount || 1),
    [slot, setSlot] = useState<MedicationItem["timeSlot"]>(
      initial?.timeSlot || "morning",
    ),
    [count, setCount] = useState(String(initial?.bottleCount ?? 30)),
    [notes, setNotes] = useState(initial?.instructions || ""),
    [phone, setPhone] = useState(initial?.pharmacyPhone || ""),
    [error, setError] = useState("");
  return (
    <Sheet
      title={initial ? "Edit Medication" : "Add Medication Reminder"}
      onClose={onClose}
    >
      <Input
        label="Medication / Supplement Name"
        value={name}
        onChangeText={setName}
        placeholder="Medication name"
      />
      <Txt bold>Dose Quantity</Txt>
      <Row>
        <Action label="−" onPress={() => setDose(Math.max(1, dose - 1))} />
        <Txt bold>
          {dose} {dose === 1 ? "pill" : "pills"}
        </Txt>
        <Action label="+" onPress={() => setDose(dose + 1)} />
      </Row>
      <Txt bold>Time of Day</Txt>
      <Row>
        {slots.map((s) => (
          <Action
            key={s.id}
            label={`${s.title} (${s.sub})`}
            active={slot === s.id}
            color={p.blue}
            onPress={() => setSlot(s.id)}
          />
        ))}
      </Row>
      <Input
        label="Pills Left in Bottle"
        keyboardType="number-pad"
        value={count}
        onChangeText={setCount}
      />
      <Input
        label="Doctor's Directions & Instructions"
        multiline
        value={notes}
        onChangeText={setNotes}
      />
      <Row>
        {suggestions.map((s) => (
          <Action
            key={s}
            label={s}
            onPress={() =>
              setNotes((n) =>
                n.includes(s) ? n : n.trim() ? `${n.trim()}. ${s}` : s,
              )
            }
          />
        ))}
      </Row>
      <Input
        label="Pharmacy Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      {!!error && (
        <Txt accessibilityRole="alert" style={{ color: "#e11d48" }}>
          {error}
        </Txt>
      )}
      <Action
        active
        color={p.blue}
        label={initial ? "Save Changes" : "Add Medication Reminder"}
        disabled={busy}
        onPress={async () => {
          if (!name.trim()) {
            setError("Please enter a medication or supplement name.");
            return;
          }
          const n = Number(count);
          if (!count.trim() || !Number.isInteger(n) || n < 0) {
            setError("Enter a whole number of pills, zero or more.");
            return;
          }
          const m: MedicationItem = {
            ...initial,
            id:
              initial?.id ||
              `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: initial?.createdAt || Date.now(),
            name: name.trim(),
            doseCount: dose,
            timeSlot: slot,
            bottleCount: n,
            instructions: notes.trim(),
            pharmacyPhone: phone.trim(),
          };
          if (await onSave(m)) onClose();
          else
            setError("Your medication could not be saved. Please try again.");
        }}
      />
    </Sheet>
  );
}
