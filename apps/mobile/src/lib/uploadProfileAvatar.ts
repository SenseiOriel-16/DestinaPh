import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Uploads a local image to Supabase Storage (`business-images` bucket, path `{userId}/profile-avatar.jpg`)
 * and updates `public.profiles.avatar_url`. Reuses the existing owner-scoped storage policy.
 */
export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  userId: string,
  localUri: string,
): Promise<{ publicUrl: string } | { error: string }> {
  const extMatch = /\.(jpe?g|png|webp)$/i.exec(localUri);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const objectPath = `${userId}/profile-avatar.${ext}`;

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return { error: "Could not read the selected image." };
  }

  const buffer = decode(base64);
  const { error: upErr } = await supabase.storage
    .from("business-images")
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (upErr) {
    return { error: upErr.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("business-images").getPublicUrl(objectPath);

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (dbErr) {
    return { error: dbErr.message };
  }

  await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  });

  return { publicUrl };
}
