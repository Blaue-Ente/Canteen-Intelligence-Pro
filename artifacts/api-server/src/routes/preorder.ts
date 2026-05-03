import { Router, type IRouter, type Request, type Response } from "express";
import { db, publishedMenusTable, guestOrdersTable, memberships } from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
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

export default router;
