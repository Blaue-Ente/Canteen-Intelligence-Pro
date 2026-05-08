import { Router, type IRouter, type Response } from "express";
import { db, memberships, organizations, invites } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { createClerkClient } from "@clerk/express";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY ?? "",
});

interface CreateOrgBody {
  name: string;
  displayName?: string;
}

router.get("/me", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select({ m: memberships, o: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId));

  let user: { email?: string; firstName?: string | null; lastName?: string | null } = {};
  try {
    const u = await clerk.users.getUser(userId);
    user = {
      email: u.primaryEmailAddress?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
    };
  } catch {
    // ignore
  }

  res.json({
    userId,
    user,
    memberships: rows.map((r) => ({
      orgId: r.o.id,
      orgName: r.o.name,
      role: r.m.role,
      displayName: r.m.displayName,
      employeeRole: r.m.employeeRole,
      approved: r.m.approvedAt !== null,
    })),
  });
});

router.post("/orgs", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const body = req.body as CreateOrgBody;
  if (!body?.name || typeof body.name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }

  let displayName = body.displayName;
  if (!displayName) {
    try {
      const u = await clerk.users.getUser(userId);
      displayName =
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.primaryEmailAddress?.emailAddress ||
        "Inhaber";
    } catch {
      displayName = "Inhaber";
    }
  }

  const orgId = `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(organizations).values({ id: orgId, name: body.name, ownerUserId: userId });
  // Owner is automatically approved
  await db.insert(memberships).values({
    orgId,
    userId,
    role: "owner",
    displayName,
    employeeRole: "manager",
    approvedAt: new Date(),
  });

  res.json({ orgId, name: body.name });
});

router.get("/orgs/:orgId/members", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const me = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  if (me.length === 0) {
    res.status(403).json({ error: "Not a member" });
    return;
  }

  const members = await db.select().from(memberships).where(eq(memberships.orgId, orgId));
  const pending = await db
    .select()
    .from(invites)
    .where(eq(invites.orgId, orgId));
  res.json({
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      displayName: m.displayName,
      email: m.email,
      employeeRole: m.employeeRole,
      approved: m.approvedAt !== null,
    })),
    invites: pending
      .filter((i) => !i.acceptedAt)
      .map((i) => ({
        code: i.code,
        email: i.email,
        displayName: i.displayName,
        employeeRole: i.employeeRole,
        role: i.role,
      })),
  });
});

interface InviteBody {
  email: string;
  displayName?: string;
  role?: "manager" | "staff";
  employeeRole?: string;
}

router.post("/orgs/:orgId/invites", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const me = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  if (me.length === 0 || me[0]!.role === "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body as InviteBody;
  if (!body?.email) {
    res.status(400).json({ error: "email required" });
    return;
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await db
    .insert(invites)
    .values({
      code,
      orgId,
      email: body.email.toLowerCase(),
      displayName: body.displayName ?? body.email.split("@")[0]!,
      role: body.role ?? "staff",
      employeeRole: body.employeeRole,
      invitedBy: userId,
    })
    .onConflictDoNothing();
  res.json({ code });
});

router.delete("/orgs/:orgId/invites/:code", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const code = String(req.params.code);
  const me = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  if (me.length === 0 || me[0]!.role === "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(invites).where(and(eq(invites.orgId, orgId), eq(invites.code, code)));
  res.json({ ok: true });
});

router.delete("/orgs/:orgId/members/:userId", requireAuth, async (req, res: Response) => {
  const me = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const target = String(req.params.userId);
  const myRow = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, me)))
    .limit(1);
  if (myRow.length === 0 || myRow[0]!.role === "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (target === me) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }
  await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, target)));
  res.json({ ok: true });
});

// Approve a pending member (owner/manager only)
router.patch("/orgs/:orgId/members/:userId/approve", requireAuth, async (req, res: Response) => {
  const callerId = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const targetId = String(req.params.userId);

  const myRow = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, callerId)))
    .limit(1);
  if (myRow.length === 0 || myRow[0]!.role === "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updated = await db
    .update(memberships)
    .set({ approvedAt: new Date() })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, targetId)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json({ ok: true });
});

// Reject / remove a pending member (owner/manager only)
router.delete("/orgs/:orgId/members/:userId/reject", requireAuth, async (req, res: Response) => {
  const callerId = (req as AuthedRequest).userId;
  const orgId = String(req.params.orgId);
  const targetId = String(req.params.userId);

  const myRow = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, callerId)))
    .limit(1);
  if (myRow.length === 0 || myRow[0]!.role === "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (targetId === callerId) {
    res.status(400).json({ error: "Cannot reject yourself" });
    return;
  }
  await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, targetId)));
  res.json({ ok: true });
});

interface AcceptBody {
  code: string;
  displayName?: string;
}

router.post("/invites/accept", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const body = req.body as AcceptBody;
  if (!body?.code) {
    res.status(400).json({ error: "code required" });
    return;
  }
  const code = body.code.trim().toUpperCase();
  const found = await db.select().from(invites).where(eq(invites.code, code)).limit(1);
  if (found.length === 0) {
    res.status(404).json({ error: "Invalid code" });
    return;
  }
  const inv = found[0]!;
  if (inv.acceptedAt) {
    res.status(400).json({ error: "Already accepted" });
    return;
  }

  let email: string | undefined;
  let fallbackName: string | undefined;
  try {
    const u = await clerk.users.getUser(userId);
    email = u.primaryEmailAddress?.emailAddress;
    fallbackName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || email;
  } catch {
    // ignore
  }

  await db
    .insert(memberships)
    .values({
      orgId: inv.orgId,
      userId,
      role: inv.role,
      displayName: body.displayName ?? inv.displayName ?? fallbackName ?? "Mitarbeiter",
      email: email ?? inv.email,
      employeeRole: inv.employeeRole,
      approvedAt: null, // Pending — owner must approve
    })
    .onConflictDoNothing();

  await db
    .update(invites)
    .set({ acceptedAt: new Date(), acceptedByUserId: userId })
    .where(eq(invites.code, code));

  res.json({ orgId: inv.orgId, pending: true });
});

export default router;
