import { usePresentation } from "../shell/TownLoopShell";
import { useRef, useState } from "react";
import { Image, View, Pressable } from "react-native";
import { Trash2, MessageSquare, Tag } from "lucide-react-native";
import type { MediaAttachment } from "../../../src/types";
import {
  Action,
  Copy,
  Field,
  ErrorNotice,
  UploadTarget,
  useNewsStyles,
} from "../news/ui";
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
  const s = useNewsStyles();
  const dark = !!usePresentation()?.dark;
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
      sheet
      serif
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
      <View style={{ gap: 6 }}>
        <Copy weight="bold">Post Category</Copy>
        <View
          style={[
            s.row,
            {
              padding: 6,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: s.input.borderColor,
              backgroundColor: s.input.backgroundColor,
              gap: 8,
              flexWrap: "nowrap",
            },
          ]}
        >
          {(["post", "listing"] as const).map((value) => {
            const Icon = value === "post" ? MessageSquare : Tag;
            const selected = kind === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={
                  value === "post" ? "Discussion Feed" : "Buy / Free / Sell"
                }
                accessibilityState={{ selected, disabled: busy }}
                disabled={busy}
                onPress={() => setKind(value)}
                hitSlop={6}
                style={{
                  flex: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: selected ? "#047857" : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon size={16} color={selected ? "#fff" : s.input.color} />
                <Copy
                  weight="extra"
                  style={{
                    color: selected ? "#fff" : s.input.color,
                    lineHeight: 16,
                  }}
                >
                  {value === "post" ? "Discussion Feed" : "Buy / Free / Sell"}
                </Copy>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field
        labelCase="natural"
        style={{
          minHeight: 42,
          paddingVertical: 10,
          lineHeight: 20,
          backgroundColor: dark ? "#1e293b" : "#fff",
          borderRadius: 12,
        }}
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
          labelCase="natural"
          style={{
            minHeight: 42,
            paddingVertical: 10,
            lineHeight: 20,
            backgroundColor: dark ? "#1e293b" : "#fff",
            borderRadius: 12,
          }}
          label="Price (Type FREE or $ amount)"
          value={price}
          onChangeText={setPrice}
          onBlur={() => setPrice(formatPrice(price))}
          editable={!busy}
          placeholder="FREE or $25"
        />
      )}
      <Field
        labelCase="natural"
        label={
          kind === "post"
            ? "Post Content & Discussion Details"
            : "Details & Pickup Information"
        }
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        multiline
        style={{
          minHeight: 90,
          backgroundColor: dark ? "#1e293b" : "#fff",
          borderRadius: 12,
        }}
        placeholder={
          kind === "post"
            ? "Share details, updates, or stories with your neighbors…"
            : "Describe the item and arrange porch pickup…"
        }
      />
      <View style={{ gap: 6 }}>
        <Copy weight="bold">Photos & Videos</Copy>
        <UploadTarget
          label="Tap to upload photos or videos"
          note="Supports JPG, PNG, WebP, MP4, MOV up to 25MB"
          disabled={busy}
          onUpload={() => void upload()}
          onCamera={() => void upload(true)}
        />
        {progress !== null && (
          <Copy accessibilityLiveRegion="polite">
            Uploading media… {progress}%
          </Copy>
        )}
      </View>
      {!!media.length && (
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
      )}
      {!!error && <ErrorNotice message={error} />}
      <Action
        size="large"
        radius={16}
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
