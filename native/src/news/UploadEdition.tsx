import { usePresentation } from "../shell/TownLoopShell";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  FileText,
  Upload,
  Check,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react-native";
import type { NewsletterConfig } from "../models";
import { Action, Copy, ErrorNotice, Field, NewsDialog } from "./ui";
import { pickPdf, type PickedPdf } from "./files";
import { editionKey, hasUploadedNewsletter } from "./model";
import { approvedUser, newNewsId } from "./actions";
import { stageEdition, finishEdition } from "./edition";
import { analyzeNewsletter } from "./ai";
import { analysisItems, type AnalysisResult } from "./analysisModel";
import { useReducedMotion } from "../home/hooks";
export function UploadEdition({
  current,
  onClose,
  onPublished,
}: {
  current: NewsletterConfig | null;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { width } = useWindowDimensions();
  const dark = !!usePresentation()?.dark;
  const reduced = useReducedMotion();
  const uploaded = hasUploadedNewsletter(current) ? current : null;
  const [title, setTitle] = useState(uploaded?.editionTitle || "");
  const [month, setMonth] = useState(uploaded?.monthEdition || "");
  const [description, setDescription] = useState(uploaded?.description || "");
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [editing, setEditing] = useState("");
  const [staged, setStaged] = useState<Awaited<
    ReturnType<typeof stageEdition>
  > | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const [step, setStep] = useState(-1),
    [error, setError] = useState("");
  const [editionId, setEditionId] = useState(() => newNewsId("newsletters"));
  const [expectedKey] = useState(() => editionKey(current));
  const lock = useRef(false);
  const [bar] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: progress,
      duration: reduced ? 0 : 400,
      useNativeDriver: false,
    }).start();
  }, [bar, progress, reduced]);
  function resetDraft() {
    setEditionId(newNewsId("newsletters"));
    setStaged(null);
    setResult(null);
    setEditing("");
    setProgress(0);
    setStep(-1);
    setError("");
  }
  async function select() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const next = await pickPdf();
      if (next) {
        resetDraft();
        setFile(next);
        const found = next.name.match(
          /(January|February|March|April|May|June|July|August|September|October|November|December)[ _-]*(20\d{2})/i,
        );
        if (found) {
          const label = `${found[1]} ${found[2]}`;
          setTitle(`The Breeze: ${label}`);
          setMonth(label);
        }
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
      let metadata = staged;
      if (!metadata) {
        const user = await approvedUser(true);
        const config = {
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
        } as NewsletterConfig;
        setStep(0);
        setProgress(2);
        metadata = await stageEdition(config, file.dataUrl, (value) =>
          setProgress(Math.round(value * 0.5)),
        );
        setStaged(metadata);
      }
      if (aiEnabled && !result) {
        setStep(1);
        setProgress(45);
        const extracted = await analyzeNewsletter(metadata, file.dataUrl);
        setResult(extracted);
        setProgress(75);
        // Keep the current newsletter live until the manager approves this inline review.
        return;
      }
      setStep(2);
      setProgress(85);
      const items = aiEnabled && result ? analysisItems(result, metadata) : [];
      await finishEdition(metadata, expectedKey, items);
      setProgress(100);
      setStep(3);
      onPublished();
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Unable to publish newsletter."} Your current newsletter has not been replaced.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const labels = [
    "Uploading",
    aiEnabled ? "AI analysis" : "AI skipped",
    "Polishing touches",
    "Done",
  ];
  const ink = dark ? "#f5f5f4" : "#1c1917";
  const reviewing = !!result && step !== 3;
  return (
    <NewsDialog
      title={reviewing ? "Review your newsletter" : "Upload Community Newsletter"}
      maxWidth={reviewing ? 1080 : 512}
      tone="green"
      icon={FileText}
      subtitle={reviewing ? `${month || title} · Review and edit before publishing` : "Share your monthly edition"}
      busy={busy}
      onClose={onClose}
    >
      {!reviewing && step !== 3 && (
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
              borderColor: "#a8a29e",
              borderRadius: 20,
              padding: 24,
              alignItems: "center",
              gap: 10,
            }}
          >
            <Upload size={28} color="#059669" />
            <Copy weight="bold">{file?.name || "Choose PDF document"}</Copy>
            <Copy>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                : "PDF documents up to 32 MB"}
            </Copy>
          </Pressable>
          <Field
            label="Edition Title *"
            value={title}
            onChangeText={(v) => {
              resetDraft();
              setTitle(v);
            }}
            editable={!busy}
          />
          <Field
            label="Month / Edition"
            value={month}
            onChangeText={(v) => {
              resetDraft();
              setMonth(v);
            }}
            editable={!busy}
          />
          <Field
            label="Description"
            multiline
            value={description}
            onChangeText={(v) => {
              resetDraft();
              setDescription(v);
            }}
            editable={!busy}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aiEnabled, disabled: busy }}
            disabled={busy}
            onPress={() => {
              setAiEnabled(!aiEnabled);
              setResult(null);
              setStep(-1);
              setProgress(0);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 18,
              backgroundColor: dark ? "#064e3b66" : "#ecfdf5",
              borderWidth: 1,
              borderColor: "#05966960",
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: "#059669",
                backgroundColor: aiEnabled ? "#059669" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {aiEnabled && <Check size={18} color="white" />}
            </View>
            <Copy style={{ flex: 1, color: ink }}>
              Analyze this newsletter and extract events and stories with the AI
              agent.
            </Copy>
          </Pressable>
        </>
      )}
      {!reviewing && step >= 0 && (
        <View
          accessibilityRole="progressbar"
          accessibilityLiveRegion="polite"
          accessibilityValue={
            step === 1 ? undefined : { min: 0, max: 100, now: progress }
          }
          style={{
            padding: 18,
            borderRadius: 22,
            backgroundColor: dark ? "#064e3b" : "#ecfdf5",
            gap: 14,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Sparkles size={20} color="#059669" />
            <Copy weight="bold">
              {step === 1
                ? error
                  ? "Analysis paused — retry available"
                  : busy
                    ? "AI is reading your newsletter…"
                    : "Analysis ready for review"
                : `${labels[step]} · ${progress}%`}
            </Copy>
          </View>
          {step === 1 && busy && (
            <View style={{ gap: 8 }}>
              <ActivityIndicator color="#059669" />
              <Copy>
                Large PDFs can take a few minutes. Alternate models are tried
                automatically; your current newsletter stays live.
              </Copy>
            </View>
          )}
          <View
            style={{
              display: step === 1 ? "none" : "flex",
              height: 12,
              backgroundColor: "#05966922",
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                height: 12,
                width: bar.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              }}
            >
              <LinearGradient
                colors={["#059669", "#34d399", "#a7f3d0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: 9 }}
              />
            </Animated.View>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            {labels.map((label, index) => (
              <Copy
                key={label}
                style={{
                  flex: 1,
                  fontSize: 10,
                  textAlign: "center",
                  opacity: index <= step ? 1 : 0.45,
                }}
              >
                {index < step || step === 3 ? "✓ " : ""}
                {label}
              </Copy>
            ))}
          </View>
          {result && step === 1 && !busy && (
            <Copy>
              Analysis ready. Review below, then tap Upload &amp; Publish to
              finish.
            </Copy>
          )}
        </View>
      )}
      {result && step !== 3 && (
        <>
          <Copy>
            {result.rsvp_events.length} RSVP events ·{" "}
            {result.pinned_highlights.length} stories. Review the details before
            publishing.
          </Copy>
          <View style={{ flexDirection: width >= 760 ? "row" : "column", gap: 24, alignItems: "flex-start" }}>
          {(["rsvp_events", "pinned_highlights"] as const).map((kind) => (
            <View key={kind} style={{ flex: width >= 760 ? 1 : undefined, width: width >= 760 ? undefined : "100%", minWidth: 0, gap: 14 }}>
              <Copy weight="bold" style={{ fontSize: 19, lineHeight: 26, color: kind === "rsvp_events" ? "#047857" : "#b45309" }}>
                {kind === "rsvp_events" ? "RSVP events" : "Pinned highlights"} · {result[kind].length}
              </Copy>
              {!result[kind].length && <Copy>No items to publish.</Copy>}
            {result[kind].map((item, index) => {
              const key = `${kind}-${index}`,
                edit = editing === key;
              return (
                <View
                  key={key}
                  style={{
                    borderWidth: 1,
                    borderColor: "#a8a29e55",
                    padding: 22,
                    borderRadius: 24,
                    backgroundColor: dark ? "#172536" : kind === "rsvp_events" ? "#f3faf7" : "#fffbf2",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.title}`}
                      disabled={busy}
                      onPress={() => setEditing(edit ? "" : key)}
                      style={{ padding: 10 }}
                    >
                      <Pencil size={19} color="#059669" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.title}`}
                      disabled={busy}
                      onPress={() => {
                        setResult({
                          ...result,
                          [kind]: result[kind].filter((_, i) => i !== index),
                        });
                        setEditing("");
                      }}
                      style={{ padding: 10 }}
                    >
                      <Trash2 size={19} color="#e11d48" />
                    </Pressable>
                  </View>
                  <Copy weight="bold" style={{ fontSize: 22, lineHeight: 29, textAlign: "center" }}>{String(item.title)}</Copy>
                  {edit ? (
                    (kind === "rsvp_events"
                      ? [
                          "title",
                          "month",
                          "day",
                          "time",
                          "location",
                          "deadline",
                          "description",
                        ]
                      : ["title", "summary", "tag"]
                    ).map((field) => (
                      <Field
                        key={field}
                        label={
                          field === "deadline"
                            ? "RSVP instructions / deadline"
                            : field.charAt(0).toUpperCase() + field.slice(1)
                        }
                        value={String(item[field] || "")}
                        editable={!busy}
                        onChangeText={(value) =>
                          setResult({
                            ...result,
                            [kind]: result[kind].map((entry, i) =>
                              i === index
                                ? { ...entry, [field]: value }
                                : entry,
                            ),
                          })
                        }
                      />
                    ))
                  ) : (
                    <View style={{ gap: 14 }}>
                      <Copy style={{ fontSize: 14, lineHeight: 22 }} numberOfLines={kind === "rsvp_events" ? 4 : undefined}>
                        {String(kind === "rsvp_events" ? item.description || "" : item.summary || "")}
                      </Copy>
                      {kind === "rsvp_events" ? <>
                        {[
                          ["DATE", `${item.month || ""} ${item.day || ""}`.trim() || "Not specified"],
                          ["TIME", String(item.time || "Not specified")],
                          ["LOCATION", String(item.location || "Not specified")],
                        ].map(([label, value]) => <View key={label} style={{ gap: 3 }}>
                          <Copy weight="bold" style={{ fontSize: 10, color: dark ? "#6ee7b7" : "#047857", letterSpacing: 1 }}>{label}</Copy>
                          <Copy weight="semi" style={{ fontSize: 14, lineHeight: 21 }}>{value}</Copy>
                        </View>)}
                        {!!item.deadline && <View style={{ borderTopWidth: 1, borderColor: "#05966930", paddingTop: 12 }}>
                          <Copy weight="semi">RSVP details</Copy>
                          <Copy style={{ marginTop: 4 }}>{String(item.deadline)}</Copy>
                        </View>}
                      </> : !!item.tag && <Copy weight="semi" style={{ color: dark ? "#fcd34d" : "#92400e" }}>{String(item.tag)}</Copy>}
                    </View>
                  )}
                </View>
              );
            })}
            </View>
          ))}
          </View>
        </>
      )}
      {!!error && <ErrorNotice message={error} />}
      {step === 3 ? (
        <Action label="Done" icon={Check} onPress={onClose} />
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy || !file || !title.trim()}
          onPress={() => void publish()}
          style={{
            opacity: busy || !file || !title.trim() ? 0.55 : 1,
            borderRadius: 20,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <LinearGradient
            colors={["#047857", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Upload size={23} color="white" />
            <Copy weight="bold" style={{ color: "white", fontSize: 18 }}>
              {busy ? "Working…" : "Upload & Publish"}
            </Copy>
          </LinearGradient>
        </Pressable>
      )}
    </NewsDialog>
  );
}
