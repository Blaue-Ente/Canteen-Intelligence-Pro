import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { AppState, NotificationPrefs } from "@/types";

const CHANNEL_ID = "kitchenos-default";

export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "KItchenOS",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 200, 200],
  });
}

function parseHHmm(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map((x) => Number(x.trim()) || 0);
  return { hour: Math.max(0, Math.min(23, h ?? 0)), minute: Math.max(0, Math.min(59, m ?? 0)) };
}

async function cancelAll(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleAll(prefs: NotificationPrefs, state: AppState): Promise<void> {
  if (Platform.OS === "web") return;
  await ensureChannel();
  await cancelAll();
  if (!prefs.enabled) return;

  const locale = state.locale;
  const T = (de: string, en: string) => (locale === "de" ? de : en);

  if (prefs.tagesabschluss) {
    const t = parseHHmm(prefs.tagesabschlussTime);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: T("Tagesabschluss fällig", "Daily close due"),
        body: T(
          "Bitte heute Gekocht/Verkauft eintragen.",
          "Please log today's cooked/sold figures.",
        ),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: t.hour,
        minute: t.minute,
        repeats: true,
        channelId: CHANNEL_ID,
      },
    });
  }

  if (prefs.haccpReminder) {
    const t = parseHHmm(prefs.haccpTime);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: T("HACCP-Kontrolle", "HACCP check"),
        body: T(
          "Kühlung, Tiefkühler und Wareneingang heute prüfen.",
          "Check fridges, freezer and goods receipt today.",
        ),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: t.hour,
        minute: t.minute,
        repeats: true,
        channelId: CHANNEL_ID,
      },
    });
  }

  if (prefs.lowStock) {
    const lows = state.inventory.filter((i) => i.quantity < i.minQuantity);
    if (lows.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: T(`Knapper Bestand: ${lows.length} Artikel`, `Low stock: ${lows.length} items`),
          body: lows
            .slice(0, 3)
            .map((i) => (locale === "de" ? i.nameDe : i.name))
            .join(", "),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 9,
          minute: 0,
          repeats: true,
          channelId: CHANNEL_ID,
        },
      });
    }
  }

  if (prefs.expiring) {
    const soon = state.inventory.filter((i) => {
      if (!i.expiresAt) return false;
      const days = (new Date(i.expiresAt).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 2;
    });
    if (soon.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: T(`${soon.length} Artikel laufen bald ab`, `${soon.length} items expiring soon`),
          body: soon
            .slice(0, 3)
            .map((i) => (locale === "de" ? i.nameDe : i.name))
            .join(", "),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 9,
          minute: 30,
          repeats: true,
          channelId: CHANNEL_ID,
        },
      });
    }
  }
}

export async function disableAll(): Promise<void> {
  await cancelAll();
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
