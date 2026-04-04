"use client";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function scheduleLocalReminder(title: string, body: string, delayMs: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  setTimeout(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
      });
    } else {
      new Notification(title, { body, icon: "/logo.png" });
    }
  }, delayMs);
}

export function sendStudyReminder() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  new Notification("Time to study!", {
    body: "Lil' Bit misses you. Keep your streak alive!",
    icon: "/logo.png",
    tag: "daily-reminder",
  });
}
