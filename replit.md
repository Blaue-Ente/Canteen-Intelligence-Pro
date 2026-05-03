# KitchenOS

AI-driven kitchen operations app for German restaurants, canteens, and hotels. Built as a cross-platform Expo app (iOS, Android, Web) with a small Express AI proxy.

## Architecture

- `artifacts/mobile/` — Expo Router app (KitchenOS). All UI, state, AsyncStorage persistence.
- `artifacts/api-server/` — Express server. Hosts `/api/ai/chat` (SSE stream) and `/api/ai/vision` endpoints that wrap the Replit OpenAI integration.
- `artifacts/mockup-sandbox/` — design canvas (untouched template).
- `lib/integrations-openai-ai-server` — OpenAI client used by the api-server.

## Phase 5 — Multi-tenant accounts + supplier discovery

- **Auth**: Clerk (`@clerk/expo` v3, imported via `@clerk/expo/legacy` for the classic `useSignIn` / `useSignUp` API). `ClerkProvider` wraps the app in `_layout.tsx`; `AuthProvider` (in `contexts/AuthContext.tsx`) bridges Clerk's user/token to a local `me` + `currentMembership` snapshot, plus an `activeEmployee` selector. `AuthGate` redirects unauth users to `(auth)/sign-in`, signed-in users without a membership to `/onboarding`.
- **Token cache**: `lib/clerkTokenCache.ts` uses `expo-secure-store` on native, undefined on web (browser session storage handles it).
- **Server**: Express app uses `clerkProxyMiddleware` (handles Clerk's frontend API proxy in production) → `cors` → `express.json` → `clerkMiddleware` from `@clerk/express`. `requireAuth` in `lib/auth.ts` extracts `userId` via `getAuth()`.
- **DB schema**:
  - `lib/db/src/schema/orgs.ts` — `organizations`, `memberships` (role: owner/manager/staff + free-form `employeeRole` like Koch/Service), `invites` (one-time codes).
  - `lib/db/src/schema/supplierDirectory.ts` — Berlin/Brandenburg supplier cache with `osmId`, `googlePlaceId`, `category`, `lat`/`lon`, contact info, `productGroups` (jsonb).
- **Routes** (under `/api`):
  - `GET /me` — returns user + memberships.
  - `POST /orgs` — creates organization; caller becomes owner+manager.
  - `GET /orgs/:orgId/members`, `POST /orgs/:orgId/invites`, `DELETE /orgs/:orgId/invites/:code`, `DELETE /orgs/:orgId/members/:userId`.
  - `POST /invites/accept` — joins by 6-char code.
  - `GET /suppliers/discover?bbox=&q=&category=` — Overpass query (food shops in BBL bbox), 7-day cache in `supplier_directory`, optional Google Places enrichment when `GOOGLE_PLACES_API_KEY` is set.
- **Mobile screens**:
  - `app/(auth)/sign-in.tsx`, `sign-up.tsx` — email/password with email-code verification.
  - `app/onboarding.tsx` — "Restaurant erstellen" or "Team beitreten (Code)".
  - `app/team.tsx` — list members, invite by email, copy code; reachable from Settings.
  - `app/suppliers/discover.tsx` — category chips (Fleisch / Fisch / Bäckerei / Käse / Getränke / Großhandel / Obst&Gemüse) + free-text search; "Save" adds to local supplier list.
- **Attribution**: every `dispatch` that creates a record now spreads `...author` (= `{ createdBy, createdByName }`) sourced from `useAuthor()` so the UI can show "von <name>" on cards. Wired in: `sales`, `haccp`, `waste`, `inventur`, `(tabs)/inventory` (orders), `dienstplan` (shifts), `catering`, `supplier/[id]` (complaints), `zettle`, `recipe/[id]`.
- **Required env vars**: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (server), `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (mobile, set automatically from `CLERK_PUBLISHABLE_KEY` in the dev script). Optional: `GOOGLE_PLACES_API_KEY` for richer supplier metadata.

## Phase 6B — HACCP storage, editable price, menu OCR, dish vision (client-side)

All client-side, reuses existing `/api/ai/json` + `/api/ai/vision` endpoints.

- **HACCP storage locations** — new `StorageLocation { id, name, category: fridge|freezer|room|kitchen|delivery, targetTemp?, locationId? }`. AppContext actions `addStorageLocation/updateStorageLocation/removeStorageLocation`. `/haccp` screen now: type chips → category-filtered storage chips → tap to select, long-press to delete; inline "Lagerort hinzufügen" form (name + category + target °C); pass/fail threshold derived dynamically from `targetTemp` (cold = ≤, hot = ≥) with sensible defaults (Kühlung ≤ 7, Tiefkühler ≤ -18, Heißhaltung ≥ 65).
- **Editable sell price** — recipe detail screen has new "Verkaufspreis" card with "Preis ändern" / "Speichern" toggle; dispatches `updateRecipe` so margin Stat updates live.
- **Menu OCR** — `/scan` gains "Speisekarte scannen" mode + `lib/ai.ts::parseMenuImage` (vision JSON) → `ParsedMenu { items: [{name, description?, price, category, type, allergens[]}] }`. UI lists detected dishes with price + type/category/allergen badges and per-item checkbox; "Gerichte übernehmen (N)" creates `Recipe[]` (sellPrice from OCR, dish type mapped soup/salad/dessert/side/drink/main, vegan/vegetarian/meat category).
- **Structured dish vision** — Nährwerte mode upgraded from text to `aiDishVision` (vision JSON) → `{ dishGuess, kcalPerPortion, proteinG, carbsG, fatG, allergens[], notes }`. Card shows kcal badge + macros + allergen chips + notes; "Auf Rezept übertragen" picker merges allergens and updates `kcalPerPortion` on selected recipe.

Seed data (`seedData.ts`) ships 6 default storage locations (Kühlung 1, Kühlung 2 (Fleisch), Tiefkühler 1, Trockenlager, Heißhaltung Pass, Wareneingang). New i18n keys (DE+EN): `storageLocations`, `addStorage`, `catFridge/Freezer/Room/Kitchen/Delivery`, `targetTemp`, `editPrice`, `sellPrice`, `scanMenu`, `importDishes`, `detectedDishes`, `applyToRecipe`, `selectRecipe`, `none`.

## Phase 6A — 11 client-side AI features (no DB changes)

All client-side; new server routes intentionally skipped — Phase 6A reuses existing `/api/ai/json` and `/api/ai/vision`. Phase 6B (server persistence + native voice/maps/notifications) is deferred.

- **Multi-location** — `Location[]` in `AppState` with `currentLocationId`, header chip switcher on home, dedicated `/locations` screen with rollup (today's revenue, low-stock count, weekly waste). New entities (sales, waste, etc.) carry `locationId`.
- **AI demand forecast** — `/forecast` screen + `lib/ai.ts::aiForecast` consumes weather (Open-Meteo via `expo/fetch`, no key needed), recent sales (14d window), weekday, expected guests; outputs `expectedGuests` + per-recipe `recommendations` + rationale. "Apply to menu" patches the day's `MenuDayEntry.plannedCount`.
- **Auto-procurement** — `/procurement` screen + `lib/computations.ts::computeShortages` joins menu × portions × inventory across N days (3/5/7/14), groups shortages per supplier (preferred → category fallback), one-tap creates `OrderDraft`s.
- **Shift handover** — `/handover` screen with web Speech API voice input (graceful fallback on native) → `aiHandover` summarises + extracts action items → stored as `HandoverNote[]`.
- **Reste-Rezepte** — `/reste` screen picks expiring inventory → `aiResteRezepte` returns 3 recipes with match score, ingredients, steps. Quick button on Lager tab.
- **LMIV poster** — `/aushang/[id]` screen + `lib/pdf.ts::aushangHtml` exports brand-styled A4 poster with nutrition (kcal/P/KH/F), CO₂e per portion, allergens, DGE colour. Recipe detail has new "LMIV · CO₂ · DGE" card with `aushangCreate` button.
- **Margin alerts** — `/margin` screen sorts recipes by margin %, flags `<35%` or rising-cost trend (computed from `IngredientPriceHistory` deltas). Home widget surfaces alert count. `recipeMargin()` records each price change automatically when `updateInventory` detects a change.
- **Supplier scorecard** — Supplier detail page now shows score (0-100), on-time %, accuracy %, complaint count using `supplierScore(deliveries, complaints)`; A/B/C badge.
- **Tray-return analysis** — `/scan` gains "Tablett" mode → `aiTrayReturn` (vision) returns dish guess, leftover %, estimated grams, hypothesis why.
- **Catering offer** — `/catering` cards now show per-person price + total (× guests) computed from selected recipe blocks.
- **Team leaderboard** — `/leaderboard` ranks employees by combined score (sales × 1, HACCP × 2, low-waste bonus); medal styling for top 3.

New types (`types.ts`): `Location`, `HandoverNote`, `SupplierDelivery`, `IngredientPriceHistory`, `ForecastDay`, plus `kcalPer100g/proteinPer100g/carbsPer100g/fatPer100g/co2PerKg/dgeCategory/bio/regional/locationId` on `InventoryItem` and `portionOverrides/plannedCount` on `MenuDayEntry`.

New AppContext actions: `setCurrentLocation`, `addLocation`, `updateLocation`, `removeLocation`, `addHandover`, `addDelivery`, `updateDelivery`, `addPriceHistory`, `upsertForecast`. Hydration merges all new arrays defensively.

New helpers (`lib/computations.ts`): `recipeCost`, `recipeMargin` (with trend), `supplierScore`, `recipeCo2Kg`, `recipeNutrition`, `recipeAllergens`, `dgeCategory`, `computeShortages`, `leaderboard`, `fetchWeather` (Open-Meteo).

## Mobile structure

- `app/(tabs)/` — Home, Lager (inventory), Karte (menu), Statistik, Mehr.
- `app/chat.tsx` — Streaming AI assistant (SSE).
- `app/scan.tsx` — Camera/library photo capture for receipts, delivery notes, dish nutrition.
- `app/recipe/[id].tsx`, `app/supplier/[id].tsx` — detail screens.
- `app/{calculator, haccp, waste, suppliers, catering, settings}.tsx` — operational tools.
- `contexts/AppContext.tsx` — single reducer over `AppState`, persisted to AsyncStorage.
- `constants/{colors,i18n,seedData}.ts` — charcoal+amber theme, DE/EN dictionary, demo data.
- `lib/ai.ts` — fetch-based SSE client (uses `expo/fetch`).

## AI

- Model: `gpt-5.4`, `max_completion_tokens` only (no `temperature`).
- Chat: streamed via SSE (`data: {"content": "..."}\n\n`).
- Vision: chat-completions with `image_url: data:image/jpeg;base64,...`.
- System prompt is built per request from current low-stock items + recipe list, locale-aware.

## Persistence

- AsyncStorage key `kitchenos.state.v1`. Reducer hydrates on mount and persists on every state change.
- Hydration merge respects explicit empty arrays (only falls back to seed when a top-level key is `undefined`).

## Theme

- Charcoal + amber (`#0a0a0b` / `#f59e0b`) with full light/dark palettes (system-controlled).
- Inter font family loaded via `@expo-google-fonts/inter`.

## i18n

- DE (default) / EN, switched in Settings.
- Strings in `constants/i18n.ts`; `useT()` hook in `AppContext`.

## Server

- `routes/ai.ts` mounted from `routes/index.ts`.
- `express.json({ limit: "50mb" })` to accept base64 image payloads.
- Endpoints:
  - `POST /api/ai/chat` — SSE streaming chat completions.
  - `POST /api/ai/vision` — chat completion with image_url for OCR/nutrition.
  - `POST /api/ai/json` — JSON-mode completion (response_format: json_object). Used by the receipt parser and weekly menu generator.

## Phase 2 features

- **AI menu generator** — `Generieren` button on Karte calls `/api/ai/json`, returns 7 days × recipe IDs balanced for vegan/meat rotation and prioritising low-stock ingredients, then dispatches `setMenu` per day.
- **Receipt → Inventory import** — `/scan` in `Rechnung`/`Lieferschein` mode parses the photo into structured items and offers a checklist; selected items are imported with `addInventory` and the user is redirected to Lager.
- **Voice chat** — `lib/voice.ts` wraps the Web Speech API (web only). The mic button in `/chat` records, auto-fills the input on partials, and auto-sends on final transcript. A `Vorlesen` toggle uses `SpeechSynthesis` to read assistant replies aloud; per-message replay icon also available. Native gracefully shows an info alert.
- **Daily sales entry** — `/sales` screen with a 5-day strip, today's menu (or top 6 recipes) listed with `+/-` Gekocht/Verkauft steppers, live revenue total, batch-saves via `addSale`.

## Phase 3 features

- **Catering email AI parser** — `/catering` has a `Neue Anfrage` modal: paste an enquiry → `parseCateringEmail` (`/api/ai/json`) extracts customer, date, guest count, dietary requirements, and groups dishes into 1–3 menu blocks with matched recipe IDs. Saved as a `CateringRequest` with Bestätigen/Ablehnen actions.
- **Auto-distribute orders by supplier** — Inventory shows a yellow "Bestellung erstellen (N)" call-out when items are below `minQuantity`. Tapping calls `distributeOrder`, which groups shortages by best-matching supplier (honouring `preferredSupplierId` and category fallback) and creates one `OrderDraft` per supplier. The new `/orders` screen lists drafts and sent orders with mailto sending in DE/EN templates.
- **Zettle Z-report OCR** — `/zettle` lets the user photograph the daily Tagesabschluss (or import from gallery). `parseZettleReport` returns each line item with sold count + revenue and matches names to recipe IDs. "In Verkäufe übernehmen" bulk-creates `SaleEntry` rows tagged `source: "zettle"`. Native API integration is stubbed with a "bald" badge.
- **Personalised portion sizes** — `/sales` recipe cards now have a third `Portion g` field next to Gekocht/Verkauft (10g step). Saved on the `SaleEntry.portionGrams` and, when changed from the recipe default, also writes back to `Recipe.portionGrams` so future days inherit it.
- **Per-dish cooked vs sold** — `/stats` has a new "Pro Gericht" card with paired horizontal bars per recipe and a colour-graded loss percentage (green ≤8%, amber ≤15%, red >15%) over the selected range.

## State additions (Phase 3)

- `AppState.orders: OrderDraft[]` — supplier order drafts with status `draft|sent|received`.
- `MenuDayEntry.portionOverrides?: Record<recipeId, grams>` — reserved for future per-day portion plans.
- `SaleEntry.portionGrams` and `SaleEntry.source` (`manual|zettle|ai`) — exact portion served and provenance.
- `CateringRequest.dietary` — free-text dietary requirements extracted by the parser.
- New AI helpers in `lib/ai.ts`: `parseCateringEmail`, `parseZettleReport`, `distributeOrder` (all backed by `/api/ai/json`).
- New screens: `app/orders.tsx`, `app/zettle.tsx`. New reducer actions: `addCatering`, `updateCatering`, `addOrder`, `updateOrder`, `removeOrder`.

## Phase 4 features

- **HACCP daily temperature logs** — `/haccp` accepts fridge/freezer/delivery/cleaning/cooking entries with a per-type limit check (fridge ≤7°C, freezer ≤-18°C, cooking ≥65°C). Critical breaches raise an alert and persist `ok=false`. Daily reminder schedulable via Settings.
- **Allergens (LMIV 14) editor** — `app/recipe/[id].tsx` shows the 14 EU allergens as toggleable chips behind an "Allergene bearbeiten" action; toggles dispatch `updateRecipe`. Read mode shows localised badges. Catering offer PDF prints allergen badges per dish.
- **Inventur (stocktake)** — `/inventur` snapshots all inventory quantities (`expectedQty`) when a session is opened. Each item gets a numeric `Ist` field; on close the variance value €(soll-ist)·price is computed, actual quantities are written back via `updateInventory`, and the session is moved to history with status `closed`.
- **PDF / Share export** — `lib/pdf.ts` builds branded HTML for orders and catering offers and uses `expo-print` + `expo-sharing` on native (web fallback opens a print window). Buttons added to every order card and confirmed catering request.
- **Dienstplan (shift planning)** — `/dienstplan` is a weekly grid (Mon–Sun) per employee. Tap a day to open a bottom-sheet that adds/removes shift times. Tap an employee row to edit their name, role, weekly hours, phone. Long-press to delete (cascades shifts). Weekly hours target vs planned shown as a badge (success/warning/destructive).
- **Push notifications** — `lib/notifications.ts` wraps `expo-notifications` with calendar triggers. Settings screen has a toggle that requests permission and reschedules: Tagesabschluss-Erinnerung (configurable HH:mm), HACCP-Erinnerung (HH:mm), Knapper Bestand at 09:00 (only fires if there are items below min), Bald abgelaufen at 09:30 (≤2 days). Web is a no-op.

## State additions (Phase 4)

- `AppState.inventurs: InventurSession[]` (`InventurCount[]` rows).
- `AppState.employees: Employee[]` and `AppState.shifts: ShiftEntry[]`.
- `AppState.notificationPrefs: NotificationPrefs` (enabled + 4 channels + 2 HH:mm fields).
- New actions: `addInventur`, `updateInventur`, `removeInventur`, `addEmployee`, `updateEmployee`, `removeEmployee` (cascades shifts), `addShift`, `updateShift`, `removeShift`, `setNotificationPrefs`.
- New screens registered in `app/_layout.tsx`: `inventur`, `dienstplan`. New "Mehr → Operations" entries.
