import { Router, type IRouter } from "express";

/**
 * Demo sign-in token endpoint.
 *
 * The three demo Clerk users live in the production Clerk instance, which
 * has reverification enabled. That means a normal password sign-in from a
 * fresh browser is forced into a `needs_second_factor` flow that requires
 * an email code — impossible for shared public demo accounts that nobody
 * can read mail for.
 *
 * Workaround: use Clerk's admin "sign-in tokens" (a.k.a. tickets) to mint a
 * one-shot credential server-side. The frontend then exchanges it via
 * `signIn.create({ strategy: "ticket", ticket })`, which Clerk treats as a
 * fully-verified first factor and bypasses the reverification challenge.
 *
 * Implementation note: we deliberately use Clerk's REST API directly (not
 * the @clerk/express SDK) for both the user lookup and the token creation.
 * The SDK's `users.getUserList({ emailAddress: [...] })` call returned empty
 * results from the production runtime even though the same secret key
 * resolved the users correctly via direct REST. The REST API behaves
 * identically across environments, so it is the safer surface for a
 * critical path like demo sign-in.
 *
 * Security: the only thing this endpoint exposes is access to the three
 * pre-provisioned demo accounts. Their data is intentionally public per
 * the product's marketing-driven demo strategy.
 */

const router: IRouter = Router();

type DemoVariant = "kantine" | "schule" | "catering";

const DEMO_EMAILS: Record<DemoVariant, string> = {
  kantine: "demo-kantine@kitchenos.de",
  schule: "demo-schule@kitchenos.de",
  catering: "demo-catering@kitchenos.de",
};

const VALID_VARIANTS: ReadonlySet<string> = new Set(Object.keys(DEMO_EMAILS));

router.post("/auth/demo-sign-in-token", async (req, res) => {
  const variantRaw: unknown = (req.body as { variant?: unknown } | undefined)?.variant;
  if (typeof variantRaw !== "string" || !VALID_VARIANTS.has(variantRaw)) {
    res.status(400).json({ error: "invalid_variant" });
    return;
  }
  const variant = variantRaw as DemoVariant;

  const secret = process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY;
  if (!secret) {
    req.log.error("CLERK_SECRET_KEY is not set");
    res.status(500).json({ error: "clerk_not_configured" });
    return;
  }

  const email = DEMO_EMAILS[variant];

  try {
    const lookupUrl = `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`;
    const lookupRes = await fetch(lookupUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!lookupRes.ok) {
      const errBody = await lookupRes.text().catch(() => "");
      req.log.error(
        { status: lookupRes.status, body: errBody.slice(0, 500), email },
        "Clerk user lookup failed",
      );
      res.status(502).json({ error: "user_lookup_failed" });
      return;
    }
    const lookupData = (await lookupRes.json()) as Array<{ id?: string }>;
    const user = Array.isArray(lookupData) ? lookupData[0] : undefined;
    if (!user?.id) {
      req.log.error(
        { email, returnedCount: Array.isArray(lookupData) ? lookupData.length : "non-array" },
        "demo user not provisioned in Clerk",
      );
      res.status(503).json({ error: "demo_user_not_seeded" });
      return;
    }

    // expires_in_seconds is short because the ticket is consumed within
    // the same client tick on the frontend.
    const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        expires_in_seconds: 60,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => "");
      req.log.error(
        { status: tokenRes.status, body: errBody.slice(0, 500), email },
        "Clerk sign-in token creation failed",
      );
      res.status(502).json({ error: "token_creation_failed" });
      return;
    }

    const tokenData = (await tokenRes.json()) as { token?: string };
    if (!tokenData.token) {
      req.log.error({ tokenData, email }, "Clerk returned token response without token field");
      res.status(502).json({ error: "token_missing" });
      return;
    }

    res.json({ ticket: tokenData.token });
  } catch (err) {
    req.log.error({ err }, "demo sign-in token internal error");
    res.status(500).json({ error: "internal" });
  }
});

export default router;
