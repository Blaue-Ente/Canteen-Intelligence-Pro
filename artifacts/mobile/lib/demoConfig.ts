/**
 * Demo account configuration.
 *
 * Three demo Clerk users are pre-provisioned (see `scripts/src/seed-demo-users.ts`),
 * each scoped to one realistic operating profile. All three share a single
 * publicly-known password — anyone visiting the marketing site is meant to
 * sign in instantly without registering. There are no real customers behind
 * these accounts, so the password is deliberately public.
 */

export type DemoVariant = "kantine" | "schule" | "catering";

export const DEMO_PASSWORD = "KitchenOS-Demo-2025!";

export const DEMO_USERS: Record<DemoVariant, { email: string; label: string; subtitle: string }> = {
  kantine: {
    email: "demo-kantine@kitchenos.de",
    label: "Kantine München",
    subtitle: "Mittagsküche, ~200 Portionen täglich",
  },
  schule: {
    email: "demo-schule@kitchenos.de",
    label: "Bio-Schulmensa",
    subtitle: "Vegan/vegetarisch, DGE-Standard, kinderfreundlich",
  },
  catering: {
    email: "demo-catering@kitchenos.de",
    label: "Event-Catering",
    subtitle: "Veranstaltungs-Geschäft mit Forecast",
  },
};

export const DEMO_VARIANTS: ReadonlyArray<DemoVariant> = ["kantine", "schule", "catering"];

export function isDemoEmail(email: string | undefined | null): DemoVariant | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  for (const v of DEMO_VARIANTS) {
    if (DEMO_USERS[v].email === lower) return v;
  }
  return null;
}
