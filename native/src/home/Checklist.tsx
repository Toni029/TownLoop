import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Square,
  SquareCheck,
} from "lucide-react-native";
import { Action, Box, Input, Row, Sheet, Tile, Txt, usePalette } from "./ui";
import { Calendar } from "./Calendar";
import { ChecklistArtwork,ChecklistLandscape } from "./ChecklistArtwork";
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
  const [headerWidth, setHeaderWidth] = useState(300);
  const compactHeader = headerWidth < 280;
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
    <Tile tone="checklist">
      <View pointerEvents="none" style={{position:"absolute",top:0,right:0,bottom:0,left:0,borderRadius:30,overflow:"hidden"}}>
        <ChecklistLandscape dark={p.paper!=="#ffffff"}/>
      </View>
      <View onLayout={event => setHeaderWidth(event.nativeEvent.layout.width)} style={{flexDirection:"row",alignItems:"center",gap:8,minWidth:0}}>
        <View style={{flexShrink:0}}><ChecklistArtwork size={compactHeader?56:76}/></View>
        <View style={{flex:1,minWidth:0,gap:2}}>
          <Txt
            bold
            accessibilityRole="header"
            style={{textAlign:"left",fontSize:compactHeader?16:20,lineHeight:compactHeader?21:24,color:p.paper==="#ffffff"?"#073f49":p.ink}}
          >
            Daily Checklist
          </Txt>
          <Txt
            bold
            style={{textAlign:"left",fontSize:12,lineHeight:18,color:p.green}}
          >
            {filter === "all"
              ? "All Scheduled Tasks"
              : `${filter === "today" ? "Today • " : filter === "tomorrow" ? "Tomorrow • " : ""}${friendlyDate(target)}`}
          </Txt>
        </View>
        <View style={{alignItems:"center",gap:4,width:96,flexShrink:0}}>
          <Row style={{gap:8,flexWrap:"nowrap",flexShrink:0}}>
            <Action
              icon={CalendarIcon}
              label="Choose Date on Calendar"
              iconOnly
              iconOnlySize={44}
              iconSize={20}
              onPress={() => {
                setMonth(parseDate(target));
                setDialog("calendar");
              }}
            />
            <Action
              icon={Plus}
              label="Add Task"
              iconOnly
              iconOnlySize={44}
              iconSize={20}
              active
              disabled={busy}
              onPress={() => setDialog("add")}
            />
          </Row>
          <View
            style={{
              maxWidth: "100%",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: "#a7f3d0",
              backgroundColor: "#d1fae5cc",
            }}
          >
            <Txt bold style={{ color: p.green, fontSize: 12, lineHeight: 16, textAlign:"center" }}>
              {list.filter((t) => t.done).length}/{list.length} Done
            </Txt>
          </View>
        </View>
      </View>
      <View style={{gap:6}}>
        <Row style={{gap:8,justifyContent:"center"}}>
          <Action label="Today" active={filter==="today"} onPress={()=>setFilter("today")}/>
          <Action label="Tomorrow" active={filter==="tomorrow"} onPress={()=>setFilter("tomorrow")}/>
          <Action icon={CalendarIcon} label="Choose Day" onPress={()=>{setMonth(parseDate(target));setDialog("calendar");}}/>
        </Row>
        <Row style={{gap:8,justifyContent:"center"}}>
          <Action label="All Tasks" active={filter==="all"} onPress={()=>setFilter("all")}/>
          {filter==="date"&&<Action label={`${friendlyDate(selected)} ×`} active onPress={()=>setFilter("today")}/>}
        </Row>
      </View>
      {list.length === 0 ? (
        <View style={{alignItems:"center",gap:4,paddingTop:0,paddingBottom:6}}>
          <View pointerEvents="none" style={{opacity:p.paper==="#ffffff"?.9:.65}}><ChecklistArtwork quiet /></View>
          <Txt bold style={{color:p.muted,fontSize:14,lineHeight:21,textAlign:"center"}}>
            No tasks scheduled for this day.
          </Txt>
        </View>
      ) : (
        list.map((t) => (
          <Box key={t.id} style={{ padding: 12, gap: 0 }}>
            <Row>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done, disabled: busy }}
                aria-checked={t.done}
                accessibilityLabel={t.text}
                disabled={busy}
                hitSlop={{ top: 10, bottom: 10 }}
                onPress={() => onToggle(t.id)}
                style={{
                  minHeight: 24,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {t.done ? (
                  <SquareCheck color={p.green} size={16} />
                ) : (
                  <Square color={p.green} size={16} />
                )}
                <Txt
                  style={{
                    flex: 1,
                    fontSize: 12,
                    lineHeight: 16.5,
                    textDecorationLine: t.done ? "line-through" : "none",
                    color: t.done ? p.muted : p.ink,
                  }}
                >
                  {t.text}
                </Txt>
              </Pressable>
              <Txt style={{ fontSize: 10, lineHeight: 15, color: p.muted }}>
                {t.date}
              </Txt>
              <Action
                icon={Trash2}
                iconOnly
                label={`Remove task ${t.text}`}
                disabled={busy}
                onPress={() => onDelete(t)}
              />
            </Row>
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
