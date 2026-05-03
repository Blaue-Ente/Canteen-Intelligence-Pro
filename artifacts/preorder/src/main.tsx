import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY — auth features will not work.");
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

// The api-server's Clerk frontend-API proxy is only mounted in production
// (NODE_ENV === "production"). In dev, talk to Clerk's hosted frontend API
// directly; in prod, proxy through our own domain so it works on .replit.app
// and custom domains without DNS CNAME setup.
const isProd = import.meta.env.PROD;

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY ?? ""}
    {...(isProd
      ? { proxyUrl: `${window.location.origin}/api/__clerk` }
      : {})}
    signInUrl={`${base}/sign-in`}
    signUpUrl={`${base}/sign-up`}
    signInFallbackRedirectUrl={`${base}/profile`}
    signUpFallbackRedirectUrl={`${base}/profile`}
  >
    <App />
  </ClerkProvider>,
);
