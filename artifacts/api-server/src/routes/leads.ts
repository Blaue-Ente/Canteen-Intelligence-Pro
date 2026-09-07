import { Router, type IRouter } from "express";
import { createRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();
const limitLeads = createRateLimiter({ windowMs: 60_000, max: 5 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public demo / contact lead capture for the marketing site.
 * No database required — logs a structured event the operator can follow up.
 */
router.post("/leads", async (req, res) => {
  if (!limitLeads(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const size = typeof body.size === "string" ? body.size.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: "name_invalid" });
    return;
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    res.status(400).json({ error: "email_invalid" });
    return;
  }
  if (company.length > 160 || size.length > 80 || message.length > 2000) {
    res.status(400).json({ error: "field_too_long" });
    return;
  }

  req.log.info(
    {
      kind: "marketing_lead",
      name,
      company,
      email,
      size,
      message: message.slice(0, 500),
    },
    "new marketing lead",
  );

  res.status(201).json({ ok: true });
});

export default router;
