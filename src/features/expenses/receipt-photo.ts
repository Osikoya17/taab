import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { MAX_SCAN_BASE64 } from '@/features/scans/draft';

/** Receipts only need to be legible: cap the width and re-encode as JPEG. */
const RECEIPT_MAX_WIDTH = 1600;

/** Resizes and compresses a photo into a data URI the server accepts, or null if it can't get small enough. */
export async function toReceiptDataUri(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > RECEIPT_MAX_WIDTH) context.resize({ width: RECEIPT_MAX_WIDTH, height: null });
  const image = await context.renderAsync();
  for (const compress of [0.7, 0.5, 0.35]) {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (saved.base64 && saved.base64.length <= MAX_SCAN_BASE64) return `data:image/jpeg;base64,${saved.base64}`;
  }
  return null;
}

export type PickResult =
  | { status: 'picked'; photos: string[]; tooLarge: number }
  | { status: 'cancelled' }
  | { status: 'no_camera_access' };

/** Takes a photo, or chooses one (or several, for bulk scans) from the library. */
export async function pickReceiptPhotos(source: 'camera' | 'library', options: { multiple?: boolean; limit?: number } = {}): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'no_camera_access' };
  }
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: source === 'library' && !!options.multiple,
    selectionLimit: options.multiple ? options.limit ?? 0 : 1,
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled || !result.assets.length) return { status: 'cancelled' };
  const converted = await Promise.all(result.assets.map((asset) => toReceiptDataUri(asset)));
  const photos = converted.filter((p): p is string => !!p);
  return { status: 'picked', photos, tooLarge: converted.length - photos.length };
}
