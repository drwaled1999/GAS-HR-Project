import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { apiFetch } from "./api";

let initialized = false;

export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    gain.connect(ctx.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(ctx.currentTime + index * 0.13);
      oscillator.stop(ctx.currentTime + 0.42 + index * 0.13);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {
    // The operating system may block sound before the first user interaction.
  }
}

export async function initializePushNotifications(onNotification) {
  if (initialized || !Capacitor.isNativePlatform()) return () => {};
  initialized = true;

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") return () => {};

  if (Capacitor.getPlatform() === "android") {
    await PushNotifications.createChannel({
      id: "gas_hr_notifications",
      name: "GAS HR Notifications",
      description: "Employee requests and HR updates",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    });
  }

  const handles = [];
  handles.push(await PushNotifications.addListener("registration", async ({ value }) => {
    localStorage.setItem("fcm_token", value);
    await apiFetch("/auth/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token: value }),
    });
  }));
  handles.push(await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    playNotificationSound();
    onNotification?.({
      title: notification.title || "GAS HR",
      message: notification.body || notification.data?.message || "You have a new notification",
      link: notification.data?.link || "/notifications",
    });
  }));
  handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const link = notification?.data?.link || "/notifications";
    window.location.assign(link);
  }));

  await PushNotifications.register();
  return () => handles.forEach((handle) => handle.remove());
}

export async function requestBrowserNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Browser permission prompts are optional; in-app alerts still work.
  }
}
