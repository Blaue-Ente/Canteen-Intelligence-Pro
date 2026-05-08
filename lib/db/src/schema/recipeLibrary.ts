import {
  pgTable,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const recipeLibrary = pgTable(
  "recipe_library",
  {
    id:             text("id").primaryKey(),
    nameDe:         text("name_de").notNull(),
    name:           text("name").notNull(),
    type:           text("type", { enum: ["soup", "main", "salad", "dessert", "side", "drink"] }).notNull(),
    category:       text("category", { enum: ["vegan", "vegetarian", "meat", "fish", "kids"] }).notNull(),
    meat:           text("meat", { enum: ["beef", "pork", "chicken", "lamb", "turkey", "none"] }).notNull().default("none"),
    portionGrams:   integer("portion_grams").notNull().default(300),
    basePrice:      doublePrecision("base_price").notNull().default(2.5),
    sellPrice:      doublePrecision("sell_price").notNull().default(0),
    cookTimeMin:    integer("cook_time_min").notNull().default(30),
    kcalPerPortion: integer("kcal_per_portion"),
    protein:        doublePrecision("protein"),
    fat:            doublePrecision("fat"),
    carbs:          doublePrecision("carbs"),
    allergens:      jsonb("allergens").$type<string[]>().notNull().default([]),
    stepsDe:        jsonb("steps_de").$type<string[]>().notNull().default([]),
    steps:          jsonb("steps").$type<string[]>().notNull().default([]),
    tags:           jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx:      index("recipe_library_type_idx").on(t.type),
    categoryIdx:  index("recipe_library_category_idx").on(t.category),
    nameDeUnique: unique("recipe_library_name_de_uq").on(t.nameDe),
  }),
);

export type RecipeLibraryRow = typeof recipeLibrary.$inferSelect;
export type InsertRecipeLibraryRow = typeof recipeLibrary.$inferInsert;
