import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
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

// Clerk proxy must come before body parsers (it streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
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
