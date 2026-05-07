import { Router, type Request, type Response } from "express";
import webpush from "web-push";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

export function configureVapid(): void {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails("mailto:noreply@kitchenos.de", pub, priv);
  }
}

// POST /api/push/subscribe — save or update a push subscription
router.post("/push/subscribe", async (req: Request, res: Response) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) return void res.status(401).json({ error: "Unauthenticated" });

  const { endpoint, keys, prefs, locale } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    prefs: Record<string, unknown>;
    locale: string;
  };
  if (!endpoint || !keys) return void res.status(400).json({ error: "endpoint and keys required" });

  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, orgId: orgId ?? "", endpoint, keys, prefs: prefs ?? {}, locale: locale ?? "de" })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, orgId: orgId ?? "", keys, prefs: prefs ?? {}, locale: locale ?? "de", updatedAt: new Date() },
    });

  res.json({ ok: true });
});

// DELETE /api/push/subscribe — remove a subscription
router.delete("/push/subscribe", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return void res.status(401).json({ error: "Unauthenticated" });

  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) return void res.status(400).json({ error: "endpoint required" });

  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));

  res.json({ ok: true });
});

// PUT /api/push/prefs — update notification preferences for an existing subscription
router.put("/push/prefs", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return void res.status(401).json({ error: "Unauthenticated" });

  const { endpoint, prefs, locale } = req.body as {
    endpoint: string;
    prefs: Record<string, unknown>;
    locale: string;
  };
  if (!endpoint) return void res.status(400).json({ error: "endpoint required" });

  await db
    .update(pushSubscriptionsTable)
    .set({ prefs: prefs ?? {}, locale: locale ?? "de", updatedAt: new Date() })
    .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));

  res.json({ ok: true });
});

// POST /api/push/test — send a test push to all subscriptions of this user
router.post("/push/test", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return void res.status(401).json({ error: "Unauthenticated" });

  const { locale } = req.body as { locale?: string };
  const de = locale !== "en";
  const payload = JSON.stringify({
    title: de ? "KItchenOS Benachrichtigungen aktiv ✓" : "KItchenOS Notifications active ✓",
    body: de ? "Du erhältst hier deine Erinnerungen." : "You will receive reminders here.",
    icon: "/app/assets/images/icon.png",
    url: "/app/",
  });

  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } },
        payload,
      )
    )
  );

  // Remove expired subscriptions (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r && r.status === "rejected") {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, subs[i]!.id));
      } else {
        logger.warn({ err: r.reason }, "push send failed");
      }
    }
  }

  res.json({ sent: results.filter((r) => r.status === "fulfilled").length });
});

export { router as pushRouter };
