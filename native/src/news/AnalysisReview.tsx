import { useState, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import type { NewsletterConfig } from "../models";
import { Action, Copy, NewsDialog } from "./ui";
import { analyzeNewsletter, applyAnalysis } from "./ai";
import { analysisItems, type AnalysisResult } from "./analysisModel";
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
        const next = await analyzeNewsletter(config);
        setResult(next);
        setSelected(analysisItems(next, config).map((item) => item.id));
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Analysis failed. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <NewsDialog
      title="Newsletter AI analysis"
      subtitle={config.editionTitle}
      busy={busy}
      onClose={onClose}
    >
      <Copy>
        Find special, non-recurring RSVP events and important community stories.
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
          {analysisItems(result, config).map((item) => (
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
              {"day" in item.data && (
                <Copy>
                  {item.data.month} {item.data.day} • {item.data.time} •{" "}
                  {item.data.location}
                  {"\n"}RSVP: {item.data.deadline}
                </Copy>
              )}
            </View>
          ))}
          {!analysisItems(result, config).length && (
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
