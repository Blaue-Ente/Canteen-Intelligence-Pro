import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  publishedMenusTable,
  guestOrdersTable,
  guestFeedbackTable,
  memberships,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { schemas } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { randomBytes } from "crypto";

const router: IRouter = Router();

function serializeMenu(row: typeof publishedMenusTable.$inferSelect) {
  return {
    locationCode: row.locationCode,
    locationName: row.locationName,
    currency: row.currency,
    dishes: row.dishes,
    publishedAt: row.publishedAt.toISOString(),
  };
}

function serializeOrder(
  row: typeof guestOrdersTable.$inferSelect,
  opts: { includeToken: boolean },
) {
  return {
    id: row.id,
    locationCode: row.locationCode,
    guestName: row.guestName,
    guestNote: row.guestNote,
    items: row.items,
    total: Number(row.total),
    currency: row.currency,
    status: row.status,
    accessToken: opts.includeToken ? row.accessToken : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function userOrgIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return rows.map((r) => r.orgId);
}

// GET /preorder/menu/:locationCode (public)
router.get("/preorder/menu/:locationCode", async (req: Request, res: Response) => {
  const code = String(req.params.locationCode).trim();
  if (!code) {
    res.status(400).json({ error: "locationCode required" });
    return;
  }
  const rows = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, code))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(serializeMenu(rows[0]!));
});

// POST /preorder/menu/publish (auth — staff)
router.post("/preorder/menu/publish", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = schemas.PublishMenuBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgIds = await userOrgIds(userId);
  if (orgIds.length === 0) {
    res.status(403).json({ error: "No organisation membership" });
    return;
  }
  const body = parsed.data;
  const code = body.locationCode.trim();
  const existing = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, code))
    .limit(1);
  if (existing.length > 0 && existing[0]!.ownerOrgId && !orgIds.includes(existing[0]!.ownerOrgId)) {
    res.status(403).json({ error: "Location owned by another organisation" });
    return;
  }
  const ownerOrgId = existing[0]?.ownerOrgId ?? orgIds[0]!;
  const values = {
    locationCode: code,
    locationName: body.locationName,
    currency: body.currency ?? "EUR",
    dishes: body.dishes,
    publishedAt: new Date(),
    ownerOrgId,
  };
  await db
    .insert(publishedMenusTable)
    .values(values)
    .onConflictDoUpdate({
      target: publishedMenusTable.locationCode,
      set: {
        locationName: values.locationName,
        currency: values.currency,
        dishes: values.dishes,
        publishedAt: values.publishedAt,
        ownerOrgId: values.ownerOrgId,
      },
    });
  const finalRow = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, code))
    .limit(1);
  res.json(serializeMenu(finalRow[0]!));
});

// POST /preorder/orders (public)
router.post("/preorder/orders", async (req: Request, res: Response) => {
  const parsed = schemas.CreateGuestOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  if (body.items.length === 0) {
    res.status(400).json({ error: "Order has no items" });
    return;
  }
  const menuRows = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, body.locationCode))
    .limit(1);
  if (menuRows.length === 0) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  const menu = menuRows[0]!;
  // Resolve every line item against the published menu — never trust client price/name.
  const dishById = new Map(menu.dishes.map((d) => [d.id, d]));
  const resolvedItems: Array<{ dishId: string; name: string; qty: number; price: number }> = [];
  for (const it of body.items) {
    const dish = dishById.get(it.dishId);
    if (!dish) {
      res.status(400).json({ error: `Unknown dish: ${it.dishId}` });
      return;
    }
    const qty = Math.floor(it.qty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      res.status(400).json({ error: `Invalid quantity for ${dish.name}` });
      return;
    }
    resolvedItems.push({
      dishId: dish.id,
      name: dish.name,
      qty,
      price: Number(dish.price),
    });
  }
  const total = resolvedItems.reduce((s, it) => s + it.qty * it.price, 0);
  const accessToken = randomBytes(16).toString("hex");
  const inserted = await db
    .insert(guestOrdersTable)
    .values({
      locationCode: body.locationCode,
      ownerOrgId: menu.ownerOrgId,
      guestName: body.guestName,
      guestNote: body.guestNote ?? null,
      items: resolvedItems,
      total: total.toFixed(2),
      currency: menu.currency,
      status: "new",
      accessToken,
    })
    .returning();
  res.status(201).json(serializeOrder(inserted[0]!, { includeToken: true }));
});

// GET /preorder/orders/:id?token=... (public — token-gated)
router.get("/preorder/orders/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(401).json({ error: "token required" });
    return;
  }
  const rows = await db
    .select()
    .from(guestOrdersTable)
    .where(and(eq(guestOrdersTable.id, id), eq(guestOrdersTable.accessToken, token)))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(serializeOrder(rows[0]!, { includeToken: false }));
});

// PATCH /preorder/orders/:id/status (auth — staff)
router.patch("/preorder/orders/:id/status", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = String(req.params.id);
  const parsed = schemas.UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orgIds = await userOrgIds(userId);
  const orderRows = await db
    .select()
    .from(guestOrdersTable)
    .where(eq(guestOrdersTable.id, id))
    .limit(1);
  if (orderRows.length === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!orgIds.includes(orderRows[0]!.ownerOrgId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const updated = await db
    .update(guestOrdersTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(guestOrdersTable.id, id))
    .returning();
  res.json(serializeOrder(updated[0]!, { includeToken: false }));
});

// GET /preorder/staff/orders?locationCode=... (auth — staff)
router.get("/preorder/staff/orders", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const code = String(req.query.locationCode ?? "").trim();
  if (!code) {
    res.status(400).json({ error: "locationCode required" });
    return;
  }
  const orgIds = await userOrgIds(userId);
  if (orgIds.length === 0) {
    res.status(403).json({ error: "No organisation membership" });
    return;
  }
  const orders = await db
    .select()
    .from(guestOrdersTable)
    .where(
      and(
        eq(guestOrdersTable.locationCode, code),
        inArray(guestOrdersTable.ownerOrgId, orgIds),
        inArray(guestOrdersTable.status, ["new", "accepted", "preparing", "ready"]),
        ne(guestOrdersTable.status, "served"),
      ),
    )
    .orderBy(desc(guestOrdersTable.createdAt))
    .limit(100);
  res.json(orders.map((o) => serializeOrder(o, { includeToken: false })));
});

// Tiny in-memory rate limit (per-IP) for unauthenticated feedback submissions.
const FEEDBACK_RL_WINDOW_MS = 60_000;
const FEEDBACK_RL_MAX = 5;
const feedbackHits = new Map<string, number[]>();

function feedbackRateLimit(req: Request, res: Response): boolean {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const arr = (feedbackHits.get(ip) ?? []).filter((t) => now - t < FEEDBACK_RL_WINDOW_MS);
  if (arr.length >= FEEDBACK_RL_MAX) {
    res.status(429).json({ error: "Too many feedback submissions, please slow down." });
    return false;
  }
  arr.push(now);
  feedbackHits.set(ip, arr);
  // Opportunistic GC to prevent unbounded growth.
  if (feedbackHits.size > 5000) {
    for (const [k, v] of feedbackHits) {
      const fresh = v.filter((t) => now - t < FEEDBACK_RL_WINDOW_MS);
      if (fresh.length === 0) feedbackHits.delete(k);
      else feedbackHits.set(k, fresh);
    }
  }
  return true;
}

// POST /preorder/feedback (public)
router.post("/preorder/feedback", async (req: Request, res: Response) => {
  if (!feedbackRateLimit(req, res)) return;
  const parsed = schemas.CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const menuRows = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, body.locationCode))
    .limit(1);
  if (menuRows.length === 0) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  const r = body.ratings;
  const overall = Math.round(
    (r.foodQuality + r.service + r.variety + r.value + r.cleanliness + r.ambience) / 6,
  );
  const inserted = await db
    .insert(guestFeedbackTable)
    .values({
      locationCode: body.locationCode,
      ownerOrgId: menuRows[0]!.ownerOrgId,
      ratings: r,
      overall,
      comment: body.comment ?? null,
      guestName: body.guestName ?? null,
    })
    .returning();
  const row = inserted[0]!;
  res.status(201).json({
    id: row.id,
    locationCode: row.locationCode,
    ratings: row.ratings,
    overall: row.overall,
    comment: row.comment,
    guestName: row.guestName,
    createdAt: row.createdAt.toISOString(),
  });
});

// GET /preorder/staff/feedback?locationCode=&days= (auth)
router.get("/preorder/staff/feedback", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const code = String(req.query.locationCode ?? "").trim();
  const days = Math.max(1, Math.min(365, Number(req.query.days ?? 30)));
  if (!code) {
    res.status(400).json({ error: "locationCode required" });
    return;
  }
  const orgIds = await userOrgIds(userId);
  if (orgIds.length === 0) {
    res.status(403).json({ error: "No organisation membership" });
    return;
  }
  const since = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select()
    .from(guestFeedbackTable)
    .where(
      and(
        eq(guestFeedbackTable.locationCode, code),
        inArray(guestFeedbackTable.ownerOrgId, orgIds),
        gte(guestFeedbackTable.createdAt, since),
      ),
    )
    .orderBy(desc(guestFeedbackTable.createdAt))
    .limit(100);

  let agg = {
    count: 0,
    avgFoodQuality: 0,
    avgService: 0,
    avgVariety: 0,
    avgValue: 0,
    avgCleanliness: 0,
    avgAmbience: 0,
    avgOverall: 0,
  };
  if (rows.length > 0) {
    const s = rows.reduce(
      (acc, f) => {
        acc.foodQuality += f.ratings.foodQuality;
        acc.service += f.ratings.service;
        acc.variety += f.ratings.variety;
        acc.value += f.ratings.value;
        acc.cleanliness += f.ratings.cleanliness;
        acc.ambience += f.ratings.ambience;
        acc.overall += f.overall;
        return acc;
      },
      { foodQuality: 0, service: 0, variety: 0, value: 0, cleanliness: 0, ambience: 0, overall: 0 },
    );
    const n = rows.length;
    const r2 = (x: number) => Math.round((x / n) * 100) / 100;
    agg = {
      count: n,
      avgFoodQuality: r2(s.foodQuality),
      avgService: r2(s.service),
      avgVariety: r2(s.variety),
      avgValue: r2(s.value),
      avgCleanliness: r2(s.cleanliness),
      avgAmbience: r2(s.ambience),
      avgOverall: r2(s.overall),
    };
  }

  res.json({
    aggregate: agg,
    recent: rows.map((row) => ({
      id: row.id,
      locationCode: row.locationCode,
      ratings: row.ratings,
      overall: row.overall,
      comment: row.comment,
      guestName: row.guestName,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

export default router;
