/**
 * Extract recipes from Köche-Nord PDF cookbooks and upsert into recipe_library.
 *
 * PDFs must be pre-downloaded to /tmp/kochbuecher/ (done by the calling workflow).
 * The script is idempotent — re-running updates existing rows.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run extract:koechenord
 *
 * Env:
 *   DATABASE_URL
 *   AI_INTEGRATIONS_OPENAI_BASE_URL
 *   AI_INTEGRATIONS_OPENAI_API_KEY
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { db, recipeLibrary } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { sql } from "drizzle-orm";

// Use lib path directly to avoid pdf-parse test-file bug with ESM
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

// ── Config ────────────────────────────────────────────────────────────────────

const PDF_DIR = "/tmp/kochbuecher";
const PROGRESS_FILE = "/tmp/koechenord-progress.json";
const MODEL = "gpt-4o-mini";
const CHUNK_SIZE = 20_000; // chars per AI call
const CHUNK_OVERLAP = 500;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedRecipe {
  nameDe: string;
  name: string;
  type: "soup" | "main" | "salad" | "dessert" | "side" | "drink";
  category: "vegan" | "vegetarian" | "meat" | "fish" | "kids";
  meat: "beef" | "pork" | "chicken" | "lamb" | "turkey" | "none";
  portionGrams: number;
  cookTimeMin: number;
  kcalPerPortion?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  allergens: string[];
  stepsDe: string[];
  steps: string[];
  tags: string[];
}

interface Progress {
  done: string[];
  totalUpserted: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")) as Progress;
  }
  return { done: [], totalUpserted: 0 };
}

function saveProgress(p: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function extractFromChunk(
  chunk: string,
  bookName: string,
): Promise<ExtractedRecipe[]> {
  const systemPrompt = `Du bist ein Kochbuch-Parser für eine deutsche Kantinen-Software.
Extrahiere alle vollständigen Rezepte aus dem gegebenen PDF-Text.
Gib NUR Rezepte zurück, die VOLLSTÄNDIGE Zutaten UND Zubereitungsschritte haben.
Überspringe Inhaltsverzeichnisse, Vorworte, Einkaufslisten und Rezepte ohne Schritte.

Für jedes Rezept liefere ein JSON-Objekt:
{
  "nameDe": "Deutscher Name des Gerichts",
  "name": "English name (translate it)",
  "type": "soup|main|salad|dessert|side|drink",
  "category": "vegan|vegetarian|meat|fish|kids",
  "meat": "beef|pork|chicken|lamb|turkey|none",
  "portionGrams": 350,
  "cookTimeMin": 30,
  "kcalPerPortion": 450,
  "protein": 20,
  "fat": 15,
  "carbs": 40,
  "allergens": ["gluten","milk","egg","nuts","soy","fish","shellfish","celery","mustard","sesame","sulphite","lupin","mollusc","peanut"],
  "stepsDe": ["Schritt 1...", "Schritt 2..."],
  "steps": ["Step 1...", "Step 2..."],
  "tags": ["klassiker","vegetarisch","schnell","kantine","sommer","herbst","winter","frühling","gesund","günstig","deftig"]
}

Gib ein JSON-Array zurück. Wenn keine vollständigen Rezepte vorhanden sind, gib [] zurück.`;

  const userPrompt = `Kochbuch: "${bookName}"\n\n${chunk}`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4000,
  });

  const raw = res.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw) as { recipes?: ExtractedRecipe[] } | ExtractedRecipe[];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.recipes)) return parsed.recipes;
    // Some models return { "0": {...}, "1": {...} }
    return Object.values(parsed).filter(
      (v): v is ExtractedRecipe => typeof v === "object" && v !== null && "nameDe" in v,
    );
  } catch {
    return [];
  }
}

async function upsertRecipes(recipes: ExtractedRecipe[]): Promise<number> {
  let count = 0;
  for (const r of recipes) {
    if (!r.nameDe || !r.stepsDe?.length) continue;

    // Validate enums
    const validTypes = ["soup", "main", "salad", "dessert", "side", "drink"];
    const validCats = ["vegan", "vegetarian", "meat", "fish", "kids"];
    const validMeats = ["beef", "pork", "chicken", "lamb", "turkey", "none"];

    const type = validTypes.includes(r.type) ? r.type : "main";
    const category = validCats.includes(r.category) ? r.category : "vegetarian";
    const meat = validMeats.includes(r.meat) ? r.meat : "none";

    try {
      await db
        .insert(recipeLibrary)
        .values({
          id: randomUUID(),
          nameDe: r.nameDe.trim().slice(0, 200),
          name: (r.name ?? r.nameDe).trim().slice(0, 200),
          type: type as typeof recipeLibrary.$inferInsert["type"],
          category: category as typeof recipeLibrary.$inferInsert["category"],
          meat: meat as typeof recipeLibrary.$inferInsert["meat"],
          portionGrams: Math.max(50, Math.min(2000, r.portionGrams ?? 350)),
          basePrice: 2.5,
          sellPrice: 0,
          cookTimeMin: Math.max(5, Math.min(480, r.cookTimeMin ?? 30)),
          kcalPerPortion: r.kcalPerPortion ?? null,
          protein: r.protein ?? null,
          fat: r.fat ?? null,
          carbs: r.carbs ?? null,
          allergens: Array.isArray(r.allergens) ? r.allergens.slice(0, 14) : [],
          stepsDe: Array.isArray(r.stepsDe) ? r.stepsDe : [],
          steps: Array.isArray(r.steps) ? r.steps : r.stepsDe,
          tags: Array.isArray(r.tags) ? r.tags : [],
        })
        .onConflictDoUpdate({
          target: recipeLibrary.nameDe,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            category: sql`excluded.category`,
            meat: sql`excluded.meat`,
            portionGrams: sql`excluded.portion_grams`,
            cookTimeMin: sql`excluded.cook_time_min`,
            kcalPerPortion: sql`excluded.kcal_per_portion`,
            protein: sql`excluded.protein`,
            fat: sql`excluded.fat`,
            carbs: sql`excluded.carbs`,
            allergens: sql`excluded.allergens`,
            stepsDe: sql`excluded.steps_de`,
            steps: sql`excluded.steps`,
            tags: sql`excluded.tags`,
          },
        });
      count++;
    } catch (err) {
      console.error(`  ✗ Fehler bei "${r.nameDe}":`, (err as Error).message?.slice(0, 80));
    }
  }
  return count;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const progress = loadProgress();
  console.log(`\n📚 Köche-Nord Rezeptextraktor`);
  console.log(`   Bereits verarbeitet: ${progress.done.length} PDFs`);
  console.log(`   Bisher eingefügt:    ${progress.totalUpserted} Rezepte\n`);

  if (!existsSync(PDF_DIR)) {
    console.error(`❌ PDF-Verzeichnis nicht gefunden: ${PDF_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(PDF_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .filter((f) => !progress.done.includes(f));

  if (files.length === 0) {
    console.log("✅ Alle PDFs bereits verarbeitet.");
    process.exit(0);
  }

  console.log(`📄 Zu verarbeitende PDFs: ${files.join(", ")}\n`);

  for (const file of files) {
    const filePath = join(PDF_DIR, file);
    console.log(`\n─── ${file} ───────────────────────────────`);

    // Extract text from PDF
    let fullText: string;
    try {
      const buf = readFileSync(filePath);
      const parsed = await pdfParse(buf) as { text: string; numpages: number };
      fullText = parsed.text;
      console.log(`  📖 ${parsed.numpages} Seiten, ${fullText.length} Zeichen`);
    } catch (err) {
      console.error(`  ❌ PDF-Parsing fehlgeschlagen:`, (err as Error).message);
      continue;
    }

    // Remove excessive whitespace but keep structure
    fullText = fullText.replace(/\n{4,}/g, "\n\n").replace(/[ \t]{3,}/g, " ");

    // Split into chunks and process each
    const chunks = chunkText(fullText);
    console.log(`  🔪 ${chunks.length} Chunks à ~${CHUNK_SIZE} Zeichen`);

    const bookName = file.replace(".pdf", "").replace(/-/g, " ");
    let bookTotal = 0;
    const seenNames = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      process.stdout.write(`  🤖 Chunk ${i + 1}/${chunks.length} … `);
      try {
        const recipes = await extractFromChunk(chunks[i]!, bookName);
        // Deduplicate within this book
        const fresh = recipes.filter((r) => r.nameDe && !seenNames.has(r.nameDe));
        fresh.forEach((r) => seenNames.add(r.nameDe));

        const inserted = await upsertRecipes(fresh);
        bookTotal += inserted;
        console.log(`${fresh.length} gefunden, ${inserted} eingefügt`);
      } catch (err) {
        console.error(`❌ Fehler: ${(err as Error).message?.slice(0, 100)}`);
        await new Promise((r) => setTimeout(r, 5000)); // backoff
      }

      // No delay — gpt-4o-mini rate limits are generous
    }

    console.log(`  ✅ ${bookName}: ${bookTotal} Rezepte eingefügt`);
    progress.done.push(file);
    progress.totalUpserted += bookTotal;
    saveProgress(progress);
  }

  console.log(`\n🎉 Fertig! Gesamt ${progress.totalUpserted} Rezepte in der Datenbank.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
