import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  publishedMenusTable,
  guestOrdersTable,
  type PreorderDishRow,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const CAPABILITIES = [
  "kitchen",
  "horeca",
  "restaurant",
  "menu",
  "recipes",
  "inventory",
  "supplier-orders",
  "haccp",
  "pos",
  "catering",
  "staff-scheduling",
  "demand-forecast",
  "guest-portal",
] as const;

interface MeshBody {
  action?: string;
  payload?: Record<string, unknown> | null;
  from_service?: string;
}

type MeshResult<T> = { ok: true; result: T; error: null } | { ok: false; result: null; error: string };

function ok<T>(result: T): MeshResult<T> {
  return { ok: true, result, error: null };
}
function fail(error: string): MeshResult<never> {
  return { ok: false, result: null, error };
}

function meshAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.IYVERIS_MESH_KEY;
  const provided = req.headers["x-iyveris-mesh-key"];
  if (!expected) {
    res.status(503).json(fail("IYVERIS_MESH_KEY not configured on server"));
    return;
  }
  if (typeof provided !== "string" || provided !== expected) {
    res.status(401).json(fail("Invalid mesh key"));
    return;
  }
  next();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function handlePing() {
  return ok({ status: "active", service: "kitchenos" });
}

async function handleCapabilities() {
  return ok([...CAPABILITIES]);
}

async function handleGetMenu(payload: Record<string, unknown>) {
  const date = asString(payload.date) ?? todayIso();
  const category = asString(payload.category)?.toLowerCase();
  const locationCode = asString(payload.locationCode) ?? asString(payload.location_code);

  let menus: Array<{ locationCode: string; locationName: string; currency: string; dishes: PreorderDishRow[] }>;
  if (locationCode) {
    const rows = await db
      .select()
      .from(publishedMenusTable)
      .where(eq(publishedMenusTable.locationCode, locationCode))
      .limit(1);
    menus = rows.map((r) => ({
      locationCode: r.locationCode,
      locationName: r.locationName,
      currency: r.currency,
      dishes: r.dishes,
    }));
  } else {
    const rows = await db.select().from(publishedMenusTable).limit(50);
    menus = rows.map((r) => ({
      locationCode: r.locationCode,
      locationName: r.locationName,
      currency: r.currency,
      dishes: r.dishes,
    }));
  }

  const items = menus.flatMap((m) =>
    m.dishes
      .filter((d) => !category || (d.type ?? "").toLowerCase() === category)
      .map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? null,
        price: d.price,
        currency: m.currency,
        category: d.type ?? null,
        allergens: d.allergens,
        kcal: d.kcal ?? null,
        dge: d.dge ?? null,
        locationCode: m.locationCode,
        locationName: m.locationName,
      })),
  );

  return ok({ items, date, category: category ?? null, count: items.length });
}

async function handleGetInventory(payload: Record<string, unknown>) {
  // Inventory in KitchenOS lives client-side (mobile AsyncStorage per-org).
  // Return an honest, structured empty snapshot so callers can detect it.
  return ok({
    items: [] as Array<{ id: string; name: string; qty: number; unit: string; category?: string }>,
    low_stock: [] as Array<{ id: string; name: string; qty: number; unit: string }>,
    note: "Inventory is currently stored on each kitchen device (mobile app). Server-side snapshot not yet available via mesh.",
    filter: {
      category: asString(payload.category) ?? null,
      low_stock_only: asBool(payload.low_stock_only),
    },
  });
}

async function handleCreateOrder(payload: Record<string, unknown>) {
  const itemsRaw = payload.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return fail("payload.items[] required");
  }
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const guestName = asString(customer.name) ?? asString(payload.guest_name) ?? "Iyveris Mesh";
  const guestNote = asString(payload.notes) ?? null;
  const wantedFor = asString(payload.delivery_date) ?? todayIso();
  const locationCode =
    asString(payload.locationCode) ?? asString(payload.location_code);
  if (!locationCode) {
    return fail("payload.locationCode required");
  }

  const menuRows = await db
    .select()
    .from(publishedMenusTable)
    .where(eq(publishedMenusTable.locationCode, locationCode))
    .limit(1);
  if (menuRows.length === 0) {
    return fail(`Unknown location: ${locationCode}`);
  }
  const menu = menuRows[0]!;
  const dishById = new Map(menu.dishes.map((d) => [d.id, d]));

  const resolved: Array<{ dishId: string; name: string; qty: number; price: number }> = [];
  for (const raw of itemsRaw) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const dishId = asString(it.dishId) ?? asString(it.id);
    const qty = Math.floor(Number(it.qty ?? it.quantity ?? 1));
    if (!dishId) return fail("Each item needs dishId");
    const dish = dishById.get(dishId);
    if (!dish) return fail(`Unknown dish: ${dishId}`);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      return fail(`Invalid qty for ${dish.name}`);
    }
    resolved.push({ dishId, name: dish.name, qty, price: Number(dish.price) });
  }

  const total = resolved.reduce((s, it) => s + it.qty * it.price, 0);
  const accessToken = randomBytes(16).toString("hex");
  const inserted = await db
    .insert(guestOrdersTable)
    .values({
      locationCode,
      ownerOrgId: menu.ownerOrgId,
      customerId: null,
      wantedFor,
      guestName,
      guestNote,
      items: resolved,
      total: total.toFixed(2),
      currency: menu.currency,
      status: "new",
      accessToken,
    })
    .returning();
  const row = inserted[0]!;

  return ok({
    order_id: row.id,
    status: row.status,
    total: Number(row.total),
    currency: row.currency,
    locationCode,
    wantedFor,
    items: resolved,
    accessToken,
  });
}

async function handleGetSales(payload: Record<string, unknown>) {
  const dateFrom = asString(payload.date_from) ?? todayIso();
  const dateTo = asString(payload.date_to) ?? dateFrom;

  // We don't have a POS/sales table server-side yet, but we can derive a
  // realistic answer from guest_orders (pre-order revenue + covers + top items).
  const rows = await db
    .select()
    .from(guestOrdersTable)
    .where(
      and(
        gte(guestOrdersTable.wantedFor, dateFrom),
        lte(guestOrdersTable.wantedFor, dateTo),
      ),
    );

  let total_revenue = 0;
  let covers = 0;
  const itemTotals = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const r of rows) {
    total_revenue += Number(r.total);
    for (const it of r.items) {
      covers += it.qty;
      const cur = itemTotals.get(it.dishId) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      itemTotals.set(it.dishId, cur);
    }
  }
  const top_items = [...itemTotals.entries()]
    .map(([dishId, v]) => ({ dishId, name: v.name, qty: v.qty, revenue: Number(v.revenue.toFixed(2)) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return ok({
    date_from: dateFrom,
    date_to: dateTo,
    total_revenue: Number(total_revenue.toFixed(2)),
    covers,
    orders: rows.length,
    top_items,
    source: "preorder",
    note: "Aggregated from guest pre-orders. POS/cash-register sales live on the kitchen device and are not yet synced server-side.",
  });
}

async function handleGetHaccpLogs(payload: Record<string, unknown>) {
  // HACCP logs live in the mobile app's per-org AsyncStorage.
  return ok({
    logs: [] as Array<{ ts: string; zone: string; tempC: number }>,
    alerts: [] as Array<{ ts: string; zone: string; severity: string; message: string }>,
    zone: asString(payload.zone) ?? null,
    note: "HACCP logs are stored on the kitchen tablet. Server mesh snapshot not yet implemented.",
  });
}

async function handleAsk(payload: Record<string, unknown>) {
  const query = asString(payload.query) ?? asString(payload.question);
  if (!query) return fail("payload.query required");
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You are Kios, the assistant of KitchenOS — an AI kitchen-operations platform for German HoReCa (menus, inventory, HACCP, POS, catering, pre-orders). Answer concisely. Default language: German, switch to English if asked.",
        },
        { role: "user", content: query },
      ],
    });
    const answer = completion.choices[0]?.message?.content?.trim() ?? "";
    return ok({ answer, model: "gpt-5.4" });
  } catch (err) {
    return fail(`AI error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post("/iyveris", meshAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as MeshBody;
  const action = body.action;
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const fromService = body.from_service ?? "unknown";

  req.log.info({ action, fromService }, "iyveris mesh call");

  try {
    switch (action) {
      case "ping":
        res.json(await handlePing());
        return;
      case "capabilities":
        res.json(await handleCapabilities());
        return;
      case "get_menu":
        res.json(await handleGetMenu(payload));
        return;
      case "get_inventory":
        res.json(await handleGetInventory(payload));
        return;
      case "create_order":
        res.json(await handleCreateOrder(payload));
        return;
      case "get_sales":
        res.json(await handleGetSales(payload));
        return;
      case "get_haccp_logs":
        res.json(await handleGetHaccpLogs(payload));
        return;
      case "ask":
        res.json(await handleAsk(payload));
        return;
      default:
        res.json(fail(`Unknown action: ${action ?? "(missing)"}`));
        return;
    }
  } catch (err) {
    req.log.error({ err, action }, "iyveris handler error");
    res
      .status(500)
      .json(fail(`Handler error: ${err instanceof Error ? err.message : "unknown"}`));
  }
});

// Export for tests / future GET-introspection use
export const __iyverisInternal = { CAPABILITIES };

export default router;
