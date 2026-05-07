import { Router, type IRouter } from "express";
import { schemas, type HealthStatus } from "@workspace/api-zod";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data: HealthStatus = schemas.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Temporary debug endpoint — remove after diagnosis
router.get("/debug-clerk-proxy", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = getClerkProxyHost(req);
  const override = process.env.CLERK_PROXY_HOST_OVERRIDE;
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  res.json({
    "x-forwarded-host": req.headers["x-forwarded-host"],
    "x-forwarded-proto": req.headers["x-forwarded-proto"],
    host: req.headers["host"],
    derivedHost: host,
    override,
    effectiveHost: override || host,
    clerkProxyUrl: `${proto}://${override || host}/api/__clerk`,
    skPrefix: sk.slice(0, 12),
    skLen: sk.length,
  });
});

export default router;
