import { pgTable, text, timestamp, jsonb, numeric, uuid, integer, date, boolean } from "drizzle-orm/pg-core";

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

// ── Weekly menus (KW-based) ───────────────────────────────────────────────────
// A weekly menu covers a Kalenderwoche (KW). Multiple menu slots (1-6) can
// coexist for the same KW so different client groups can order from different
// menus. Each dish carries a `menuDate` (YYYY-MM-DD) indicating which day it
// is served. leadDays / cutoffHour live in location_settings.

export const weeklyMenusTable = pgTable("weekly_menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  locationCode: text("location_code").notNull(),
  /** Slot label, e.g. "Menü 1", "Menü 2" */
  menuSlot: text("menu_slot").notNull().default("Menü 1"),
  /** ISO year of the Kalenderwoche, e.g. 2026 */
  kwYear: integer("kw_year").notNull(),
  /** Kalenderwoche number 1-53 */
  kwNumber: integer("kw_number").notNull(),
  /** First day of the week (Monday), ISO date YYYY-MM-DD */
  validFrom: date("valid_from").notNull(),
  /** Last day of the week (Sunday), ISO date YYYY-MM-DD */
  validTo: date("valid_to").notNull(),
  currency: text("currency").notNull().default("EUR"),
  /** Dishes — each carries menuDate (YYYY-MM-DD) and dishType ("Hauptgericht 1" etc.) */
  dishes: jsonb("dishes").notNull().$type<WeeklyMenuDishRow[]>(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export interface WeeklyMenuDishRow {
  id: string;
  name: string;
  description?: string | null;
  /** e.g. "Hauptgericht 1", "Suppe", "Dessert" */
  dishType: string;
  /** ISO date YYYY-MM-DD — which day this dish is served */
  menuDate: string;
  price: number;
  allergens: string[];
  kcal?: number | null;
  dge?: "green" | "amber" | "red" | null;
}

export type WeeklyMenuRow = typeof weeklyMenusTable.$inferSelect;

// ── Per-client agreed price list ──────────────────────────────────────────────
// Admin can set a fixed agreed price per dishType per customer. When computing
// the delivery ledger, agreed prices override the published menu prices.

export const clientPriceListsTable = pgTable("client_price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  locationCode: text("location_code").notNull(),
  /** Clerk user ID of the business customer */
  clerkUserId: text("clerk_user_id").notNull(),
  /** Dish category, e.g. "Hauptgericht 1", "Suppe", "Dessert" */
  dishType: text("dish_type").notNull(),
  /** Agreed price in the location currency */
  agreedPrice: numeric("agreed_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  /** Optional note, e.g. "Vertrag 2026" */
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClientPriceListRow = typeof clientPriceListsTable.$inferSelect;

// ── Delivery ledger ───────────────────────────────────────────────────────────
// Each record captures what was delivered to a specific business customer on a
// specific day. Written automatically when staff finalises a delivery day.
// Agreed prices are copied at the time of finalisation — historical accuracy.

export interface LedgerItemRow {
  dishId: string;
  name: string;
  dishType: string;
  qty: number;
  /** Agreed (or published) unit price at time of delivery */
  unitPrice: number;
  lineTotal: number;
}

export const deliveryLedgerTable = pgTable("delivery_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  locationCode: text("location_code").notNull(),
  /** Clerk user ID of the business customer */
  clerkUserId: text("clerk_user_id").notNull(),
  /** FK to guest_orders.id — the order that was delivered */
  orderId: uuid("order_id").notNull(),
  /** ISO date YYYY-MM-DD — actual delivery date */
  deliveryDate: date("delivery_date").notNull(),
  items: jsonb("items").notNull().$type<LedgerItemRow[]>(),
  /** Sum of lineTotal of all items */
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeliveryLedgerRow = typeof deliveryLedgerTable.$inferSelect;

// ── Location settings ─────────────────────────────────────────────────────────
// Per-location operational settings: lead days for advance ordering and cutoff hour.

export const locationSettingsTable = pgTable("location_settings", {
  locationCode: text("location_code").primaryKey(),
  orgId: text("org_id").notNull(),
  /** How many days in advance customers can place orders. Default 7. */
  leadDays: integer("lead_days").notNull().default(7),
  /** Hour of day (0-23) after which orders for the same day are locked. Default 8. */
  cutoffHour: integer("cutoff_hour").notNull().default(8),
  /** Whether to auto-finalize day orders at midnight. */
  autoFinalize: boolean("auto_finalize").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LocationSettingsRow = typeof locationSettingsTable.$inferSelect;
