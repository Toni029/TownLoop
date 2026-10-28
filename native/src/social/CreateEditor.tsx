import { PrivateImage as Image } from '../components/PrivateImage';
import { usePresentation } from "../shell/TownLoopShell";
import { useEffect, useRef, useState } from "react";
import type { ImagePickerAsset } from "expo-image-picker";
import { View, Pressable, Platform } from "react-native";
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
import { formatPrice, mediaFor, type Listing } from "./model";
import { newSocialId, publishSocial, editListing, type SocialKind } from "./actions";
export function CreateEditor({
  initialKind,
  listing,
  onClose,
  onSaved,
}: {
  initialKind: SocialKind;
  listing?: Listing;
  onClose: () => void;
  onSaved: (kind: SocialKind) => void;
}) {
  const s = useNewsStyles();
  const dark = !!usePresentation()?.dark;
  const [kind, setKind] = useState(initialKind);
  const [id] = useState(() => listing ? String(listing.id) : newSocialId());
  const [title, setTitle] = useState(listing?.title || "");
  const [description, setDescription] = useState(listing?.description || "");
  const [price, setPrice] = useState(listing?.price || "");
  const [media, setMedia] = useState<MediaAttachment[]>(listing ? mediaFor(listing) : []);
  const [pendingMedia, setPendingMedia] = useState<ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  const [picking, setPicking] = useState(false);
  const [nativeWindowKey, setNativeWindowKey] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function upload(camera = false, retry = false) {
    if (lock.current) return;
    lock.current = true;
    // The external picker is not an upload: leave sheet close/drag and fields usable.
    setPicking(!retry);
    setBusy(retry);
    setError("");
    setProgress(retry ? 0 : null);
    try {
      await pickAndUpload(
        kind === "post" ? "feed" : "marketplace",
        value => { if (mounted.current) setProgress(value); },
        camera,
        { recordId: id, collection: kind === 'post' ? 'discussion_feed' : 'marketplace_posts' },
        {
          assets: retry ? pendingMedia : undefined,
          isActive: () => mounted.current,
          onPickerSettled: outcome => {
            if (!mounted.current) return;
            setPicking(false);
            if (outcome !== 'selected' && Platform.OS === 'android') {
              // Recreate only the native window/touch dispatch after the external
              // activity. Editor data, expansion and animation state stay mounted.
              setNativeWindowKey(value => value + 1);
            }
          },
          selectOnly: kind === "post" && !retry,
          onSelected: assets => {
            if (!mounted.current) return;
            setPendingMedia(assets);
            setBusy(kind !== 'post' || retry);
          },
          onUploaded: (file, asset) => {
            if (!mounted.current) return;
            setMedia(previous => [...previous, file]);
            setPendingMedia(previous => previous.filter(item => item !== asset));
          },
        },
      );
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Unable to attach media.");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setPicking(false);
        setBusy(false);
        setProgress(null);
      }
    }
  }
  async function publish() {
    if (lock.current) return;
    if (kind !== "post" && pendingMedia.length) {
      setError("Retry or remove the selected photos before publishing.");
      return;
    }
    if (kind === "post" && (!title.trim() || !description.trim())) {
      setError("Please provide a title and description.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let attachments = media;
      if (kind === "post" && pendingMedia.length) {
        setProgress(0);
        const uploaded = await pickAndUpload("feed", setProgress, false,
          { recordId: id, collection: "discussion_feed" }, {
            assets: pendingMedia,
            onUploaded: (file, asset) => {
              setMedia(previous => [...previous, file]);
              setPendingMedia(previous => previous.filter(item => item !== asset));
            },
          });
        attachments = [...media, ...uploaded];
      }
      if (listing) await editListing(id, { title, description, price, media: attachments });
      else await publishSocial(id, kind, { title, description, price, media: attachments });
      onSaved(kind);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to publish.");
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  return (
    <ProductDialog
      sheet
      serif
      title={
        listing ? "Edit Marketplace Listing" : kind === "post" ? "Create Community Post" : "Post Item for Sale / Free"
      }
      subtitle={
        kind === "post"
          ? "Share announcements, stories, pictures & videos with TownLoop neighbors."
          : "Share items, furniture, tools & giveaways with TownLoop neighbors."
      }
      busy={busy}
      nativeWindowKey={nativeWindowKey}
      onClose={onClose}
    >
      {!listing && <View style={{ gap: 6 }}>
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
                accessibilityState={{ selected, disabled: busy || picking || media.length > 0 || pendingMedia.length > 0 }}
                disabled={busy || picking || media.length > 0 || pendingMedia.length > 0}
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
      </View>}
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
        editable={!busy || progress !== null}
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
          editable={!busy || progress !== null}
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
        editable={!busy || progress !== null}
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
          disabled={busy || picking || pendingMedia.length > 0}
          onUpload={() => void upload()}
          onCamera={() => void upload(true)}
        />
        {progress !== null && (
          <Copy accessibilityLiveRegion="polite">
            Uploading media… {progress}%
          </Copy>
        )}
      </View>
      {!!pendingMedia.length && (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            {pendingMedia.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={{ gap: 6 }}>
                {asset.type !== "video" && (
                  <Image source={{ uri: asset.uri }} style={{ width: 96, height: 96, borderRadius: 12 }} accessibilityLabel="Selected photo awaiting upload" />
                )}
                <Action label="Remove selected media" icon={Trash2} tone="rose" compact disabled={busy}
                  onPress={() => setPendingMedia(previous => previous.filter((_, i) => i !== index))} />
              </View>
            ))}
          </View>
          {!busy && (kind !== "post" || !!error) && <Action label="Retry selected media" onPress={() => void upload(false, true)} />}
        </View>
      )}
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
                disabled={busy || picking}
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
            ? progress !== null ? "Uploading media…" : listing ? "Saving Changes…" : "Publishing…"
            : listing ? "Save Changes" : kind === "post"
              ? "Publish Post to Discussion Feed"
              : "Publish Item to Marketplace"
        }
        disabled={busy || picking}
        onPress={() => void publish()}
      />
    </ProductDialog>
  );
}
