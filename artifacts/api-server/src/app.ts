import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkNpmMiddleware,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must come before body parsers (it streams raw bytes).
// npm bundle requests are handled separately — FAPI 307-redirects them back to
// the proxy URL which causes an infinite loop if passed to the browser.
// clerkNpmMiddleware fetches the bundle server-side (redirect:follow) so the
// final CDN content is returned directly with no redirect visible to the client.
app.use(`${CLERK_PROXY_PATH}/npm`, clerkNpmMiddleware());
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname === "kitchenos.de" || hostname.endsWith(".kitchenos.de")) return true;
    // Current hosting is Replit; keep preview + production repl origins working.
    if (
      hostname.endsWith(".replit.app") ||
      hostname.endsWith(".replit.dev") ||
      hostname.endsWith(".repl.co")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, isAllowedCorsOrigin(origin));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Single-tenant: pass the publishable + secret key directly. The previous
// `publishableKeyFromHost` wrapper from @clerk/shared was a multi-tenant
// helper that returned undefined for hosts not in its internal map (e.g.
// kitchenos.de), causing clerkMiddleware to fall back to env defaults that
// no longer match our active Clerk instance — which silently broke JWT
// verification and made every authed request 401 in production.
app.use(
  clerkMiddleware({
    publishableKey:
      process.env.CLERK_PUBLISHABLE_KEY_PROD ?? process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY,
  }),
);

app.use("/api", router);

export default app;
