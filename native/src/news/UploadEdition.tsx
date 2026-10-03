import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { FileText, Upload, Check } from "lucide-react-native";
import type { NewsletterConfig } from "../models";
import { Action, Copy, ErrorNotice, Field, NewsDialog, s } from "./ui";
import { pickPdf, type PickedPdf } from "./files";
import { editionKey } from "./model";
import { approvedUser, newNewsId } from "./actions";
import { publishEdition } from "./edition";
export function UploadEdition({
  current,
  onClose,
  onPublished,
}: {
  current: NewsletterConfig | null;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState(current?.editionTitle || "");
  const [month, setMonth] = useState(current?.monthEdition || "");
  const [description, setDescription] = useState(current?.description || "");
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [editionId] = useState(() => newNewsId("newsletters"));
  const [expectedKey] = useState(() => editionKey(current));
  const lock = useRef(false);
  async function select() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await pickPdf();
      if (result) {
        setFile(result);
        const found = result.name.match(
          /(January|February|March|April|May|June|July|August|September|October|November|December)[ _-]*(20\d{2})/i,
        );
        if (found) {
          const label = `${found[1][0].toUpperCase()}${found[1].slice(1).toLowerCase()} ${found[2]}`;
          setTitle(`The Breeze: ${label}`);
          setMonth(label);
        }
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to select PDF.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function publish() {
    if (lock.current || !file) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const user = await approvedUser(true);
      await publishEdition(
        {
          id: editionId,
          editionTitle: title.trim(),
          monthEdition: month.trim(),
          description: description.trim(),
          pdfUrl: `firestore:${editionId}`,
          fileUrl: `firestore:${editionId}`,
          fileName: file.name,
          fileType: "application/pdf",
          fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          uploadedAt: Date.now(),
          uploadedBy: String(user.id),
          isCustomUpload: true,
          isRemoved: false,
          pageImages: [],
        },
        file.dataUrl,
        expectedKey,
        setProgress,
      );
      onPublished();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Publishing failed. Your current edition has not been replaced.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <NewsDialog
      title={review ? "Review Newsletter" : "Upload Community Newsletter"}
      tone="green"
      icon={FileText}
      subtitle={
        review
          ? "Step 2 of 2 • Confirm before publishing"
          : "Step 1 of 2 • Share your monthly edition"
      }
      busy={busy}
      onClose={onClose}
    >
      {!review ? (
        <>
          <Copy weight="bold">SELECT NEWSLETTER DOCUMENT (.PDF) *</Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select newsletter PDF"
            disabled={busy}
            onPress={() => void select()}
            style={{
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "#d6d3d1",
              borderRadius: 16,
              padding: 24,
              alignItems: "center",
              gap: 10,
            }}
          >
            <Upload size={28} color="#047857" />
            <Copy weight="bold">{file?.name || "Choose PDF document"}</Copy>
            <Copy style={{ color: "#78716c" }}>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                : "PDF documents up to 32 MB"}
            </Copy>
          </Pressable>
          <Field
            label="Edition Title *"
            value={title}
            onChangeText={setTitle}
            editable={!busy}
          />
          <Field
            label="Month / Edition"
            value={month}
            onChangeText={setMonth}
            editable={!busy}
          />
          <Field
            label="Description"
            multiline
            value={description}
            onChangeText={setDescription}
            editable={!busy}
          />
          <View
            style={[
              s.card,
              { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
            ]}
          >
            <Copy>
              AI analysis will be available after the secure TownLoop service is
              connected. You can publish the PDF now and manage RSVP events and
              pinned notices manually.
            </Copy>
          </View>
          <Action
            label="Review Newsletter"
            icon={FileText}
            disabled={busy || !file || !title.trim()}
            onPress={() => setReview(true)}
          />
        </>
      ) : (
        <>
          <View style={s.card}>
            <FileText size={28} color="#047857" />
            <Copy weight="serif" style={{ fontSize: 20, lineHeight: 28 }}>
              {title}
            </Copy>
            <Copy>{month}</Copy>
            <Copy>{description}</Copy>
            <Copy>{file?.name}</Copy>
          </View>
          <Copy>
            No AI-generated events or highlights will be published. Existing
            manual community events and notices will be preserved.
          </Copy>
          {busy && (
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress }}
            >
              <Copy>{progress}% • Publishing newsletter…</Copy>
              <View
                style={{
                  height: 8,
                  backgroundColor: "#d1fae5",
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    width: `${progress}%`,
                    height: 8,
                    backgroundColor: "#047857",
                    borderRadius: 4,
                  }}
                />
              </View>
            </View>
          )}
          <View style={s.row}>
            <Action
              label="Back"
              tone="light"
              disabled={busy}
              onPress={() => setReview(false)}
            />
            <Action
              label={busy ? "Publishing…" : "Confirm & Publish"}
              icon={Check}
              disabled={busy}
              onPress={() => void publish()}
            />
          </View>
        </>
      )}
      {!!error && <ErrorNotice message={error} />}
    </NewsDialog>
  );
}
