import { pgTable, text, timestamp, uniqueIndex, primaryKey, jsonb } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["owner", "manager", "staff"] }).notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    employeeRole: text("employee_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
  }),
);

export const invites = pgTable(
  "invites",
  {
    code: text("code").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    displayName: text("display_name"),
    employeeRole: text("employee_role"),
    role: text("role", { enum: ["owner", "manager", "staff"] }).notNull(),
    invitedBy: text("invited_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id"),
  },
  (t) => ({
    emailIdx: uniqueIndex("invites_email_org_idx").on(t.orgId, t.email),
  }),
);

/** Org-level branding config for the guest preorder web app.
 *  One row per org, upserted from the mobile settings screen. */
export const orgBranding = pgTable("org_branding", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type OrgBranding = typeof orgBranding.$inferSelect;
