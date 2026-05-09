/**
 * Server-side push notification scheduler.
 * Runs every minute, checks subscriptions and sends time-based notifications.
 * Times are compared in Europe/Berlin timezone (target market).
 */
import cron from "node-cron";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
interface NotificationPrefs {
  enabled?: boolean;
  tagesabschluss?: boolean;
  tagesabschlussTime?: string;
  haccpReminder?: boolean;
  haccpTime?: string;
  ekoReminder?: boolean;
  ekoReminderTime?: string;
  lowStock?: boolean;
  expiring?: boolean;
  preorderAlert?: boolean;
  timeOffAlert?: boolean;
}

type SubRow = typeof pushSubscriptionsTable.$inferSelect;

function berlinHHmm(): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function send(sub: SubRow, title: string, body: string): Promise<void> {
  const payload = JSON.stringify({ title, body, icon: "/app/assets/images/icon.png", url: "/app/" });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
      payload,
    );
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e?.statusCode === 410) {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
    } else {
      logger.warn({ err }, "push scheduler: send failed");
    }
  }
}

// ─── Triggered push: new guest preorder arrived ───────────────────────────────
// Called from the preorder route immediately after a new order is inserted.
// Sends a push notification to all staff subscriptions in the same org that
// have preorderAlert enabled.
export async function triggerNewOrderPush(
  ownerOrgId: string,
  details: { guestName: string; itemCount: number; locationCode: string; locale?: string },
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  let subs: SubRow[];
  try {
    // Filter by orgId — only staff of the restaurant that owns this location
    subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.orgId, ownerOrgId));
  } catch (err) {
    logger.warn({ err }, "triggerNewOrderPush: db query failed");
    return;
  }

  const targets = subs.filter((s) => (s.prefs as Partial<NotificationPrefs>).preorderAlert);
  if (targets.length === 0) return;

  const { guestName, itemCount, locationCode } = details;
  for (const sub of targets) {
    const de = (sub.locale ?? "de") !== "en";
    const title = de ? "🛎 Neue Vorbestellung" : "🛎 New preorder";
    const body = de
      ? `${guestName} hat ${itemCount} Artikel bei ${locationCode} bestellt.`
      : `${guestName} ordered ${itemCount} item(s) at ${locationCode}.`;
    await send(sub, title, body);
  }
}

export function startPushScheduler(): void {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    logger.info("Push scheduler: VAPID keys not set, skipping.");
    return;
  }

  cron.schedule("* * * * *", async () => {
    const now = berlinHHmm();
    let subs: SubRow[];
    try {
      subs = await db.select().from(pushSubscriptionsTable);
    } catch {
      return;
    }

    for (const sub of subs) {
      const prefs = sub.prefs as Partial<NotificationPrefs>;
      if (!prefs.enabled) continue;
      const de = sub.locale !== "en";
      const T = (d: string, e: string) => (de ? d : e);

      if (prefs.tagesabschluss && prefs.tagesabschlussTime === now) {
        await send(sub, T("Tagesabschluss fällig", "Daily close due"), T("Bitte heute Gekocht/Verkauft eintragen.", "Please log today's figures."));
      }
      if (prefs.haccpReminder && prefs.haccpTime === now) {
        await send(sub, T("HACCP-Kontrolle", "HACCP check"), T("Kühlung, Tiefkühler und Wareneingang prüfen.", "Check fridges, freezer and goods receipt."));
      }
      if (prefs.ekoReminder && (prefs.ekoReminderTime ?? "10:00") === now) {
        await send(sub, T("🌿 Öko-Challenge heute?", "🌿 Eco challenge today?"), T("Erledige eine Nachhaltigkeits-Aufgabe.", "Complete a sustainability challenge."));
      }
      if (prefs.lowStock && now === "09:00") {
        await send(sub, T("Bestand prüfen", "Check stock"), T("Bitte Lagerbestand heute kontrollieren.", "Please check your stock levels today."));
      }
      if (prefs.expiring && now === "09:30") {
        await send(sub, T("MHD prüfen", "Check expiry dates"), T("Bitte Ablaufdaten im Lager prüfen.", "Please check expiry dates in stock."));
      }
    }
  });

  logger.info("Push scheduler started (Europe/Berlin timezone).");
}
