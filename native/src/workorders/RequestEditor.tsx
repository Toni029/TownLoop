import { PrivateImage } from '../components/PrivateImage';
import { CategoryPicker } from "./CategoryPicker";
import { usePresentation } from "../shell/TownLoopShell";
import { useEffect, useRef, useState } from "react";
import type { ImagePickerAsset } from "expo-image-picker";
import { View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { WORK_ORDER_CATEGORIES } from "../../../src/data/workOrderCategories";
import {
  Action,
  Copy,
  Field,
  ErrorNotice,
  UploadTarget,
  useNewsStyles,
} from "../news/ui";
import { WorkOrderSheet } from "./WorkOrderSheet";
import { pickAndUpload } from "../components/media";
import { newOrderId, submitWorkOrder, editWorkOrder } from "./actions";
import type { WorkOrder } from "./model";
export function RequestEditor({
  order,
  onClose,
  onSaved,
}: {
  order?: WorkOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = useNewsStyles();
  const dark = !!usePresentation()?.dark;
  const [id] = useState(() => order ? String(order.id) : newOrderId());
  const [category, setCategory] = useState(order?.category || WORK_ORDER_CATEGORIES[0].name);
  const [dismissRequested, setDismissRequested] = useState(false);
  const [title, setTitle] = useState(order?.title || "");
  const [description, setDescription] = useState(order?.description || "");
  const [photos, setPhotos] = useState<string[]>(order?.photos || (order?.photoUrl ? [order.photoUrl] : []));
  const [pendingPhotos, setPendingPhotos] = useState<ImagePickerAsset[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function upload() {
    if (lock.current) return;
    lock.current = true;
    setPicking(true);
    setError("");
    try {
      await pickAndUpload("work_orders", () => {}, false, undefined, {
        selectOnly: true,
        isActive: () => mounted.current,
        onSelected: assets => {
          if (mounted.current) setPendingPhotos(previous => [...previous, ...assets]);
        },
      });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Unable to attach photos.");
    } finally {
      lock.current = false;
      if (mounted.current) setPicking(false);
    }
  }
  async function submit() {
    if (lock.current) return;
    if (!title.trim()) {
      setError("Please describe what needs fixing.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let attachments = photos;
      if (pendingPhotos.length) {
        const uploaded = await pickAndUpload("work_orders",
          value => { if (mounted.current) setProgress(value); }, false,
          { recordId: id, collection: "work_orders" }, {
            assets: pendingPhotos,
            isActive: () => mounted.current,
            onUploaded: (file, asset) => {
              if (!mounted.current) return;
              setPhotos(previous => [...previous, file.url]);
              setPendingPhotos(previous => previous.filter(item => item !== asset));
            },
          });
        attachments = [...photos, ...uploaded.map(file => file.url)];
      }
      if (!mounted.current) return;
      if (order) await editWorkOrder(id, { title, description, category, photos: attachments });
      else await submitWorkOrder(id, { title, description, category, photos: attachments });
      if (mounted.current) { onSaved(); setDismissRequested(true); }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Unable to submit request.");
    } finally {
      lock.current = false;
      if (mounted.current) { setBusy(false); setProgress(null); }
    }
  }
  return (
    <WorkOrderSheet
      title={order ? "🛠️ Edit Work Order Request" : "🛠️ New Work Order Request"}
      subtitle={order ? "Update your maintenance request" : "Submit an issue to the maintenance crew"}
      busy={busy}
      onClose={onClose}
      dismissRequested={dismissRequested}

    >
      <CategoryPicker value={category} onChange={setCategory} disabled={busy} />
      <Copy style={{ color: "#a8a29e", fontSize: 11, marginTop: -6 }}>
        {WORK_ORDER_CATEGORIES.find((c) => c.name === category)?.description}
      </Copy>
      <Field
        label="What Needs Fixing? *"
        style={{
          minHeight: 42,
          paddingVertical: 10,
          lineHeight: 20,
          backgroundColor: dark ? "#1e293b" : "#fff",
        }}
        value={title}
        onChangeText={setTitle}
        editable={!busy}
        placeholder="e.g. Master bathroom sink dripping constantly"
      />
      <Field
        label="Description of Issue"
        style={{ minHeight: 82, backgroundColor: dark ? "#1e293b" : "#fff" }}
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        multiline
        placeholder="Provide details about the issue (exact room, how long it has been happening, accessibility instructions)..."
      />
      <View
        style={{
          borderTopWidth: 1,
          borderColor: "#e7e5e4",
          paddingTop: 14,
          gap: 12,
        }}
      >
        <View style={s.row}>
          <Copy weight="bold" style={{ flex: 1 }}>
            Attach Pictures
          </Copy>
          <Copy style={{ color: "#78716c" }}>Photos Only • No Videos</Copy>
        </View>
        <UploadTarget
          label="Add Photo"
          disabled={busy || picking}
          onUpload={() => void upload()}
        />
        {progress !== null && (
          <Copy accessibilityLiveRegion="polite">
            Uploading photo… {progress}%
          </Copy>
        )}
        <View style={s.row}>
          {[...photos, ...pendingPhotos.map(asset => asset.uri)].map((uri, index) => (
            <View key={`${uri}-${index}`} style={{ gap: 4 }}>
              <PrivateImage
                source={{ uri }}
                accessibilityLabel={`Attached photo ${index + 1}`}
                style={{ width: 90, height: 90, borderRadius: 12 }}
              />
              <Action
                compact
                label="Remove photo"
                icon={Trash2}
                tone="rose"
                disabled={busy}
                onPress={() =>
                  index < photos.length
                    ? setPhotos(p => p.filter((_, i) => i !== index))
                    : setPendingPhotos(p => p.filter((_, i) => i !== index - photos.length))
                }
              />
            </View>
          ))}
        </View>
      </View>


      {!!error && <ErrorNotice message={error} />}
      <Action
        size="large"
        radius={16}
        label={
          busy
            ? progress !== null
              ? `Uploading Photos (${progress}%)…`
              : pendingPhotos.length ? "Preparing Photos…" : order ? "Saving Changes…" : "Submitting Request…"
            : order ? "Save Changes" : "Submit Work Order"
        }
        disabled={busy || picking}
        onPress={() => void submit()}
      />

    </WorkOrderSheet>
  );
}
