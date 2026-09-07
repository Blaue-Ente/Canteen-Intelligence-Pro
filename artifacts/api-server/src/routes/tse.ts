/**
 * T011 — TSE (Technische Sicherheitseinrichtung) signing endpoint.
 *
 * Provides cash-register transaction signing per German KassenSichV §2 / BSI TR-03153.
 * Two providers are supported transparently for the client:
 *
 *  1. "stub"  — local HMAC-SHA256(SESSION_SECRET, processData) signature.
 *               Functional for development and pilot installations BUT not legally
 *               binding under §146a AO. Always returns the same fake serial
 *               "STUB-DEV-TSE" so receipts cluster per environment.
 *
 *  2. "fiskaly_sandbox" / "fiskaly_prod" — proxies to fiskaly Cloud TSE.
 *               Activated automatically when FISKALY_API_KEY (+ FISKALY_API_SECRET +
 *               FISKALY_TSS_ID + FISKALY_CLIENT_ID) are present in the environment.
 *               Falls back to stub mode otherwise so dev builds never block.
 *
 * The mobile client treats the response shape identically; only the
 * `provider` field tells the user which mode produced the signature.
 *
 * NB: this route is mounted at /api/tse/* and only invoked when the mobile
 * app is in "full" (Voll-Modus) — gating is enforced client-side via
 * `<FullModeOnly>`. Server still accepts requests so a future second app or
 * desktop POS can sign too.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ─── Provider selection ─────────────────────────────────────────────────────

const FISKALY_API_KEY    = process.env.FISKALY_API_KEY    ?? "";
const FISKALY_API_SECRET = process.env.FISKALY_API_SECRET ?? "";
const FISKALY_TSS_ID     = process.env.FISKALY_TSS_ID     ?? "";
const FISKALY_CLIENT_ID  = process.env.FISKALY_CLIENT_ID  ?? "";
const FISKALY_BASE       = process.env.FISKALY_BASE_URL   ?? "https://kassensichv-middleware.fiskaly.com/api/v2";

function fiskalyConfigured(): boolean {
  return Boolean(FISKALY_API_KEY && FISKALY_API_SECRET && FISKALY_TSS_ID && FISKALY_CLIENT_ID);
}

const SIGN_SECRET = process.env.SESSION_SECRET ?? "kitchenos-dev-tse-secret";

// Persist stub signature counter to disk so it survives server restarts.
// KassenSichV requires gap-free monotonic counters per TSE; even in stub
// mode we honour this so audits performed during pilot don't show resets.
const STUB_STATE_FILE = path.join(process.cwd(), ".tse-stub-counter.json");
const STUB_SERIAL = "STUB-DEV-TSE";

function loadStubCounter(): number {
  try {
    const raw = fs.readFileSync(STUB_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { counter?: number };
    return typeof parsed.counter === "number" ? parsed.counter : 0;
  } catch {
    return 0;
  }
}

function saveStubCounter(n: number): void {
  try {
    fs.writeFileSync(STUB_STATE_FILE, JSON.stringify({ counter: n, updatedAt: new Date().toISOString() }), "utf8");
  } catch {
    /* best-effort persistence; if disk is read-only we still keep the in-memory value monotonic for the session */
  }
}

let stubSigCounter = loadStubCounter();

// ─── Stub signing ───────────────────────────────────────────────────────────

interface SignRequestBody {
  /** Sequential transaction number per cash register (Belegnummer). */
  txNumber: number;
  /** Stable cash-register identifier (Kassennummer). */
  kassennummer: string;
  /** Belegtyp, default "Kassenbeleg-V1". */
  processType?: string;
  /** Pre-formatted Beleginhalt string per BMF DSFinV-K, e.g.
   *  "Beleg^17.50_2.45_0.00_0.00_0.00^17.50:Bar".  */
  processData: string;
}

interface SignResponse {
  provider: "stub" | "fiskaly_sandbox" | "fiskaly_prod";
  serialNumber: string;
  signatureCounter: number;
  signature: string;
  time: string;
  txNumber: number;
  processType: string;
  processData: string;
}

function signStub(body: SignRequestBody): SignResponse {
  stubSigCounter += 1;
  saveStubCounter(stubSigCounter);
  const time = new Date().toISOString();
  const processType = body.processType || "Kassenbeleg-V1";
  const payload = [
    body.kassennummer,
    String(body.txNumber),
    String(stubSigCounter),
    time,
    processType,
    body.processData,
  ].join("|");
  const sig = crypto.createHmac("sha256", SIGN_SECRET).update(payload).digest("base64");
  return {
    provider: "stub",
    serialNumber: STUB_SERIAL,
    signatureCounter: stubSigCounter,
    signature: sig,
    time,
    txNumber: body.txNumber,
    processType,
    processData: body.processData,
  };
}

// ─── Fiskaly OAuth + sign (real provider) ───────────────────────────────────

let fiskalyToken: { accessToken: string; expiresAt: number } | null = null;

async function getFiskalyToken(): Promise<string> {
  const now = Date.now();
  if (fiskalyToken && fiskalyToken.expiresAt > now + 30_000) {
    return fiskalyToken.accessToken;
  }
  const r = await fetch(`${FISKALY_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: FISKALY_API_KEY, api_secret: FISKALY_API_SECRET }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`fiskaly auth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  fiskalyToken = { accessToken: j.access_token, expiresAt: now + j.expires_in * 1000 };
  return j.access_token;
}

async function signFiskaly(body: SignRequestBody): Promise<SignResponse> {
  const token = await getFiskalyToken();
  const txUuid = crypto.randomUUID();
  const url = `${FISKALY_BASE}/tss/${FISKALY_TSS_ID}/tx/${txUuid}?tx_revision=1`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      state: "FINISHED",
      client_id: FISKALY_CLIENT_ID,
      schema: { standard_v1: { receipt: { receipt_type: body.processType ?? "RECEIPT" } } },
      data: { encoding: "UTF-8", payload: Buffer.from(body.processData, "utf8").toString("base64") },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`fiskaly sign ${r.status}: ${await r.text()}`);
  interface FiskalyResp {
    signature: { value: string; counter: number };
    time_start: string;
    time_end: string;
    qr_code_data: string;
    tss_serial_number_hex: string;
  }
  const j = (await r.json()) as FiskalyResp;
  return {
    provider: FISKALY_BASE.includes("sandbox") ? "fiskaly_sandbox" : "fiskaly_prod",
    serialNumber: j.tss_serial_number_hex,
    signatureCounter: j.signature.counter,
    signature: j.signature.value,
    time: j.time_end,
    txNumber: body.txNumber,
    processType: body.processType || "Kassenbeleg-V1",
    processData: body.processData,
  };
}

// ─── POST /api/tse/sign ─────────────────────────────────────────────────────

router.post("/tse/sign", async (req: Request, res: Response) => {
  const body = req.body as Partial<SignRequestBody>;
  if (!body || typeof body.txNumber !== "number" || !body.kassennummer || !body.processData) {
    res.status(400).json({ error: "txNumber, kassennummer and processData required" });
    return;
  }
  const fullBody: SignRequestBody = {
    txNumber: body.txNumber,
    kassennummer: body.kassennummer,
    processType: body.processType,
    processData: body.processData,
  };

  if (fiskalyConfigured()) {
    try {
      const signed = await signFiskaly(fullBody);
      res.json(signed);
      return;
    } catch (err) {
      req.log.error({ err }, "fiskaly sign failed — refusing legally invalid stub fallback");
      res.status(502).json({
        error: "tse_unavailable",
        message: "TSE-Signatur fehlgeschlagen. Beleg darf nicht ausgegeben werden.",
      });
      return;
    }
  }
  res.json(signStub(fullBody));
});

// ─── GET /api/tse/status ────────────────────────────────────────────────────

router.get("/tse/status", (_req, res: Response) => {
  res.json({
    provider: fiskalyConfigured() ? "fiskaly" : "stub",
    serialNumber: fiskalyConfigured() ? null : STUB_SERIAL,
    legallyBinding: fiskalyConfigured(),
    note: fiskalyConfigured()
      ? "fiskaly cloud TSE active — KassenSichV-konform."
      : "Stub-Modus aktiv — nur für Entwicklung. Setze FISKALY_API_KEY für echte Signaturen.",
  });
});

export default router;
