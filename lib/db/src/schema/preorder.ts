import { pgTable, text, timestamp, jsonb, numeric, uuid, integer, date } from "drizzle-orm/pg-core";

export interface PreorderDishRow {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  type?: string | null;
  allergens: string[];
  imageUrl?: string | null;
  kcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  dge?: "green" | "amber" | "red" | null;
  co2eG?: number | null;
}

export const publishedMenusTable = pgTable("published_menus", {
  locationCode: text("location_code").primaryKey(),
  locationName: text("location_name").notNull(),
  currency: text("currency").notNull().default("EUR"),
  dishes: jsonb("dishes").notNull().$type<PreorderDishRow[]>(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  ownerOrgId: text("owner_org_id").notNull(),
});

export type PublishedMenuRow = typeof publishedMenusTable.$inferSelect;

export const guestOrdersTable = pgTable("guest_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationCode: text("location_code").notNull(),
  ownerOrgId: text("owner_org_id").notNull(),
  customerId: text("customer_id"),
  wantedFor: date("wanted_for"),
  guestName: text("guest_name").notNull(),
  guestNote: text("guest_note"),
  items: jsonb("items").notNull().$type<
    Array<{ dishId: string; name: string; qty: number; price: number }>
  >(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("new"),
  accessToken: text("access_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GuestOrderRow = typeof guestOrdersTable.$inferSelect;

export interface FeedbackRatings {
  foodQuality: number;
  service: number;
  variety: number;
  value: number;
  cleanliness: number;
  ambience: number;
}

export const guestFeedbackTable = pgTable("guest_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationCode: text("location_code").notNull(),
  ownerOrgId: text("owner_org_id").notNull(),
  ratings: jsonb("ratings").notNull().$type<FeedbackRatings>(),
  overall: integer("overall").notNull(),
  comment: text("comment"),
  guestName: text("guest_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuestFeedbackRow = typeof guestFeedbackTable.$inferSelect;

export type CustomerAccountType = "regular" | "business_pending" | "business_approved" | "rejected";

export const customerProfilesTable = pgTable("customer_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  homeLocationCode: text("home_location_code"),
  accountType: text("account_type").$type<CustomerAccountType>().notNull().default("regular"),
  ownerOrgId: text("owner_org_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CustomerProfileRow = typeof customerProfilesTable.$inferSelect;

// ── Business reference codes ─────────────────────────────────────────────────
// Admin generates short alphanumeric codes (e.g. "AB12CD34"). When a customer
// redeems one on the pre-order portal, their account type is instantly set to
// business_approved — no manual approval needed.

export const businessRefCodesTable = pgTable("business_ref_codes", {
  code: text("code").primaryKey(),
  orgId: text("org_id").notNull(),
  locationCode: text("location_code").notNull(),
  /** Optional label for admin reference, e.g. "Firma Müller GmbH". */
  label: text("label"),
  createdBy: text("created_by").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  usesCount: integer("uses_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessRefCodeRow = typeof businessRefCodesTable.$inferSelect;

// ── Portal announcements ──────────────────────────────────────────────────────
// Admin uploads PDFs, images or text messages. Guests see them on the portal.
// File data is stored as base64 text (≤ 5 MB raw = ≤ 7 MB base64).

export const portalAnnouncementsTable = pgTable("portal_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  locationCode: text("location_code").notNull(),
  title: text("title").notNull(),
  /** Optional plain-text body shown alongside or instead of an attachment. */
  body: text("body"),
  /** Original filename, e.g. "speiseplan-kw24.pdf". */
  fileName: text("file_name"),
  /** MIME type of the uploaded file, e.g. "application/pdf". */
  mimeType: text("mime_type"),
  /** Base64-encoded file contents. Null when announcement is text-only. */
  fileData: text("file_data"),
  createdBy: text("created_by").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PortalAnnouncementRow = typeof portalAnnouncementsTable.$inferSelect;
