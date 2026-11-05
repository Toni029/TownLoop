import { useState, useRef, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import type { NewsletterConfig } from "../models";
import { Action, Copy, NewsDialog } from "./ui";
import { analyzeNewsletter, applyAnalysis } from "./ai";
import { AnalysisCoverage } from "./AnalysisCoverage";
import { analysisItems, type AnalysisResult } from "./analysisModel";
import type {AnalysisProgress} from './analysisJobs';
export function AnalysisReview({
  config,
  onClose,
}: {
  config: NewsletterConfig;
  onClose: () => void;
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController|null>(null), mounted = useRef(true);
  const [progress,setProgress]=useState<AnalysisProgress|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  async function run(save: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (save && result) {
        await applyAnalysis(result, config, selected);
        setSaved(true);
      } else {
        controller.current=new AbortController();
        const next = await analyzeNewsletter(config,false,{signal:controller.current.signal,onProgress:value=>{if(mounted.current)setProgress(value);}});
        if(!mounted.current)return;
        setResult(next);
        setSelected(analysisItems(next, config, {review:true}).map((item) => item.id));
      }
    } catch (e) {
      if(!mounted.current)return;
      setError(
        e instanceof Error ? e.message : "Analysis failed. Please retry.",
      );
    } finally {
      lock.current = false;
      if(mounted.current)setBusy(false);
    }
  }
  return (
    <NewsDialog
      title="Newsletter AI analysis"
      subtitle={config.editionTitle}
      busy={busy && !!result}
      onClose={onClose}
    >
      <Copy>
        Find all printed RSVP announcements and meaningful community stories.
        Review the extracted details before adding them to News.
      </Copy>
      {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
      {busy && (
        <View>
          <ActivityIndicator />
          <Copy>
            {result
              ? "Saving selected items…"
              : "Gemini is reading the newsletter…"}
          </Copy>
          {!result && !!progress && <Copy>{progress.completedBatches}/{progress.totalBatches || '…'} extraction/coverage checks saved · {progress.state}. You can close this window and resume later.</Copy>}
        </View>
      )}
      {saved ? (
        <>
          <Copy>
            Selected items are saved. Existing events, notices and RSVPs were
            preserved.
          </Copy>
          <Action label="Done" onPress={onClose} />
        </>
      ) : result ? (
        <>
          <Copy>
            Analyzed with {result.sourceModel}. Uncheck any item you do not want
            to publish.
          </Copy>
          <AnalysisCoverage result={result} />
          {analysisItems(result, config, {review:true}).map((item) => (
            <View
              key={item.id}
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#a8a29e",
                gap: 8,
              }}
            >
              <Action
                label={`${selected.includes(item.id) ? "✓ " : ""}${item.data.title}`}
                disabled={busy}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(item.id)
                      ? old.filter((id) => id !== item.id)
                      : [...old, item.id],
                  )
                }
              />
              <Copy>{item.data.description}</Copy>
              {!!item.data.sourcePage && <Copy>PDF page {item.data.sourcePage}</Copy>}
              {"day" in item.data && (
                <Copy>
                  {item.data.month} {item.data.day} • {item.data.time} •{" "}
                  {item.data.location}
                  {"\n"}RSVP: {item.data.deadline}
                </Copy>
              )}
            </View>
          ))}
          {!analysisItems(result, config, {review:true}).length && (
            <Copy>No qualifying RSVP events or highlights were found.</Copy>
          )}
          <Action
            label="Publish selected items"
            disabled={busy || !selected.length}
            onPress={() => void run(true)}
          />
        </>
      ) : (
        <Action
          label="Analyze newsletter with Gemini"
          disabled={busy}
          onPress={() => void run(false)}
        />
      )}
    </NewsDialog>
  );
}
