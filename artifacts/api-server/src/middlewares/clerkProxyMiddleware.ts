/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Active whenever CLERK_SECRET_KEY is set.
 * - Must be mounted BEFORE express.json() middleware
 * - Two separate middlewares are exported:
 *   1. clerkNpmMiddleware()  — handles /npm/... paths by fetching server-side
 *      (follows Clerk's 307 redirects internally, never exposes them to the
 *      browser, breaking the infinite-redirect loop that occurs in production)
 *   2. clerkProxyMiddleware() — handles all other FAPI calls (/v1/..., etc.)
 *
 * Usage in app.ts:
 *   app.use(`${CLERK_PROXY_PATH}/npm`, clerkNpmMiddleware());
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler, Request, Response } from "express";
import type { IncomingHttpHeaders } from "http";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

/**
 * Handles /api/__clerk/npm/... requests by fetching the Clerk JS bundles
 * server-side, following all redirects internally.
 *
 * WHY: Clerk's FAPI returns a 307 redirect for npm bundle requests, pointing
 * back to the proxy URL (e.g. app.kitchenos.de/api/__clerk/npm/...). If the
 * browser follows this redirect it ends up in an infinite loop. By fetching
 * server-side (redirect:"follow") we resolve the final CDN URL and stream the
 * content directly to the client — no redirect ever reaches the browser.
 */
export function clerkNpmMiddleware(): RequestHandler {
  const secretKey =
    process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  return async (req: Request, res: Response) => {
    // req.path is relative to the mount point (/npm), e.g. "/@clerk/clerk-js@6/dist/clerk.browser.js"
    const targetUrl = `${CLERK_FAPI}/npm${req.path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

    try {
      const upstream = await fetch(targetUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "KitchenOS-Clerk-Proxy/1.0",
        },
      });

      // Forward safe response headers
      const skip = new Set([
        "transfer-encoding",
        "connection",
        "keep-alive",
        "content-encoding",
      ]);
      upstream.headers.forEach((value, key) => {
        if (!skip.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      // Add CORS so any origin can load the script
      const origin = req.headers["origin"];
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
      }

      // Long cache for versioned bundles
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      res.status(upstream.status);
      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    } catch (err) {
      res.status(502).json({ error: "Failed to fetch Clerk bundle" });
    }
  };
}

export function clerkProxyMiddleware(): RequestHandler {
  const secretKey =
    process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  // CLERK_PROXY_HOST_OVERRIDE pins the Clerk-Proxy-Url to the canonical domain
  // that Clerk knows about (app.kitchenos.de). Without this override, requests
  // arriving from *.replit.app or kitchenos.de would build a Clerk-Proxy-Url
  // using the wrong host and Clerk's FAPI would return 401.
  const proxyHostOverride = process.env.CLERK_PROXY_HOST_OVERRIDE;

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = proxyHostOverride || getClerkProxyHost(req) || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
      proxyRes: (proxyRes, req) => {
        // Ensure CORS headers so browsers on any origin can consume the response.
        const origin = (req as { headers: IncomingHttpHeaders }).headers[
          "origin"
        ];
        if (origin) {
          proxyRes.headers["access-control-allow-origin"] = origin;
          proxyRes.headers["access-control-allow-credentials"] = "true";
          proxyRes.headers["vary"] = "Origin";
        }
      },
    },
  }) as RequestHandler;
}
