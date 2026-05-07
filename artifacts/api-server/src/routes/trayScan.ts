/**
 * POST /api/ai/tray-scan
 *
 * Accepts a base64 JPEG photo of a customer tray plus today's menu context.
 * Returns JSON with recognised items mapped to known dishes where possible.
 *
 * The client is responsible for:
 *   - Showing the result to the cashier for confirmation / correction
 *   - Queuing the confirmed sale locally when offline (Time Machine)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

interface MenuCtxItem {
  id: string;
  name: string;
  price: number;
  category?: string;
}

interface TrayScanBody {
  /** Full JPEG as base64 (no data-URI prefix). */
  base64: string;
  /** Today's available dishes for context mapping. */
  menuItems?: MenuCtxItem[];
  locale?: "de" | "en";
}

router.post("/ai/tray-scan", async (req: Request, res: Response) => {
  const body = req.body as TrayScanBody;
  if (!body?.base64) {
    res.status(400).json({ error: "base64 image required" });
    return;
  }
  if (body.base64.length > 20 * 1024 * 1024) {
    res.status(413).json({ error: "Image too large (max ~15 MB JPEG)" });
    return;
  }

  const lang = body.locale === "en" ? "English" : "Deutsch";
  const items = body.menuItems ?? [];

  const menuLines =
    items.length > 0
      ? items
          .map((m) => `  id=${m.id}  name="${m.name}"  price=€${m.price.toFixed(2)}`)
          .join("\n")
      : "  (Kein Tagesmenü übermittelt – Namen frei schätzen)";

  const prompt = [
    `Du bist KitchenOS Tray-Scanner. Eine Kamera über der Kasse hat das Tablett eines Gastes fotografiert. Antworte auf ${lang}.`,
    `Heutiges Menü:\n${menuLines}`,
    `Erkenne alle Gerichte auf dem Tablett. Für jedes zurückgeben:`,
    `  • recipeId – passende id aus dem Menü oben, oder null wenn unbekannt`,
    `  • name – Gerichtsname (aus Menü oder freie Schätzung)`,
    `  • qty – Anzahl sichtbarer Portionen (meist 1)`,
    `  • confidence – 0..1 (1.0 = absolut sicher)`,
    `  • pricePerUnit – Preis in EUR (aus Menü oder 0 wenn unbekannt)`,
    `Ignoriere Tablett, Besteck, Gläser, Servietten.`,
    `Antworte NUR mit minifiziertem JSON:`,
    `{"items":[{"recipeId":"string|null","name":"string","qty":1,"confidence":0.85,"pricePerUnit":0.00}]}`,
  ].join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${body.base64}` },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown = { items: [] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { items: [], raw };
    }
    res.json({ data: parsed });
  } catch (err) {
    req.log.error({ err }, "tray-scan error");
    res.status(500).json({
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
