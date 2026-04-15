import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LocalImage = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

/** Relative path inside `booking-payment-proofs` bucket: `{userId}/{bookingId}/proof.{ext}` */
export async function uploadBookingPaymentProof(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string,
  image: LocalImage,
): Promise<{ storagePath: string } | { error: string }> {
  const base64FromPicker = (image.base64 ?? "").trim();
  const mimeFromPicker = (image.mimeType ?? "").trim().toLowerCase();
  if (base64FromPicker) {
    const ext =
      mimeFromPicker.includes("png") ? "png" : mimeFromPicker.includes("webp") ? "webp" : "jpg";
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const storagePath = `${userId}/${bookingId}/proof.${ext}`;
    try {
      const buffer = decode(base64FromPicker);
      const { error: upErr } = await supabase.storage
        .from("booking-payment-proofs")
        .upload(storagePath, buffer, { contentType, upsert: true });
      if (upErr) return { error: upErr.message };
      return { storagePath };
    } catch {
      return { error: "Could not process the selected image." };
    }
  }

  // Android often returns `content://` URIs that can't be read directly as base64.
  // Copy to a local cache file first to ensure `readAsStringAsync` works reliably.
  const localUri = image.uri;
  let readableUri = localUri;
  try {
    if (localUri.startsWith("content://")) {
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
      const cachePath = `${cacheDir}booking-proof-${bookingId}.jpg`;
      if (!cachePath) return { error: "Could not access a local cache path for this device." };
      await FileSystem.copyAsync({ from: localUri, to: cachePath });
      readableUri = cachePath;
    }
  } catch {
    return { error: "Could not prepare the selected image for upload." };
  }

  const extMatch = /\.(jpe?g|png|webp)$/i.exec(readableUri);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const storagePath = `${userId}/${bookingId}/proof.${ext}`;

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(readableUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return { error: "Could not read the selected image." };
  }

  const buffer = decode(base64);
  const { error: upErr } = await supabase.storage
    .from("booking-payment-proofs")
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (upErr) {
    return { error: upErr.message };
  }

  return { storagePath };
}
