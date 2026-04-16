import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

export type ConversationRow = {
  id: string;
  consumer_id: string;
  business_id: string;
  last_message_at: string | null;
  last_message_text: string | null;
  businesses?: {
    id: string;
    name: string | null;
    business_photos?: { storage_path: string; sort_order?: number | null }[] | null;
  } | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  text: string | null;
  image_storage_path: string | null;
  created_at: string;
  read_at: string | null;
};

export async function getOrCreateConversation(businessId: string): Promise<{ id: string } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { error: "Please sign in to message." };

  const { data: existing, error: selErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("consumer_id", uid)
    .eq("business_id", businessId)
    .maybeSingle();
  if (selErr) return { error: selErr.message };
  if (existing?.id) return { id: existing.id as string };

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({ consumer_id: uid, business_id: businessId })
    .select("id")
    .single();
  if (insErr || !created?.id) return { error: insErr?.message ?? "Could not start conversation." };
  return { id: created.id as string };
}

export async function listMyConversations(): Promise<{ rows: ConversationRow[] } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { rows: [] };

  const { data, error } = await supabase
    .from("conversations")
    .select("id,consumer_id,business_id,last_message_at,last_message_text,businesses(id,name,business_photos(storage_path,sort_order))")
    .eq("consumer_id", uid)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { rows: (data as unknown as ConversationRow[]) ?? [] };
}

export async function listMessages(conversationId: string): Promise<{ rows: MessageRow[] } | { error: string }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_profile_id,text,image_storage_path,created_at,read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { rows: (data as unknown as MessageRow[]) ?? [] };
}

export async function sendTextMessage(conversationId: string, text: string): Promise<{ ok: true } | { error: string }> {
  const t = text.trim();
  if (!t) return { error: "Type a message first." };
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { error: "Please sign in to message." };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_profile_id: uid,
    text: t,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function pickChatImage(): Promise<{ uri: string } | { error: string } | { cancelled: true }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: "Allow photo access to send images." };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });
  if (res.canceled) return { cancelled: true };
  const uri = res.assets[0]?.uri;
  if (!uri) return { error: "No image selected." };
  return { uri };
}

export async function uploadChatImage(uri: string): Promise<{ path: string } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { error: "Please sign in to send images." };

  const resp = await fetch(uri);
  const blob = await resp.blob();
  const ext = (blob.type || "image/jpeg").split("/")[1] || "jpg";
  const path = `${uid}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("chat-images").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

export async function sendImageMessage(conversationId: string, imagePath: string): Promise<{ ok: true } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { error: "Please sign in to message." };
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_profile_id: uid,
    image_storage_path: imagePath,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function getChatImageUrl(path: string): Promise<string | null> {
  const p = (path ?? "").trim();
  if (!p) return null;
  const { data, error } = await supabase.storage.from("chat-images").createSignedUrl(p, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

