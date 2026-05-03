import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  publishedMenusTable,
  guestOrdersTable,
  guestFeedbackTable,
  memberships,
} from "@workspace/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const EMPTY_AGGREGATE = {
  count: 0,
  avgFoodQuality: 0,
  avgService: 0,
  avgVariety: 0,
  avgValue: 0,
  avgCleanliness: 0,
  avgAmbience: 0,
  avgOverall: 0,
};

router.get("/rollup/locations", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const days = Math.max(1, Math.min(90, Number(req.query.days ?? 7)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orgRows = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  const orgIds = orgRows.map((r) => r.orgId);
  if (orgIds.length === 0) {
    res.json([]);
    return;
  }

  const menus = await db
    .select()
    .from(publishedMenusTable)
    .where(inArray(publishedMenusTable.ownerOrgId, orgIds));

  const orders = await db
    .select()
    .from(guestOrdersTable)
    .where(
      and(
        inArray(guestOrdersTable.ownerOrgId, orgIds),
        gte(guestOrdersTable.createdAt, since),
      ),
    );

  const feedback = await db
    .select()
    .from(guestFeedbackTable)
    .where(
      and(
        inArray(guestFeedbackTable.ownerOrgId, orgIds),
        gte(guestFeedbackTable.createdAt, since),
      ),
    );

  // Aggregate per location_code (every menu becomes a row even if zero orders).
  const codes = new Set<string>([
    ...menus.map((m) => m.locationCode),
    ...orders.map((o) => o.locationCode),
    ...feedback.map((f) => f.locationCode),
  ]);

  const result = Array.from(codes).map((code) => {
    const menu = menus.find((m) => m.locationCode === code);
    const locOrders = orders.filter((o) => o.locationCode === code);
    const locFeedback = feedback.filter((f) => f.locationCode === code);

    const revenueCents = locOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Math.round(Number(o.total) * 100), 0);
    const revenue = revenueCents / 100;
    const completed = locOrders.filter((o) => o.status !== "cancelled");
    const avgTicket = completed.length > 0 ? revenue / completed.length : 0;

    const statusBreakdown: Record<string, number> = {};
    for (const o of locOrders) {
      statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
    }

    let agg = { ...EMPTY_AGGREGATE };
    if (locFeedback.length > 0) {
      const sum = locFeedback.reduce(
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
      const n = locFeedback.length;
      agg = {
        count: n,
        avgFoodQuality: round2(sum.foodQuality / n),
        avgService: round2(sum.service / n),
        avgVariety: round2(sum.variety / n),
        avgValue: round2(sum.value / n),
        avgCleanliness: round2(sum.cleanliness / n),
        avgAmbience: round2(sum.ambience / n),
        avgOverall: round2(sum.overall / n),
      };
    }

    return {
      locationCode: code,
      locationName: menu?.locationName ?? code,
      currency: menu?.currency ?? "EUR",
      ordersCount: locOrders.length,
      revenue: round2(revenue),
      avgTicket: round2(avgTicket),
      statusBreakdown,
      feedback: agg,
      publishedAt: menu?.publishedAt.toISOString() ?? null,
    };
  });

  result.sort((a, b) => b.revenue - a.revenue);
  res.json(result);
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default router;
