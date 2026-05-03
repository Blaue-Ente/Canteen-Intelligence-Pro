# KitchenOS

AI-driven kitchen operations app for German restaurants, canteens, and hotels. Built as a cross-platform Expo app (iOS, Android, Web) with a small Express AI proxy.

## Architecture

- `artifacts/mobile/` — Expo Router app (KitchenOS). All UI, state, AsyncStorage persistence.
- `artifacts/api-server/` — Express server. Hosts `/api/ai/chat` (SSE stream) and `/api/ai/vision` endpoints that wrap the Replit OpenAI integration.
- `artifacts/mockup-sandbox/` — design canvas (untouched template).
- `lib/integrations-openai-ai-server` — OpenAI client used by the api-server.

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
