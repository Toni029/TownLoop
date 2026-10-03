import * as Picker from "expo-image-picker";
import { File } from "expo-file-system";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage, auth } from "../lib/firebase";
import { approvedUser } from "../news/actions";
import type { MediaAttachment } from "../../../src/types";
export async function pickAndUpload(
  folder: "work_orders" | "marketplace" | "feed",
  onProgress: (value: number) => void,
  camera = false,
): Promise<MediaAttachment[]> {
  const user = await approvedUser();
  if (camera) {
    const permission = await Picker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Camera access is needed to take a picture. You can also select one from your library.",
      );
  }
  const options: Picker.ImagePickerOptions = {
    mediaTypes: folder === "work_orders" ? ["images"] : ["images", "videos"],
    allowsMultipleSelection: !camera,
    quality: 1,
  };
  const selected = camera
    ? await Picker.launchCameraAsync({
        ...options,
        allowsMultipleSelection: false,
        mediaTypes: ["images"],
      })
    : await Picker.launchImageLibraryAsync(options);
  if (selected.canceled) return [];
  const results: MediaAttachment[] = [];
  for (const [index, asset] of selected.assets.entries()) {
    if (auth.currentUser?.uid !== String(user.id))
      throw new Error("Your session changed. Please sign in again.");
    const file = new File(asset.uri);
    if (file.size > 25 * 1024 * 1024)
      throw new Error("File exceeds 25MB limit.");
    if (folder === "work_orders" && asset.type === "video")
      throw new Error("Photos Only • No Videos");
    const name = (asset.fileName || `photo-${index}.jpg`).replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const path = `${folder}/${Date.now()}_${String(user.id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${Math.random().toString(36).slice(2, 8)}_${name}`;
    const bytes = await file.bytes();
    const task = uploadBytesResumable(ref(storage, path), bytes, {
      contentType:
        asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      customMetadata: {
        uploadedBy: String(user.id),
        uploaderEmail: user.email,
        uploaderName: user.name,
        folder,
        originalName: asset.fileName || name,
        uploadedAt: new Date().toISOString(),
      },
    });
    const url = await new Promise<string>((resolve, reject) => {
      let settled = false;
      let stopUpload = () => {};
      let stopAuth = () => {};
      const finish = (error?: unknown, value?: string) => {
        if (settled) return;
        settled = true;
        stopUpload();
        stopAuth();
        if (error) reject(error);
        else resolve(value!);
      };
      stopUpload = task.on(
        "state_changed",
        (snapshot) => {
          if (settled) return;
          onProgress(
            Math.round(
              ((index +
                snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) /
                selected.assets.length) *
                100,
            ),
          );
        },
        (error) => finish(error),
        () => {
          void getDownloadURL(task.snapshot.ref).then(
            (value) => {
              if (auth.currentUser?.uid !== String(user.id))
                finish(
                  new Error("Your session changed. Please sign in again."),
                );
              else finish(undefined, value);
            },
            (error) => finish(error),
          );
        },
      );
      stopAuth = onAuthStateChanged(auth, (current) => {
        if (current?.uid !== String(user.id)) {
          task.cancel();
          finish(new Error("Your session changed. Please sign in again."));
        }
      });
    });
    results.push({
      type: asset.type === "video" ? "video" : "image",
      url,
      name: asset.fileName || name,
    });
  }
  return results;
}
