import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  publishedMenusTable,
  guestOrdersTable,
  guestFeedbackTable,
  customerProfilesTable,
  memberships,
  type CustomerAccountType,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { schemas } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { randomBytes } from "crypto";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

const CUTOFF_TZ = "Europe/Berlin";
const CUTOFF_HOUR = 8;

// Today's date in CUTOFF_TZ as YYYY-MM-DD.
function todayLocal(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CUTOFF_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

// Returns the UTC instant corresponding to CUTOFF_HOUR local time on the given YYYY-MM-DD date.
// Algorithm: start with a naive UTC instant at CUTOFF_HOUR, ask Intl what hour that is in
// CUTOFF_TZ, then shift by the difference. Iterate once more to settle DST edge cases.
function cutoffInstantFor(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CUTOFF_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  // localPartsAt(utcMs) → {y,m,d,h,min} as seen in CUTOFF_TZ
  const localPartsAt = (utcMs: number) => {
    const parts = fmt.formatToParts(new Date(utcMs));
    const get = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? "0");
    let hh = get("hour");
    if (hh === 24) hh = 0; // some ICU return "24" instead of "00"
    return {
      y: get("year"),
      m: get("month"),
      d: get("day"),
      h: hh,
      min: get("minute"),
    };
  };
  // Difference (in minutes) between target local 08:00 on dateISO and the local time at utcMs.
  const targetMinutes = CUTOFF_HOUR * 60;
  const dayKey = (p: { y: number; m: number; d: number }) =>
    p.y * 10000 + p.m * 100 + p.d;
  const targetKey = y * 10000 + m * 100 + d;

  // Initial guess: naive UTC at CUTOFF_HOUR (will be 1–2h off due to TZ offset).
  let utcMs = Date.UTC(y, m - 1, d, CUTOFF_HOUR, 0, 0);
  for (let i = 0; i < 3; i++) {
    const p = localPartsAt(utcMs);
    const dayDiff = dayKey(p) - targetKey; // ±1 if we crossed a day boundary
    const delta =
      targetMinutes - (p.h * 60 + p.min) - dayDiff * 24 * 60;
    if (delta === 0) break;
    utcMs += delta * 60 * 1000;
  }
  return new Date(utcMs);
}

// Returns YYYY-MM-DD for the given instant in CUTOFF_TZ.
function localDateForInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CUTOFF_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function orderDayLocal(row: typeof guestOrdersTable.$inferSelect): string {
  return (row.wantedFor as string | null) ?? localDateForInstant(row.createdAt);
}

function isOrderEditable(row: typeof guestOrdersTable.$inferSelect): boolean {
  if (row.status === "served" || row.status === "cancelled") return false;
  return Date.now() < cutoffInstantFor(orderDayLocal(row)).getTime();
}

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
    customerId: row.customerId ?? null,
    wantedFor: (row.wantedFor as string | null) ?? null,
    items: row.items,
    total: Number(row.total),
    currency: row.currency,
    status: row.status,
    accessToken: opts.includeToken ? row.accessToken : null,
    editable: isOrderEditable(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProfile(row: typeof customerProfilesTable.$inferSelect) {
  return {
    clerkUserId: row.clerkUserId,
    displayName: row.displayName,
    email: row.email,
    homeLocationCode: row.homeLocationCode,
    accountType: row.accountType as CustomerAccountType,
    ownerOrgId: row.ownerOrgId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadProfile(userId: string) {
  const rows = await db
    .select()
    .from(customerProfilesTable)
    .where(eq(customerProfilesTable.clerkUserId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function ensureProfile(userId: string) {
  const existing = await loadProfile(userId);
  if (existing) return existing;
  let displayName = "Guest";
  let email: string | null = null;
  try {
    const u = await clerkClient.users.getUser(userId);
    const fn = (u.firstName ?? "").trim();
    const ln = (u.lastName ?? "").trim();
    displayName = [fn, ln].filter(Boolean).join(" ") || u.username || "Guest";
    email = u.primaryEmailAddress?.emailAddress ?? null;
  } catch {
    // best-effort; defaults are fine
  }
  const inserted = await db
    .insert(customerProfilesTable)
    .values({ clerkUserId: userId, displayName, email, accountType: "regular" })
    .onConflictDoNothing()
    .returning();
  return inserted[0] ?? (await loadProfile(userId))!;
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

// POST /preorder/orders (auth — approved business customers only)
router.post("/preorder/orders", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
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
  const profile = await ensureProfile(userId);
  if (profile.accountType !== "business_approved") {
    res.status(403).json({
      error: "Only approved business accounts can place orders.",
      accountType: profile.accountType,
    });
    return;
  }
  const wantedFor = body.wantedFor && /^\d{4}-\d{2}-\d{2}$/.test(body.wantedFor)
    ? body.wantedFor
    : todayLocal();
  if (Date.now() >= cutoffInstantFor(wantedFor).getTime()) {
    res.status(409).json({ error: "Cutoff (08:00) for this day has already passed.", wantedFor });
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
      customerId: userId,
      wantedFor,
      guestName: profile.displayName || body.guestName,
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

// ----- Customer self-service -----

// GET /preorder/customer/me — auth (creates default 'regular' profile if missing)
router.get("/preorder/customer/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const row = await ensureProfile(userId);
  res.json(serializeProfile(row));
});

// PATCH /preorder/customer/me — auth, update profile + optionally request business
router.patch("/preorder/customer/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = schemas.UpsertCustomerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  await ensureProfile(userId);
  const existing = (await loadProfile(userId))!;
  const next: Partial<typeof customerProfilesTable.$inferInsert> = {
    displayName: body.displayName.trim().slice(0, 80) || existing.displayName,
    email: body.email ?? existing.email,
    homeLocationCode: body.homeLocationCode ?? existing.homeLocationCode,
    updatedAt: new Date(),
  };
  if (body.requestBusiness && existing.accountType === "regular") {
    next.accountType = "business_pending";
  }
  const updated = await db
    .update(customerProfilesTable)
    .set(next)
    .where(eq(customerProfilesTable.clerkUserId, userId))
    .returning();
  res.json(serializeProfile(updated[0]!));
});

// GET /preorder/customer/orders — auth
router.get("/preorder/customer/orders", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(guestOrdersTable)
    .where(eq(guestOrdersTable.customerId, userId))
    .orderBy(desc(guestOrdersTable.createdAt))
    .limit(50);
  res.json(rows.map((r) => serializeOrder(r, { includeToken: false })));
});

// PATCH /preorder/orders/:id/items — auth, customer edits own order before cutoff
router.patch("/preorder/orders/:id/items", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = String(req.params.id);
  const parsed = schemas.UpdateOrderItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orderRows = await db
    .select()
    .from(guestOrdersTable)
    .where(eq(guestOrdersTable.id, id))
    .limit(1);
  if (orderRows.length === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const row = orderRows[0]!;
  if (row.customerId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isOrderEditable(row)) {
    res.status(409).json({ error: "Cutoff (08:00) for this day has already passed." });
    return;
  }
  const menuRows = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, row.locationCode))
    .limit(1);
  if (menuRows.length === 0) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  const menu = menuRows[0]!;
  const dishById = new Map(menu.dishes.map((d) => [d.id, d]));
  const resolvedItems: Array<{ dishId: string; name: string; qty: number; price: number }> = [];
  for (const it of parsed.data.items) {
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
    resolvedItems.push({ dishId: dish.id, name: dish.name, qty, price: Number(dish.price) });
  }
  if (resolvedItems.length === 0) {
    res.status(400).json({ error: "Order has no items" });
    return;
  }
  const total = resolvedItems.reduce((s, it) => s + it.qty * it.price, 0);
  const updated = await db
    .update(guestOrdersTable)
    .set({
      items: resolvedItems,
      total: total.toFixed(2),
      guestNote: parsed.data.guestNote ?? row.guestNote,
      updatedAt: new Date(),
    })
    .where(eq(guestOrdersTable.id, id))
    .returning();
  res.json(serializeOrder(updated[0]!, { includeToken: false }));
});

// POST /preorder/orders/:id/cancel — auth, customer cancels before cutoff
router.post("/preorder/orders/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const id = String(req.params.id);
  const orderRows = await db
    .select()
    .from(guestOrdersTable)
    .where(eq(guestOrdersTable.id, id))
    .limit(1);
  if (orderRows.length === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const row = orderRows[0]!;
  if (row.customerId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isOrderEditable(row)) {
    res.status(409).json({ error: "Cutoff (08:00) for this day has already passed." });
    return;
  }
  const updated = await db
    .update(guestOrdersTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(guestOrdersTable.id, id))
    .returning();
  res.json(serializeOrder(updated[0]!, { includeToken: false }));
});

// ----- Staff customer-management -----

// GET /preorder/staff/customers?status= — auth
router.get("/preorder/staff/customers", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const status = req.query.status ? String(req.query.status) : null;
  const orgIds = await userOrgIds(userId);
  if (orgIds.length === 0) {
    res.status(403).json({ error: "No organisation membership" });
    return;
  }
  // Locations under caller's orgs.
  const locs = await db
    .select({ code: publishedMenusTable.locationCode })
    .from(publishedMenusTable)
    .where(inArray(publishedMenusTable.ownerOrgId, orgIds));
  const codes = locs.map((l) => l.code);
  const rows = await db.select().from(customerProfilesTable);
  const filtered = rows.filter((r) => {
    // Only show customers scoped to caller's locations / orgs:
    //   - home_location_code is one of caller's published locations, OR
    //   - already approved/owned by one of caller's orgs.
    // Pending customers without a home location are NOT visible to anyone (must
    // pick a home canteen first), preventing cross-tenant PII exposure.
    const matchesHome =
      !!r.homeLocationCode && codes.includes(r.homeLocationCode);
    const matchesOrg = !!r.ownerOrgId && orgIds.includes(r.ownerOrgId);
    if (!matchesHome && !matchesOrg) return false;
    if (status && r.accountType !== status) return false;
    return true;
  });
  res.json(filtered.map(serializeProfile));
});

// PATCH /preorder/staff/customers/:clerkUserId — auth (approve/reject)
router.patch(
  "/preorder/staff/customers/:clerkUserId",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const targetId = String(req.params.clerkUserId);
    const parsed = schemas.DecideStaffCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const orgIds = await userOrgIds(userId);
    if (orgIds.length === 0) {
      res.status(403).json({ error: "No organisation membership" });
      return;
    }
    const row = await loadProfile(targetId);
    if (!row) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (row.accountType !== "business_pending") {
      res.status(409).json({ error: "Customer is not pending approval." });
      return;
    }
    // Authorisation: customer must belong to caller's scope — either already
    // owned by one of caller's orgs, or their home_location_code must be a
    // location published by one of caller's orgs. Pending customers without a
    // home location cannot be approved by anyone (forces them to set one).
    const callerLocs = await db
      .select({ code: publishedMenusTable.locationCode })
      .from(publishedMenusTable)
      .where(inArray(publishedMenusTable.ownerOrgId, orgIds));
    const callerCodes = callerLocs.map((l) => l.code);
    const matchesHome =
      !!row.homeLocationCode && callerCodes.includes(row.homeLocationCode);
    const matchesOrg = !!row.ownerOrgId && orgIds.includes(row.ownerOrgId);
    if (!matchesHome && !matchesOrg) {
      res
        .status(403)
        .json({ error: "Customer is not in your organisation's scope." });
      return;
    }
    // Resolve approving org: prefer the org that owns the home location
    // (deterministic when caller is in multiple orgs); fall back to caller's
    // first org id.
    let approvingOrg: string | null = row.ownerOrgId ?? null;
    if (parsed.data.decision === "approve") {
      if (row.homeLocationCode) {
        const ownerRow = await db
          .select({ ownerOrgId: publishedMenusTable.ownerOrgId })
          .from(publishedMenusTable)
          .where(eq(publishedMenusTable.locationCode, row.homeLocationCode))
          .limit(1);
        if (
          ownerRow.length > 0 &&
          orgIds.includes(ownerRow[0]!.ownerOrgId)
        ) {
          approvingOrg = ownerRow[0]!.ownerOrgId;
        }
      }
      if (!approvingOrg) approvingOrg = orgIds[0]!;
    }
    const nextType: CustomerAccountType =
      parsed.data.decision === "approve" ? "business_approved" : "rejected";
    const updated = await db
      .update(customerProfilesTable)
      .set({
        accountType: nextType,
        ownerOrgId: approvingOrg,
        updatedAt: new Date(),
      })
      .where(eq(customerProfilesTable.clerkUserId, targetId))
      .returning();
    res.json(serializeProfile(updated[0]!));
  },
);

// GET /preorder/staff/orders/aggregate?locationCode=&date= — auth
router.get(
  "/preorder/staff/orders/aggregate",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const code = String(req.query.locationCode ?? "").trim();
    const date = String(req.query.date ?? "").trim() || todayLocal();
    if (!code) {
      res.status(400).json({ error: "locationCode required" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD" });
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
          ne(guestOrdersTable.status, "cancelled"),
        ),
      );
    const filtered = orders.filter((o) => orderDayLocal(o) === date);
    const currency = orders[0]?.currency ?? "EUR";
    const byCustomerMap = new Map<
      string,
      {
        customerName: string;
        customerId: string | null;
        items: Map<string, { dishId: string; name: string; qty: number }>;
        total: number;
        orderIds: string[];
      }
    >();
    const totalsByDishMap = new Map<string, { dishId: string; name: string; qty: number }>();
    let grandTotal = 0;
    for (const o of filtered) {
      const key = o.customerId ?? `guest:${o.guestName.toLowerCase()}`;
      let bucket = byCustomerMap.get(key);
      if (!bucket) {
        bucket = {
          customerName: o.guestName,
          customerId: o.customerId ?? null,
          items: new Map(),
          total: 0,
          orderIds: [],
        };
        byCustomerMap.set(key, bucket);
      }
      bucket.orderIds.push(o.id);
      bucket.total += Number(o.total);
      grandTotal += Number(o.total);
      for (const it of o.items) {
        const cur = bucket.items.get(it.dishId);
        if (cur) cur.qty += it.qty;
        else bucket.items.set(it.dishId, { dishId: it.dishId, name: it.name, qty: it.qty });
        const tot = totalsByDishMap.get(it.dishId);
        if (tot) tot.qty += it.qty;
        else totalsByDishMap.set(it.dishId, { dishId: it.dishId, name: it.name, qty: it.qty });
      }
    }
    res.json({
      date,
      locationCode: code,
      currency,
      totalsByDish: Array.from(totalsByDishMap.values()).sort((a, b) => b.qty - a.qty),
      byCustomer: Array.from(byCustomerMap.values())
        .map((b) => ({
          customerName: b.customerName,
          customerId: b.customerId,
          items: Array.from(b.items.values()),
          total: Math.round(b.total * 100) / 100,
          orderIds: b.orderIds,
        }))
        .sort((a, b) => a.customerName.localeCompare(b.customerName)),
      grandTotal: Math.round(grandTotal * 100) / 100,
    });
  },
);

export default router;
