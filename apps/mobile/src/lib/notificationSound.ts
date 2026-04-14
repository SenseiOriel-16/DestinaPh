import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let loading: Promise<void> | null = null;

const SOUND_ASSET = require("../../../Notification.wav");

export async function playNotificationSound(): Promise<void> {
  try {
    if (!sound) {
      if (!loading) {
        loading = (async () => {
          const res = await Audio.Sound.createAsync(SOUND_ASSET, { volume: 1.0, shouldPlay: false });
          sound = res.sound;
          await sound.setIsLoopingAsync(false);
        })();
      }
      await loading;
    }
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // ignore sound errors
  }
}

export async function unloadNotificationSound(): Promise<void> {
  try {
    if (sound) {
      await sound.unloadAsync();
    }
  } finally {
    sound = null;
    loading = null;
  }
}

