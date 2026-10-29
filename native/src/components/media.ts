import * as Picker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { ensureMediaDraft, type MediaRecordLink } from '../../../src/services/mediaAuthorization';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { approvedUser } from '../news/actions';
import { deadline } from '../media/deadline';
import { uploadFile, uploadedFileURL } from '../media/uploadFile';
import type { MediaAttachment } from '../../../src/types';

// Pending selected assets keep only completed paths, never auth tokens or file bytes.
const completedTransfers = new WeakMap<Picker.ImagePickerAsset, MediaRecordLink & { uid: string; path: string }>();

export async function pickAndUpload(
  folder: 'work_orders' | 'marketplace' | 'feed',
  onProgress: (value: number) => void,
  camera = false,
  link?: MediaRecordLink,
  selection?: {
    assets?: Picker.ImagePickerAsset[];
    selectOnly?: boolean;
    isActive?: () => boolean;
    onPickerSettled?: (outcome: 'selected' | 'cancelled' | 'error') => void;
    onSelected?: (assets: Picker.ImagePickerAsset[]) => void;
    onUploaded?: (file: MediaAttachment, asset: Picker.ImagePickerAsset) => void;
  },
): Promise<MediaAttachment[]> {
  const user = await deadline(approvedUser(), 20_000, 'Checking your account');
  if (selection?.isActive?.() === false) return [];
  if (camera && !selection?.assets) {
    const permission = await Picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is needed to take a picture. You can also select one from your library.');
  }
  const options: Picker.ImagePickerOptions = {
    mediaTypes: folder === 'work_orders' ? ['images'] : ['images', 'videos'],
    allowsMultipleSelection: !camera, quality: 1,
  };
  if (selection?.isActive?.() === false) return [];
  // Do not time out while the resident is choosing a photo in the system picker.
  let selected: Picker.ImagePickerResult;
  if (selection?.assets) {
    selected = { canceled: false, assets: selection.assets };
  } else {
    try {
      selected = camera
        ? await Picker.launchCameraAsync({ ...options, allowsMultipleSelection: false, mediaTypes: ['images'] })
        : await Picker.launchImageLibraryAsync(options);
    } catch (error) {
      selection?.onPickerSettled?.('error');
      throw error;
    }
    selection?.onPickerSettled?.(selected.canceled || !selected.assets?.length ? 'cancelled' : 'selected');
  }
  // A dismissed editor must not start processing a late native picker result.
  if (selection?.isActive?.() === false || selected.canceled || !selected.assets?.length) return [];
  selection?.onSelected?.(selected.assets);
  // Editors can stage local selections; processing/backend work starts only on submission.
  if (selection?.selectOnly) return [];
  if (!link) throw new Error("An attachment must be linked to its record before uploading.");
  await deadline(ensureMediaDraft(db, link, String(user.id)), 20_000, 'Preparing photo upload');
  const results: MediaAttachment[] = [];
  for (const [index, asset] of selected.assets.entries()) {
    if (auth.currentUser?.uid !== String(user.id)) throw new Error('Your session changed. Please sign in again.');
    const completed = completedTransfers.get(asset);
    if (completed?.uid === String(user.id) && completed.recordId === link.recordId && completed.collection === link.collection) {
      const url = await uploadedFileURL(completed.path, completed.uid);
      const file: MediaAttachment = { type: asset.type === 'video' ? 'video' : 'image', url, name: asset.fileName || 'Photo' };
      results.push(file);
      selection?.onUploaded?.(file, asset);
      completedTransfers.delete(asset);
      continue;
    }
    if (folder === 'work_orders' && asset.type === 'video') throw new Error('Photos Only • No Videos');
    if (asset.fileSize && asset.fileSize >= 25 * 1024 * 1024) throw new Error('File exceeds 25MB limit. Choose a smaller file.');
    let uri = asset.uri;
    let size = asset.fileSize || asset.file?.size || 0;
    let contentType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    let name = (asset.fileName || `photo-${index}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const temporary: string[] = [];
    try {
      if (Platform.OS !== 'web') {
        // Android document providers may return content://; normalize to a private cache file.
        if (!uri.startsWith('file://')) {
          const cached = `${FS.cacheDirectory}townloop-upload-${Date.now()}-${index}-${name}`;
          temporary.push(cached);
          await deadline(FS.copyAsync({ from: uri, to: cached }), 30_000, 'Reading selected file');
          uri = cached;
        }
        if (asset.type !== 'video') {
          const resize = Math.max(asset.width, asset.height) > 2048
            ? [{ resize: asset.width >= asset.height ? { width: 2048 } : { height: 2048 } }]
            : [];
          const image = await deadline(ImageManipulator.manipulateAsync(uri, resize, {
            compress: 0.85, format: ImageManipulator.SaveFormat.JPEG,
          }), 45_000, 'Preparing photo');
          uri = image.uri;
          temporary.push(uri);
          contentType = 'image/jpeg';
          name = name.replace(/\.[^.]+$/, '') + '.jpg';
        }
        const info = await deadline(FS.getInfoAsync(uri), 10_000, 'Reading photo size');
        if (!info.exists) throw new Error('The selected file is no longer available. Please select it again.');
        size = info.size;
      }
      if (size >= 25 * 1024 * 1024) throw new Error('File exceeds 25MB limit. Choose a smaller file.');
      if (Platform.OS !== 'web' && size <= 0) throw new Error('The selected file is empty. Please select another photo.');
      const path = `${folder}/${Date.now()}_${String(user.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.random().toString(36).slice(2, 8)}_${name}`;
      const url = await uploadFile({
        uri, webFile: asset.file, size, path, uid: String(user.id),
        metadata: { contentType, customMetadata: {
          securityVersion: '1', recordId: link.recordId, collection: link.collection,
          uploadedBy: String(user.id), uploaderEmail: user.email, uploaderName: user.name,
          folder, originalName: asset.fileName || name, uploadedAt: new Date().toISOString(),
        } },
        onTransferred: () => completedTransfers.set(asset, { ...link, uid: String(user.id), path }),
        progress: fraction => onProgress(Math.round((index + fraction) / selected.assets.length * 100)),
      });
      const file: MediaAttachment = { type: asset.type === 'video' ? 'video' : 'image', url, name: asset.fileName || name };
      results.push(file);
      selection?.onUploaded?.(file, asset);
      completedTransfers.delete(asset);
    } finally {
      // Only private files created by this operation; never delete gallery or remote objects.
      for (const file of temporary) void FS.deleteAsync(file, { idempotent: true }).catch(() => {});
    }
  }
  return results;
}
