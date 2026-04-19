import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

let player: AudioPlayer | null = null;
let loading: Promise<void> | null = null;

const SOUND_ASSET = require("../../../Notification.wav");

export async function playNotificationSound(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (!player) {
      if (!loading) {
        loading = (async () => {
          player = createAudioPlayer(SOUND_ASSET);
          player.volume = 1.0;
        })();
      }
      await loading;
    }
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // ignore sound errors
  }
}

export async function unloadNotificationSound(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (player) {
      player.remove();
    }
  } finally {
    player = null;
    loading = null;
  }
}
