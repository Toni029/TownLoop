import { useRef, useState } from "react";
import { View } from "react-native";
import { CalendarPlus, Pin } from "lucide-react-native";
import type { CommunityRsvpEvent, PinnedHighlight } from "../models";
import { Action, Choices, ErrorNotice, Field, NewsDialog, s } from "./ui";
const categories = [
  "Health & Wellness",
  "Social Event",
  "Dining & Food",
  "Educational",
  "Arts & Crafts",
  "Sports & Fitness",
  "Community Meeting",
  "Special Holiday",
];
const noticeCategories = [
  "Facility Update",
  "Resident Amenity",
  "Safety Notice",
  "Community Life",
  "Maintenance Alert",
  "Administration Notice",
];
export type EventDraft = Pick<
  CommunityRsvpEvent,
  | "title"
  | "month"
  | "day"
  | "time"
  | "location"
  | "category"
  | "description"
  | "spotsLeft"
  | "capacity"
>;
export function EventEditor({
  event,
  onSave,
  onClose,
}: {
  event?: CommunityRsvpEvent;
  onSave: (draft: EventDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [month, setMonth] = useState(event?.month || "OCT");
  const [day, setDay] = useState(event?.day || "15");
  const [time, setTime] = useState(event?.time || "2:00 PM – 3:30 PM");
  const [location, setLocation] = useState(
    event?.location || "Community Center",
  );
  const [category, setCategory] = useState(event?.category || "Social Event");
  const [spots, setSpots] = useState(
    event?.spotsLeft === undefined ? "" : String(event.spotsLeft),
  );
  const [description, setDescription] = useState(event?.description || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function save() {
    if (locked.current) return;
    if (
      !title.trim() ||
      !description.trim() ||
      !/^\d{1,2}$/.test(day) ||
      Number(day) < 1 ||
      Number(day) > 31
    ) {
      setError("Please provide an event title, valid day and description.");
      return;
    }
    if (spots !== "" && (!/^\d+$/.test(spots) || Number(spots) > 100000)) {
      setError("Available spots must be a whole number.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        month,
        day: day.trim(),
        time: time.trim() || "TBA",
        location: location.trim() || "Community Center",
        category,
        description: description.trim(),
        ...(spots !== ""
          ? { spotsLeft: Number(spots), capacity: Number(spots) }
          : { capacity: null }),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save event.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <NewsDialog
      title={event ? "Edit RSVP Event" : "Create RSVP Event"}
      tone="green"
      icon={CalendarPlus}
      subtitle={
        event
          ? "Review and adjust event details, schedule, or attendee capacity"
          : "Publish event to Community Bulletin for resident sign-up"
      }
      onClose={onClose}
      busy={busy}
    >
      <Field
        label="Event Title *"
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <View style={{ flex: 1 }}>
          <Choices
            label="Month"
            values={[
              "JAN",
              "FEB",
              "MAR",
              "APR",
              "MAY",
              "JUN",
              "JUL",
              "AUG",
              "SEP",
              "OCT",
              "NOV",
              "DEC",
            ]}
            value={month}
            onChange={setMonth}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Day *"
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            maxLength={2}
            editable={!busy}
          />
        </View>
      </View>
      <Field
        label="Time"
        value={time}
        onChangeText={setTime}
        editable={!busy}
      />
      <Field
        label="Location"
        value={location}
        onChangeText={setLocation}
        editable={!busy}
      />
      <Choices
        label="Category"
        values={categories}
        value={category}
        onChange={setCategory}
      />
      <Field
        label="Available Spots (Optional)"
        value={spots}
        onChangeText={setSpots}
        keyboardType="number-pad"
        editable={!busy}
      />
      <Field
        label="Description *"
        multiline
        value={description}
        onChangeText={setDescription}
        editable={!busy}
      />
      {!!error && <ErrorNotice message={error} />}
      <Action
        label={busy ? "Saving…" : event ? "Save Changes" : "Create Event"}
        icon={CalendarPlus}
        onPress={() => void save()}
        disabled={busy}
      />
    </NewsDialog>
  );
}
export function HighlightEditor({
  onSave,
  onClose,
}: {
  onSave: (draft: Omit<PinnedHighlight, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Facility Update");
  const [authorLabel, setAuthor] = useState("Pinned by Management");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function save() {
    if (locked.current) return;
    if (!title.trim() || !description.trim()) {
      setError("Highlight title and description are required.");
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        authorLabel: authorLabel.trim() || "Pinned by Management",
        description: description.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to pin notice.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <NewsDialog
      title="Create Pinned Highlight"
      tone="amber"
      icon={Pin}
      subtitle="Pin a high-priority announcement to the Community Bulletin"
      onClose={onClose}
      busy={busy}
    >
      <Field
        label="Highlight Headline *"
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />
      <Choices
        label="Category"
        values={noticeCategories}
        value={category}
        onChange={setCategory}
      />
      <Field
        label="Author / Label"
        value={authorLabel}
        onChangeText={setAuthor}
        editable={!busy}
      />
      <Field
        label="Description *"
        multiline
        value={description}
        onChangeText={setDescription}
        editable={!busy}
      />
      {!!error && <ErrorNotice message={error} />}
      <Action
        label={busy ? "Saving…" : "Pin Highlight"}
        icon={Pin}
        tone="amber"
        onPress={() => void save()}
        disabled={busy}
      />
    </NewsDialog>
  );
}
