import { Router } from "express";
import { db, recipeLibrary } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/recipe-library
 *
 * Returns all recipes from the server library.
 * Optional query params:
 *   - type:     soup | main | salad | dessert | side | drink
 *   - category: vegan | vegetarian | meat | fish | kids
 *   - q:        free-text search on name_de or tags
 */
router.get("/recipe-library", async (req, res) => {
  try {
    const { type, category, q } = req.query as Record<string, string | undefined>;

    const rows = await db
      .select()
      .from(recipeLibrary)
      .where(
        sql`(
          ${type ? sql`${recipeLibrary.type} = ${type}` : sql`true`}
          AND
          ${category ? sql`${recipeLibrary.category} = ${category}` : sql`true`}
          AND
          ${
            q
              ? or(
                  ilike(recipeLibrary.nameDe, `%${q}%`),
                  ilike(recipeLibrary.name, `%${q}%`),
                  sql`${recipeLibrary.tags}::text ilike ${"%" + q + "%"}`,
                )
              : sql`true`
          }
        )`,
      )
      .orderBy(recipeLibrary.nameDe);

    res.json({ recipes: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "recipe-library fetch error");
    res.status(500).json({ error: "Konnte Rezeptbibliothek nicht laden." });
  }
});

/**
 * GET /api/recipe-library/:id
 *
 * Returns a single recipe by ID.
 */
router.get("/recipe-library/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(recipeLibrary)
      .where(eq(recipeLibrary.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Rezept nicht gefunden." });
      return;
    }

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "recipe-library fetch-by-id error");
    res.status(500).json({ error: "Konnte Rezept nicht laden." });
  }
});

export default router;
