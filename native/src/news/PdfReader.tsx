import { TextInput } from '../keyboard/KeyboardScrollView';
import { SystemBars } from "../components/SystemBars";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,

  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  Upload,
  X,
} from "lucide-react-native";
import type { NewsletterPdfRef } from "./PdfPages";
import type { NewsletterConfig } from "../models";
import { Action, Copy, s } from "./ui";
import { PdfPages } from "./PdfPages";
import { preparePdf, sharePdf, invalidatePreparedPdf } from "./files";
import { editionKey } from "./model";
import { activeEdition } from "./edition";
export function PdfReader({
  config,
  onClose,
  onUpload,
}: {
  config: NewsletterConfig;
  onClose: () => void;
  onUpload?: () => void;
}) {
  const [uri, setUri] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  // Gesture feedback is display-only; never echo it back as a native scale command.
  const [commandZoom, setCommandZoom] = useState(1);
  const scaleChanged = useCallback((value: number) => setZoom(value), []);
  const source = useMemo(() => ({uri, cache: false}), [uri]);
  const currentPage = useRef(1);
  const pageChanged = useCallback((n: number) => {
    currentPage.current = n;
    setPage(n);
    setPageInput(String(n));
  }, []);
  const pdfError = useCallback(() => setError("The newsletter could not be opened. Please try again."), []);
  const zoomTo = (value: number) => {
    setZoom(value);
    if (Platform.OS === "web") setCommandZoom(value);
    else pdf.current?.setScale(value);
  };
  const [sharing, setSharing] = useState(false);
  const pdf = useRef<NewsletterPdfRef>(null);
  const sharingRef = useRef(false);
  const currentConfig = useRef(config);
  currentConfig.current = config;
  const edition = editionKey(config);
  useEffect(() => {
    const config = currentConfig.current;
    let active = true;
    let dispose = () => {};
    const timer = setTimeout(() => {
      if (active)
        setError(
          "Opening the newsletter is taking longer than expected. Check your connection and try again.",
        );
    }, 20000);
    void preparePdf(config)
      .then((file) => {
        if (!active) {
          file.dispose();
          return;
        }
        dispose = file.dispose;
        setError("");
        setUri(file.uri);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to open newsletter.",
          );
      })
      .finally(() => clearTimeout(timer));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void activeEdition(config).catch(() => {
          if (active) {
            setUri("");
            invalidatePreparedPdf();
            dispose();
            setError("This edition is no longer available. Return to News.");
          }
        });
    });
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
      dispose();
    };
  }, [edition, attempt]);
  const changePage = (next: number) => {
    if (!Number.isFinite(next) || pages < 1) return;
    const n = Math.max(1, Math.min(pages, Math.trunc(next)));
    // Native page jumps reset pan offsets. Blur/submit of the unchanged page
    // must leave the native pinch focal point and viewport entirely untouched.
    if (n !== currentPage.current) {
      currentPage.current = n; // Deduplicate submit + blur before React rerenders.
      pdf.current?.setPage(n);
    }
    setPage(n);
    setPageInput(String(n));
  };
  async function download() {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    try {
      await sharePdf(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save PDF.");
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }
  return (
    <Modal statusBarTranslucent navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SystemBars dark />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0c0a09" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0c0a09" }}>
        <View
          style={[
            s.row,
            {
              flexWrap: "nowrap",
              minHeight: 48,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: "#1c1917",
              borderBottomWidth: 1,
              borderColor: "#292524",
            },
          ]}
        >
          <BookOpen size={18} color="#6ee7b7" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Copy
              numberOfLines={1}
              weight="serif"
              style={{ fontSize: 14, color: "#f5f5f4" }}
            >
              {config.editionTitle}
            </Copy>
            <Copy numberOfLines={1} style={{ color: "#34d399", fontSize: 10 }}>
              {config.monthEdition} • Official Resident Edition
            </Copy>
          </View>
          <ReaderIcon
            label="Download PDF"
            Icon={Download}
            onPress={() => void download()}
            disabled={!uri || sharing}
          />
          {onUpload && (
            <ReaderIcon
              label="Upload New PDF"
              Icon={Upload}
              onPress={onUpload}
            />
          )}
          <ReaderIcon label="Close Reader" Icon={X} onPress={onClose} />
        </View>
        <View style={{ flex: 1, padding: 2 }}>
          {error ? (
            <View accessibilityRole="alert" style={{ padding: 24, gap: 16 }}>
              <Copy style={{ color: "#e7e5e4", fontSize: 14 }}>{error}</Copy>
              <Action
                label="Try again"
                onPress={() => {
                  invalidatePreparedPdf();
                  setUri("");
                  setError("");
                  setPages(0);
                  zoomTo(1);
                  setAttempt((n) => n + 1);
                }}
              />
            </View>
          ) : uri ? (
            <PdfPages
              ref={pdf}
              source={source}
              style={pdfStyle}
              scale={commandZoom}
              onLoadComplete={setPages}
              onPageChanged={pageChanged}
              onScaleChanged={scaleChanged}
              onError={pdfError}
              renderActivityIndicator={pdfLoading}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <ActivityIndicator color="#34d399" />
              <Copy style={{ color: "#e7e5e4" }}>Opening newsletter...</Copy>
            </View>
          )}
        </View>
        {pages > 0 && !error && (
          <View
            style={[
              s.row,
              {
                justifyContent: "center",
                padding: 2,
                borderTopWidth: 1,
                borderColor: "#292524",
                gap: 4,
              },
            ]}
          >
            <ReaderIcon
              label="Previous page"
              Icon={ChevronLeft}
              onPress={() => changePage(page - 1)}
              disabled={page <= 1}
            />
            <TextInput
              accessibilityLabel="Go to page"
              keyboardType="number-pad"
              selectTextOnFocus
              value={pageInput}
              onChangeText={setPageInput}
              onSubmitEditing={() => changePage(Number(pageInput) || page)}
              onBlur={() => changePage(Number(pageInput) || page)}
              style={{
                minWidth: 36,
                minHeight: 40,
                color: "white",
                textAlign: "center",
                backgroundColor: "#292524",
                borderRadius: 8,
                paddingHorizontal: 6,
              }}
            />
            <Copy style={{ color: "#e7e5e4" }}>of {pages}</Copy>
            <ReaderIcon
              label="Next page"
              Icon={ChevronRight}
              onPress={() => changePage(page + 1)}
              disabled={page >= pages}
            />
            <ReaderIcon
              label="Zoom out"
              Icon={Minus}
              onPress={() => zoomTo(Math.max(0.75, zoom - 0.25))}
              disabled={zoom <= 0.75}
            />
            <Copy style={{ color: "#e7e5e4", width: 40, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </Copy>
            <ReaderIcon
              label="Zoom in"
              Icon={Plus}
              onPress={() => zoomTo(Math.min(2.5, zoom + 0.25))}
              disabled={zoom >= 2.5}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => zoomTo(1)}
              style={{
                minHeight: 40,
                padding: 8,
                backgroundColor: "#292524",
                borderRadius: 8,
                justifyContent: "center",
              }}
            >
              <Copy style={{ color: "#fff" }}>Fit width</Copy>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function ReaderIcon({
  label,
  Icon,
  onPress,
  disabled = false,
}: {
  label: string;
  Icon: typeof X;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={3}
      style={({ pressed }) => ({
        width: 38,
        height: 40,
        borderRadius: 9,
        backgroundColor: pressed ? "#44403c" : "#292524",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon size={18} color="#e7e5e4" />
    </Pressable>
  );
}

const pdfStyle = {flex: 1, backgroundColor: "#0c0a09"};
const pdfLoading = () => <ActivityIndicator color="#34d399" accessibilityLabel="Opening newsletter pages" />;
