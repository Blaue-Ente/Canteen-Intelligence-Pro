import { pgTable, text, timestamp, jsonb, numeric, uuid, integer } from "drizzle-orm/pg-core";

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
