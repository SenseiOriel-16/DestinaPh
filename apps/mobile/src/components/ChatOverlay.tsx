import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme/colors";
import { firstPhotoPublicUrl } from "../lib/businessDisplay";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import {
  getChatImageUrl,
  getOrCreateConversation,
  listMessages,
  pickChatImage,
  sendImageMessage,
  sendTextMessage,
  uploadChatImage,
  type MessageRow,
} from "../lib/chat";
import { supabase } from "../lib/supabase";
import { InAppToast, type ToastModel } from "./InAppToast";
import { playNotificationSound } from "../lib/notificationSound";

export const CHAT_OPEN_EVENT = "destinaph.chat.open";

type OpenPayload = { businessId: string };

type HeaderBiz = { id: string; name: string | null; business_photos?: { storage_path: string; sort_order?: number | null }[] | null };

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [biz, setBiz] = useState<HeaderBiz | null>(null);
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [toast, setToast] = useState<ToastModel | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSeenMsgRef = useRef<string | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const loadBiz = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from("businesses")
      .select("id,name,business_photos(storage_path,sort_order)")
      .eq("id", bid)
      .maybeSingle();
    setBiz((data as any) ?? null);
  }, []);

  const openChat = useCallback(async (bid: string) => {
    setBusinessId(bid);
    setOpen(true);
    setMinimized(false);
    await loadBiz(bid);
    const conv = await getOrCreateConversation(bid);
    if ("error" in conv) {
      setToast({ title: "Messages", body: conv.error });
      return;
    }
    setConversationId(conv.id);
  }, [loadBiz]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(CHAT_OPEN_EVENT, (payload: OpenPayload) => {
      const bid = (payload?.businessId ?? "").trim();
      if (!bid) return;
      void openChat(bid);
    });
    return () => sub.remove();
  }, [openChat]);

  const refreshMessages = useCallback(async (cid: string) => {
    const out = await listMessages(cid);
    if ("error" in out) return;
    setRows(out.rows);
  }, []);

  useEffect(() => {
    const cid = conversationId;
    if (!cid) return;
    void refreshMessages(cid);
  }, [conversationId, refreshMessages]);

  useEffect(() => {
    const cid = conversationId;
    if (!cid) return;

    if (subRef.current) {
      void supabase.removeChannel(subRef.current);
      subRef.current = null;
    }

    const ch = supabase
      .channel(`destinaph-chat-${cid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
        async (payload) => {
          const msg = payload.new as MessageRow;
          setRows((prev) => [...prev, msg]);

          const { data: session } = await supabase.auth.getSession();
          const uid = session.session?.user.id ?? null;
          if (uid && msg.sender_profile_id !== uid) {
            playNotificationSound();
            setToast({ title: biz?.name ?? "New message", body: msg.text?.trim() ? msg.text.trim() : "Sent an image" });
          }
        },
      )
      .subscribe();

    subRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      subRef.current = null;
    };
  }, [conversationId, biz?.name]);

  useEffect(() => {
    // Resolve signed URLs for images in view.
    const need = rows.filter((m) => m.image_storage_path && !imgUrls[m.id]).slice(-8);
    if (!need.length) return;
    void (async () => {
      const entries = await Promise.all(
        need.map(async (m) => {
          const url = await getChatImageUrl(m.image_storage_path!);
          return url ? ([m.id, url] as const) : null;
        }),
      );
      const next: Record<string, string> = {};
      for (const e of entries) {
        if (e) next[e[0]] = e[1];
      }
      if (Object.keys(next).length) setImgUrls((prev) => ({ ...prev, ...next }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const send = useCallback(async () => {
    const cid = conversationId;
    if (!cid) return;
    const t = text;
    setText("");
    const out = await sendTextMessage(cid, t);
    if ("error" in out) setToast({ title: "Messages", body: out.error });
  }, [conversationId, text]);

  const sendImage = useCallback(async () => {
    const cid = conversationId;
    if (!cid) return;
    const picked = await pickChatImage();
    if ("cancelled" in picked) return;
    if ("error" in picked) {
      setToast({ title: "Messages", body: picked.error });
      return;
    }
    const up = await uploadChatImage(picked.uri);
    if ("error" in up) {
      setToast({ title: "Messages", body: up.error });
      return;
    }
    const out = await sendImageMessage(cid, up.path);
    if ("error" in out) setToast({ title: "Messages", body: out.error });
  }, [conversationId]);

  const thumbUrl = useMemo(() => firstPhotoPublicUrl(biz?.business_photos as any), [biz?.business_photos]);

  if (!open && !minimized) return <InAppToast toast={toast} onDismiss={dismissToast} />;

  return (
    <>
      <InAppToast toast={toast} onDismiss={dismissToast} />

      {minimized && biz ? (
        <Pressable
          style={styles.bubble}
          onPress={() => {
            setOpen(true);
            setMinimized(false);
          }}
        >
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.bubbleImg} />
          ) : (
            <View style={styles.bubbleImgPh}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            </View>
          )}
        </Pressable>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={styles.modal}>
            <View style={styles.head}>
              <Text style={styles.headTitle} numberOfLines={1}>{biz?.name ?? "Messages"}</Text>
              <View style={styles.headBtns}>
                <Pressable
                  style={styles.headBtn}
                  onPress={() => {
                    setOpen(false);
                    setMinimized(true);
                  }}
                >
                  <Ionicons name="remove" size={18} color={colors.navy} />
                </Pressable>
                <Pressable style={styles.headBtn} onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={20} color={colors.navy} />
                </Pressable>
              </View>
            </View>

            <View style={styles.body}>
              {rows.slice(-30).map((m) => (
                <View key={m.id} style={styles.msgRow}>
                  {m.text?.trim() ? <Text style={styles.msgText}>{m.text.trim()}</Text> : null}
                  {m.image_storage_path ? (
                    imgUrls[m.id] ? (
                      <Image source={{ uri: imgUrls[m.id] }} style={styles.msgImg} />
                    ) : (
                      <Text style={styles.msgMeta}>Image…</Text>
                    )
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.foot}>
              <Pressable style={styles.iconBtn} onPress={() => void sendImage()}>
                <Ionicons name="image-outline" size={20} color={colors.primaryTealDeep} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor={colors.muted2}
                style={styles.input}
              />
              <Pressable style={styles.sendBtn} onPress={() => void send()}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalWrap: { flex: 1, justifyContent: "flex-end", padding: 14 },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadowCompat({ opacity: 0.12, radius: 18, offsetY: 10, elevation: 10 }),
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headTitle: { fontSize: 15, fontWeight: "800", color: colors.navy, flex: 1, paddingRight: 10 },
  headBtns: { flexDirection: "row", gap: 8 },
  headBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.06)", alignItems: "center", justifyContent: "center" },
  body: { maxHeight: 360, padding: 12, gap: 10 },
  msgRow: { gap: 6 },
  msgText: { fontSize: 14, color: colors.text, fontWeight: "600" },
  msgMeta: { fontSize: 12.5, color: colors.muted2, fontWeight: "600" },
  msgImg: { width: "100%", height: 180, borderRadius: 14, backgroundColor: colors.pageBg },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,120,126,0.08)" },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, fontWeight: "600" },
  sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryTeal, alignItems: "center", justifyContent: "center" },

  bubble: {
    position: "absolute",
    right: 14,
    bottom: 110,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primaryTeal,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    ...shadowCompat({ opacity: 0.22, radius: 14, offsetY: 10, elevation: 12 }),
  },
  bubbleImg: { width: "100%", height: "100%" },
  bubbleImgPh: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
});

