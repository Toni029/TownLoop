import { usePresentation } from "../shell/TownLoopShell";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Pressable, View } from "react-native";
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
import { stageEdition, finishEdition, MAX_PDF_MB } from "./edition";
import { newUploadResume, type TransferProgress } from "./pdfTransfer";
import { auth } from "../lib/firebase";
import { preflightAnalysis } from "./api";
import { retainedEditions, type RetainedEdition } from "./drafts";
import { analyzeNewsletter } from "./ai";
import type {AnalysisProgress} from "./analysisJobs";
import {discardNewsletterDraft, touchNewsletterDraft} from './discard';
import { AnalysisCoverage } from "./AnalysisCoverage";
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
  const [reviewTab, setReviewTab] = useState<"rsvp_events" | "pinned_highlights">("rsvp_events");
  const dark = !!usePresentation()?.dark;
  const reduced = useReducedMotion();
  const uploaded = hasUploadedNewsletter(current) ? current : null;
  const [title, setTitle] = useState(uploaded?.editionTitle || "");
  const [month, setMonth] = useState(uploaded?.monthEdition || "");
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [editing, setEditing] = useState("");
  const [staged, setStaged] = useState<(NewsletterConfig & {totalChunks:number;totalSize:number;sourceBytes?:number}) | null>(null);
  const [retained, setRetained] = useState<RetainedEdition[]>([]);
  const [finding, setFinding] = useState(false);
  const [checkingService, setCheckingService] = useState(false);
  const [analysisProgress,setAnalysisProgress]=useState<AnalysisProgress|null>(null);
  const [timing, setTiming] = useState<{preparationMs:number;elapsedMs:number;readMs:number;commitMs:number}|null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const [step, setStep] = useState(-1),
    [error, setError] = useState("");
  const [editionId, setEditionId] = useState(() => newNewsId("newsletters"));
  const [expectedKey] = useState(() => editionKey(current));
  const lock = useRef(false);
  const resume = useRef(newUploadResume());
  const transfer = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [bytes, setBytes] = useState<TransferProgress | null>(null);
  const activeDraftId = step === 3 ? null : staged?.id || (bytes?.confirmedBytes ? editionId : null);
  useEffect(() => {
    if (!activeDraftId) return;
    let stopped = false, touching = false;
    const touch = async () => {
      if (stopped || touching || AppState.currentState !== 'active') return;
      touching = true;
      try { await touchNewsletterDraft(activeDraftId); }
      catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Unable to refresh upload activity.'); }
      finally { touching = false; }
    };
    void touch();
    const timer = setInterval(() => void touch(), 5 * 60 * 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void touch(); });
    return () => { stopped = true; clearInterval(timer); listener.remove(); };
  }, [activeDraftId]);
  useEffect(() => () => file?.dispose(), [file]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; transfer.current?.abort(); }; }, []);
  const [bar] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: progress,
      duration: reduced ? 0 : 400,
      useNativeDriver: false,
    }).start();
  }, [bar, progress, reduced]);
  function resetDraft() {
    setAnalysisProgress(null);
    setTiming(null);
    resume.current = newUploadResume();
    setBytes(null);
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
        if (!mounted.current) { next.dispose(); return; }
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
  async function findRetained() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFinding(true); setError("");
    try { const values = await retainedEditions(); setRetained(values); if (!values.length) setError("No recoverable unpublished PDF was found."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to check retained PDFs."); }
    finally { setFinding(false); setBusy(false); lock.current = false; }
  }
  async function discard(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await discardNewsletterDraft(id);
      if (!mounted.current) return;
      setRetained(values => values.filter(value => value.id !== id));
      if (id === editionId) { setFile(null); resetDraft(); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to discard this upload. Retry.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function resumeRetained(draft: RetainedEdition) {
    if (lock.current) return;
    if (!draft.partial) {
      setFile(null); setStaged(draft); setEditionId(draft.id); setTitle(draft.editionTitle || ""); setMonth(draft.monthEdition || ""); setResult(null); setStep(0); setProgress(100); setBytes({confirmedBytes:draft.sourceBytes,totalBytes:draft.sourceBytes,percent:100}); setRetained([]); setError("");
      return;
    }
    lock.current = true; setBusy(true); setError("");
    try {
      const original = await pickPdf();
      if (!original) return;
      if (!mounted.current) { original.dispose(); return; }
      if (original.size !== draft.sourceBytes) { original.dispose(); throw Error("Select the original PDF to resume this partial upload. Its size does not match."); }
      // stageEdition proves all confirmed chunk hashes match before writing anything.
      resume.current = newUploadResume(); setFile(original); setStaged(null); setEditionId(draft.id);
      setTitle(draft.editionTitle || ""); setMonth(draft.monthEdition || ""); setResult(null); setStep(0); setProgress(0); setBytes(null); setRetained([]); setTiming(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to resume this PDF."); }
    finally { lock.current = false; setBusy(false); }
  }
  function editDetails() {
    // Edition/title edits must not discard confirmed or partial PDF transfer state.
    setResult(null); setEditing(""); setError("");
  }
  async function publish() {
    if (lock.current || (!file && !staged)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    transfer.current = controller;
    const owner = auth.currentUser?.uid;
    try {
      let metadata = staged;
      if (aiEnabled && !result) {
        setCheckingService(true);
        try { await preflightAnalysis(file?.size || Number((staged as {sourceBytes?:number}|null)?.sourceBytes) || 0, true); }
        finally { setCheckingService(false); }
      }
      if (!metadata && file) {
        const user = await approvedUser(true);
        const config = {
          id: editionId,
          editionTitle: title.trim(),
          monthEdition: month.trim(),
          description: "",
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
        setProgress(bytes?.percent || 0);
        metadata = await stageEdition(config, file, setProgress, {
          signal: controller.signal, resume: resume.current, onTransfer: setBytes, onMetrics: setTiming,
        });
        setStaged(metadata);
      }
      if (!metadata) throw new Error("Select a PDF or resume a retained upload.");
      metadata = { ...metadata, editionTitle: title.trim(), monthEdition: month.trim() };
      if (aiEnabled && !result) {
        setStep(1);
        setAnalysisProgress(null);
        setProgress(100);
        if (auth.currentUser?.uid !== owner) throw new Error("Please sign in again.");
        // Reference-only request: the server reuses confirmed Firebase bytes, never a second phone upload.
        const extracted = await analyzeNewsletter(metadata, true, {signal:controller.signal,onProgress:value=>{if(mounted.current)setAnalysisProgress(value);}});
        if (!mounted.current) return;
        setResult(extracted);
        setProgress(100);
        // Keep the current newsletter live until the manager approves this inline review.
        return;
      }
      setStep(2);
      if (auth.currentUser?.uid !== owner) throw new Error("Please sign in again.");
      setProgress(100);
      const items = aiEnabled && result ? analysisItems(result, metadata) : [];
      await finishEdition(metadata, expectedKey, items);
      setProgress(100);
      setStep(3);
      onPublished();
    } catch (e) {
      if (!mounted.current) return;
      setError(
        `${e instanceof Error ? e.message : "Unable to publish newsletter."} Your current newsletter has not been replaced.`,
      );
    } finally {
      transfer.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  const labels = [
    "Uploading",
    aiEnabled ? "AI analysis" : "AI skipped",
    "Publishing",
    "Done",
  ];
  const ink = dark ? "#f5f5f4" : "#1c1917";
  const reviewing = !!result && step !== 3;
  return (
    <NewsDialog
      title={reviewing ? "Review your newsletter" : "Upload Community Newsletter"}
      maxWidth={reviewing ? 640 : 512}
      tone="green"
      icon={FileText}
      subtitle={reviewing ? `${month || title} · Review and edit before publishing` : "Share your monthly edition"}
      busy={busy && step !== 1}
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
            <Copy weight="bold">{file?.name || staged?.fileName || "Choose PDF document"}</Copy>
            <Copy>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                : staged?.fileSize || `PDF documents up to ${MAX_PDF_MB} MB`}
            </Copy>
          </Pressable>
          <Action label={finding ? "Checking retained PDFs…" : "Resume an uploaded PDF"} disabled={busy} onPress={() => void findRetained()} />
          {retained.map(draft => <View key={draft.id} style={{gap:8}}><Action disabled={busy} label={`${draft.fileName} · ${draft.fileSize} · ${draft.partial ? `Resume ${draft.confirmedChunks}/${draft.totalChunks} parts — select original PDF` : new Date(draft.retainedAt).toLocaleString()}`} onPress={() => void resumeRetained(draft)} /><Action icon={Trash2} disabled={busy} label="Discard uploaded PDF" onPress={() => void discard(draft.id)} /></View>)}
          {!!staged && <Copy>PDF upload is retained. Retry analysis or publish with AI turned off; no PDF re-upload is needed.</Copy>}
          <Field
            label="Edition Title *"
            value={title}
            onChangeText={(v) => {
              editDetails();
              setTitle(v);
            }}
            editable={!busy}
          />
          <Field
            label="Month / Edition"
            value={month}
            onChangeText={(v) => {
              editDetails();
              setMonth(v);
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
              setStep(staged ? 0 : -1);
              setProgress(staged ? 100 : 0);
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
      {checkingService && <Copy>Checking the secure analysis service and file-size limit…</Copy>}
      {!!timing && <Copy>File preparation: {(timing.preparationMs/1000).toFixed(1)}s · Local reads: {(timing.readMs/1000).toFixed(1)}s · Transfer: {(timing.elapsedMs/1000).toFixed(1)}s</Copy>}
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
          {step === 0 && <>
            <Copy>{bytes ? `${(bytes.confirmedBytes / 1048576).toFixed(1)} / ${(bytes.totalBytes / 1048576).toFixed(1)} MB confirmed` : "Preparing PDF transfer…"}</Copy>
            <Copy>Progress counts Firebase-confirmed PDF bytes. Temporary connection problems retry automatically; cancel pauses safely. Your current newsletter stays live until publishing finishes.</Copy>
            {busy && <Action label="Cancel upload" onPress={() => transfer.current?.abort()} />}
          </>}
          {step === 1 && <Copy>PDF upload complete · 100%. AI analysis is a separate step.</Copy>}
          {step === 1 && !!analysisProgress && <Copy>{analysisProgress.state === 'queued' ? 'Queued securely' : analysisProgress.state === 'retrying' ? 'Retrying the remaining pages' : 'Reading newsletter pages'} · {analysisProgress.completedBatches}/{analysisProgress.totalBatches || '…'} checks saved · attempt {analysisProgress.attempt || 1}</Copy>}
          {step === 1 && busy && (
            <View style={{ gap: 8 }}>
              <ActivityIndicator color="#059669" />
              <Copy>
                Large PDFs can take a few minutes. Alternate models are tried
                automatically; saved page groups are kept. You can close this window and resume later. Your current newsletter stays live.
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
          <AnalysisCoverage result={result} />
          <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, gap: 4, borderRadius: 16, backgroundColor: dark ? "#1e293b" : "#f1f5f2", borderWidth: 1, borderColor: dark ? "#475569" : "#d6e2dc" }}>
            {(["rsvp_events", "pinned_highlights"] as const).map((tab) => (
              <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: reviewTab === tab }} onPress={() => { setReviewTab(tab); setEditing(""); }} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, backgroundColor: reviewTab === tab ? "#047857" : "transparent" }}>
                <Copy weight="bold" style={{ fontSize: 13, lineHeight: 19, textAlign: "center", flexShrink: 1, color: reviewTab === tab ? "#ffffff" : dark ? "#cbd5e1" : "#475569" }}>
                  {tab === "rsvp_events" ? "RSVP events" : "Stories"} ({result[tab].length})
                </Copy>
              </Pressable>
            ))}
          </View>
          {[reviewTab].map((kind) => (
            <View key={kind} style={{ width: "100%", minWidth: 0, gap: 14 }}>
              {!result[kind].length && <Copy>No items to publish.</Copy>}
            {result[kind].map((item, index) => {
              const key = `${kind}-${index}`,
                edit = editing === key;
              return (
                <View
                  key={key}
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? "#475569" : kind === "rsvp_events" ? "#a7d9c8" : "#e8cf9c",
                    padding: 16,
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
                    <Copy weight="bold" style={{ flex: 1, fontSize: 10, letterSpacing: 1, color: dark ? "#cbd5e1" : "#78716c" }}>{kind === "rsvp_events" ? "EVENT" : "STORY"} {String(index + 1).padStart(2, "0")}</Copy>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.title}`}
                      disabled={busy}
                      onPress={() => setEditing(edit ? "" : key)}
                      style={{ padding: 11, borderRadius: 12, borderWidth: 1, borderColor: dark ? "#475569" : "#d6d3d1", backgroundColor: dark ? "#1e293b" : "#fff" }}
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
                      style={{ padding: 11, borderRadius: 12, borderWidth: 1, borderColor: dark ? "#475569" : "#d6d3d1", backgroundColor: dark ? "#1e293b" : "#fff" }}
                    >
                      <Trash2 size={19} color="#e11d48" />
                    </Pressable>
                  </View>
                  <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: kind === "rsvp_events" ? "#05966960" : "#d9770660", backgroundColor: dark ? "#1e293b" : "#ffffff" }}>
                  <Copy weight="bold" style={{ fontSize: 16, lineHeight: 23, textAlign: "center", flexShrink: 1, width: "100%" }}>{String(item.title)}</Copy>
                  </View>
                  {!!item.sourcePage && <Copy>PDF page {String(item.sourcePage)}{item.sourcePassage ? ` · ${String(item.sourcePassage)}` : ""}</Copy>}
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
                      <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: dark ? "#475569" : "#d6d3d1", backgroundColor: dark ? "#0f172a" : "#ffffff" }}>
                      <Copy weight="bold" style={{ fontSize: 10, letterSpacing: 1, color: "#78716c", marginBottom: 8 }}>{kind === "rsvp_events" ? "ABOUT THIS EVENT" : "STORY"}</Copy>
                      <Copy style={{ fontSize: 12, lineHeight: 19, flexShrink: 1 }}>
                        {String(kind === "rsvp_events" ? item.description || "" : item.summary || "")}
                      </Copy>
                      </View>
                      {kind === "rsvp_events" ? <>
                        {[
                          ["DATE", `${item.month || ""} ${item.day || ""}`.trim() || "Not specified"],
                          ["TIME", String(item.time || "Not specified")],
                          ["LOCATION", String(item.location || "Not specified")],
                        ].map(([label, value]) => <View key={label} style={{ gap: 5, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: dark ? "#475569" : "#b9dccc", backgroundColor: dark ? "#1e293b" : "#ffffff" }}>
                          <Copy weight="bold" style={{ fontSize: 10, color: dark ? "#6ee7b7" : "#047857", letterSpacing: 1 }}>{label}</Copy>
                          <Copy weight="semi" style={{ fontSize: 12, lineHeight: 18, flexShrink: 1 }}>{value}</Copy>
                        </View>)}
                        {!!item.deadline && <View style={{ borderWidth: 1, borderRadius: 14, borderColor: "#05966960", padding: 14, backgroundColor: dark ? "#064e3b" : "#d1fae5" }}>
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
        </>
      )}
      {!!error && <ErrorNotice message={error} />}
      {step !== 3 && <Copy>Unpublished uploads are removed after 24 hours without activity. Discard an upload to remove it immediately. Published newsletters are kept.</Copy>}
      {step !== 3 && !!(staged || bytes?.confirmedBytes) && <Action icon={Trash2} label="Discard uploaded PDF" disabled={busy} onPress={() => void discard(editionId)} />}
      {step === 3 ? (
        <Action label="Done" icon={Check} onPress={onClose} />
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy || (!file && !staged) || !title.trim()}
          onPress={() => void publish()}
          style={{
            opacity: busy || (!file && !staged) || !title.trim() ? 0.55 : 1,
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
