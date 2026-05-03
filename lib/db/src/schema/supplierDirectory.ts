import { pgTable, text, timestamp, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";

export const supplierDirectory = pgTable(
  "supplier_directory",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: ["osm", "google", "manual"] }).notNull(),
    externalId: text("external_id"),
    name: text("name").notNull(),
    category: text("category").notNull(),
    productGroups: jsonb("product_groups").$type<string[]>().notNull().default([]),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    phone: text("phone"),
    website: text("website"),
    email: text("email"),
    rating: doublePrecision("rating"),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index("supplier_directory_cat_idx").on(t.category),
    geoIdx: index("supplier_directory_geo_idx").on(t.lat, t.lng),
  }),
);

export type SupplierDirectoryRow = typeof supplierDirectory.$inferSelect;
