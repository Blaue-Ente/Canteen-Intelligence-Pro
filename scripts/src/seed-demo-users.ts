/**
 * Seed three demo Clerk users + matching org memberships.
 *
 * Idempotent: re-running detects existing users by email and skips creation,
 * but always upserts the org + membership rows so the DB stays in sync if
 * the schema changes.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed:demo
 *
 * Env requirements:
 *   - CLERK_SECRET_KEY  (for user creation)
 *   - DATABASE_URL      (for org/membership inserts)
 *
 * Demo password is hard-coded — these accounts are public demo accounts and
 * the password is shown to anyone visiting the marketing site. There is no
 * real customer data behind them.
 */

import { createClerkClient } from "@clerk/backend";
import { db, organizations, memberships } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const DEMO_PASSWORD = "KitchenOS-Demo-2025!";

interface DemoSpec {
  variant: "kantine" | "schule" | "catering";
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  displayName: string;
  employeeRole: "manager";
}

const DEMOS: DemoSpec[] = [
  {
    variant: "kantine",
    email: "demo-kantine@kitchenos.de",
    firstName: "Demo",
    lastName: "Kantine",
    orgId: "org_demo_kantine",
    orgName: "Kantine am Marienplatz",
    displayName: "Demo Inhaber Kantine",
    employeeRole: "manager",
  },
  {
    variant: "schule",
    email: "demo-schule@kitchenos.de",
    firstName: "Demo",
    lastName: "Schule",
    orgId: "org_demo_schule",
    orgName: "Bio-Schulmensa Schwabing",
    displayName: "Demo Inhaber Schule",
    employeeRole: "manager",
  },
  {
    variant: "catering",
    email: "demo-catering@kitchenos.de",
    firstName: "Demo",
    lastName: "Catering",
    orgId: "org_demo_catering",
    orgName: "Eventküche Berlin",
    displayName: "Demo Inhaber Catering",
    employeeRole: "manager",
  },
];

async function main(): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY is not set");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  for (const d of DEMOS) {
    console.log(`\n→ ${d.variant} (${d.email})`);

    // 1. Find or create Clerk user.
    let userId: string;
    const existing = await clerk.users.getUserList({ emailAddress: [d.email] });
    if (existing.data.length > 0) {
      const u = existing.data[0]!;
      userId = u.id;
      console.log(`  ✓ Clerk user exists: ${userId}`);
      // Ensure password matches the published demo password — staff might
      // rotate it manually in the dashboard otherwise. updateUser can rotate
      // passwords on existing users.
      try {
        await clerk.users.updateUser(userId, { password: DEMO_PASSWORD });
        console.log("  ✓ Password reset to demo default");
      } catch (err) {
        console.log(`  ! Could not reset password: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      const created = await clerk.users.createUser({
        emailAddress: [d.email],
        password: DEMO_PASSWORD,
        firstName: d.firstName,
        lastName: d.lastName,
        skipPasswordChecks: true,
      });
      userId = created.id;
      console.log(`  ✓ Created Clerk user: ${userId}`);
    }

    // 2. Upsert org row — true upsert so name/owner drift is reconciled if
    //    the spec changes or the user was recreated under a new Clerk ID.
    const orgRow = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, d.orgId))
      .limit(1);
    if (orgRow.length === 0) {
      await db.insert(organizations).values({
        id: d.orgId,
        name: d.orgName,
        ownerUserId: userId,
      });
      console.log(`  ✓ Created org: ${d.orgId}`);
    } else {
      const existingOrg = orgRow[0]!;
      if (existingOrg.name !== d.orgName || existingOrg.ownerUserId !== userId) {
        await db
          .update(organizations)
          .set({ name: d.orgName, ownerUserId: userId })
          .where(eq(organizations.id, d.orgId));
        console.log(`  ✓ Updated org (name/owner reconciled): ${d.orgId}`);
      } else {
        console.log(`  ✓ Org exists (no drift): ${d.orgId}`);
      }
    }

    // 3. Reconcile stale memberships: any membership row for this org with
    //    a userId that no longer exists in Clerk would otherwise persist
    //    forever. Strategy: delete other memberships for this demo org
    //    whose userId differs from the freshly-resolved one. Demo orgs are
    //    single-owner by design, so this is safe.
    const allMems = await db
      .select()
      .from(memberships)
      .where(eq(memberships.orgId, d.orgId));
    const stale = allMems.filter((m) => m.userId !== userId);
    if (stale.length > 0) {
      for (const s of stale) {
        await db
          .delete(memberships)
          .where(and(eq(memberships.orgId, d.orgId), eq(memberships.userId, s.userId)));
      }
      console.log(`  ✓ Removed ${stale.length} stale membership(s) from previous Clerk user(s)`);
    }

    // 4. Upsert membership for the current Clerk userId.
    const memRow = allMems.find((m) => m.userId === userId);
    if (!memRow) {
      await db.insert(memberships).values({
        orgId: d.orgId,
        userId,
        role: "owner",
        displayName: d.displayName,
        email: d.email,
        employeeRole: d.employeeRole,
      });
      console.log("  ✓ Created membership");
    } else if (
      memRow.role !== "owner" ||
      memRow.displayName !== d.displayName ||
      memRow.email !== d.email ||
      memRow.employeeRole !== d.employeeRole
    ) {
      await db
        .update(memberships)
        .set({
          role: "owner",
          displayName: d.displayName,
          email: d.email,
          employeeRole: d.employeeRole,
        })
        .where(and(eq(memberships.orgId, d.orgId), eq(memberships.userId, userId)));
      console.log("  ✓ Updated membership (fields reconciled)");
    } else {
      console.log("  ✓ Membership exists (no drift)");
    }
  }

  console.log("\n✓ Demo seed complete.\n");
  console.log(`Sign-in password (public): ${DEMO_PASSWORD}`);
  console.log("Demo emails:");
  for (const d of DEMOS) console.log(`  - ${d.email}  (${d.variant})`);

  process.exit(0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
