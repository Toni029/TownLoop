import { useRef, useState } from "react";
import { Image, View } from "react-native";
import {
  Camera,
  Upload,
  Trash2,
  MessageSquare,
  Tag,
} from "lucide-react-native";
import type { MediaAttachment } from "../../../src/types";
import { Action, Copy, Field, ErrorNotice, s } from "../news/ui";
import { ProductDialog } from "../components/ProductDialog";
import { pickAndUpload } from "../components/media";
import { formatPrice } from "./model";
import { newSocialId, publishSocial, type SocialKind } from "./actions";
export function CreateEditor({
  initialKind,
  onClose,
  onSaved,
}: {
  initialKind: SocialKind;
  onClose: () => void;
  onSaved: (kind: SocialKind) => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [id] = useState(newSocialId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function upload(camera = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const files = await pickAndUpload(
        kind === "post" ? "feed" : "marketplace",
        setProgress,
        camera,
      );
      setMedia((p) => [...p, ...files]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to attach media.");
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  async function publish() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await publishSocial(id, kind, { title, description, price, media });
      onSaved(kind);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to publish.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ProductDialog
      title={
        kind === "post" ? "Create Community Post" : "Post Item for Sale / Free"
      }
      subtitle={
        kind === "post"
          ? "Share announcements, stories, pictures & videos with TownLoop neighbors."
          : "Share items, furniture, tools & giveaways with TownLoop neighbors."
      }
      busy={busy}
      onClose={onClose}
    >
      <Copy weight="bold">Post Category</Copy>
      <View
        style={[
          s.row,
          { padding: 6, borderRadius: 16, backgroundColor: "#f5f5f4" },
        ]}
      >
        <Action
          label="Discussion Feed"
          icon={MessageSquare}
          tone={kind === "post" ? "green" : "light"}
          disabled={busy}
          onPress={() => setKind("post")}
        />
        <Action
          label="Buy / Free / Sell"
          icon={Tag}
          tone={kind === "listing" ? "green" : "light"}
          disabled={busy}
          onPress={() => setKind("listing")}
        />
      </View>
      <Field
        label={kind === "post" ? "Subject / Title" : "Item Name"}
        value={title}
        onChangeText={setTitle}
        editable={!busy}
        placeholder={
          kind === "post"
            ? "e.g. Neighborhood update"
            : "e.g. Solid wood dining table"
        }
      />
      {kind === "listing" && (
        <Field
          label="Price (Type FREE or $ amount)"
          value={price}
          onChangeText={setPrice}
          onBlur={() => setPrice(formatPrice(price))}
          editable={!busy}
          placeholder="FREE or $25"
        />
      )}
      <Field
        label={
          kind === "post"
            ? "Post Content & Discussion Details"
            : "Details & Pickup Information"
        }
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        multiline
        placeholder={
          kind === "post"
            ? "Share details, updates, or stories with your neighbors…"
            : "Describe the item and arrange porch pickup…"
        }
      />
      <View style={[s.card, { borderStyle: "dashed", borderWidth: 2 }]}>
        <Copy weight="bold">Photos & Videos</Copy>
        <Action
          label="Tap to upload photos or videos"
          icon={Upload}
          tone="light"
          disabled={busy}
          onPress={() => void upload()}
        />
        <Action
          label="Take Picture"
          icon={Camera}
          tone="light"
          disabled={busy}
          onPress={() => void upload(true)}
        />
        {progress !== null && (
          <Copy accessibilityLiveRegion="polite">
            Uploading media… {progress}%
          </Copy>
        )}
      </View>
      <View style={s.row}>
        {media.map((m, i) => (
          <View key={`${m.url}-${i}`} style={{ gap: 6 }}>
            {m.type === "image" ? (
              <Image
                source={{ uri: m.url }}
                style={{ width: 96, height: 96, borderRadius: 12 }}
                accessibilityLabel={m.name || "Attached photo"}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  backgroundColor: "#0c0a09",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Copy style={{ color: "#fff" }}>▶ Video</Copy>
              </View>
            )}
            <Action
              label="Remove media"
              icon={Trash2}
              tone="rose"
              compact
              disabled={busy}
              onPress={() =>
                setMedia((p) => p.filter((_, index) => index !== i))
              }
            />
          </View>
        ))}
      </View>
      {!!(error) && <ErrorNotice message={error} />}
      <Action
        label={
          busy
            ? "Publishing…"
            : kind === "post"
              ? "Publish Post to Discussion Feed"
              : "Publish Item to Marketplace"
        }
        disabled={busy}
        onPress={() => void publish()}
      />
    </ProductDialog>
  );
}
