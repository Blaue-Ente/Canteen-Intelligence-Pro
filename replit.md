# KItchenOS

## Overview
KItchenOS is an AI-driven kitchen operations application designed for German restaurants, canteens, and hotels. It aims to streamline various aspects of kitchen management, from menu generation and inventory to HACCP compliance, staff planning, and customer engagement. The project's vision is to leverage AI to optimize efficiency, reduce waste, and enhance the overall dining experience, tapping into the market potential of the hospitality sector. Key capabilities include multi-tenant account management, supplier discovery, client-side AI features for demand forecasting and recipe generation, and a comprehensive guest pre-order system with customer accounts and feedback mechanisms.

## User Preferences
- **Communication Style**: I prefer simple language and detailed explanations. Bulgarian conversational language; code/comments in DE/EN.
- **Workflow**: I want iterative development with each step announced.
- **Interaction**: Ask before making major changes.
- **Codebase Changes**: Do not make changes to the `artifacts/mockup-sandbox/` folder.

## Strategic Roadmap (May 2026 — synthesized from competitor audit)

### Two-Mode Architecture (USER REQUESTED)
The app must support two operating modes selectable in Settings:
- **Voll-Modus (Full)**: cash register + financial/tax (TSE/KassenSichV/DSFinV-K) — legally binding data, official receipts
- **Light-Modus (Lite, default)**: staff/operations assistant only, NO legally binding data — for kitchens that have a separate POS

State: `appMode: "full" | "lite"` in `AppState`. Feature gating via `<FullModeOnly>` wrapper.

### Competitor Positioning
Target: "Apicbase parity + AI voice/vision at ½ price (€120-150/mo vs €250+ Apicbase)".
KitchenOS uniquely has: Kios voice assistant, email→event AI bridge, OSM regional producer discovery — none of Apicbase/MarketMan/MarginEdge/Foodics/Choco have these.

### Audit Findings (May 2026)
**Critical bugs to fix:**
- Float precision in money sums: `eventdetail.tsx:557-580`, `calculator.tsx`, `aggregate.tsx` (need lib/money.ts)
- Manual time inputs without validation: `dienstplan.tsx:290,293`, HACCP
- 401 raw error UX: `customers.tsx`, `aggregate.tsx`
- Hardcoded 19% VAT: `types.ts:358`
- Mocked Settings items: `settings.tsx:430-435`
- i18n key bug: `inventur.tsx:136`

**Professional gaps (vs Apicbase):**
- TSE/KassenSichV missing — LEGAL requirement DE (Voll-Modus T011)
- Allergen propagation from inventory→recipe missing (LMIV violation risk)
- No production batch sheets (mise-en-place with yield scaling) — Apicbase core
- No sub-recipe yield calc
- No master cleaning schedule (only ad-hoc HACCP cleaning)
- No theoretical vs actual food cost variance dashboard

**5 differentiators to ship (none of competitors have):**
1. Kios hands-free cooking commands (timer, recipe step read, portion math)
2. Plate-photo AI waste detection (GPT-4 Vision before/after estimate)
3. WhatsApp/Email supplier price ingest (Outlook integration available)
4. Inspection mode one-tap PDF (combined HACCP+LMIV+cleaning printout)
5. Live energy + CO₂ per dish (ESG-mandatory for DE corporate canteens 2025+)

See `.local/session_plan.md` for full task breakdown T000-T012.

### Roadmap Progress (May 2026 — all 12 tasks complete)
- **T000** Dual-mode foundation (`appMode: "lite" | "full"`, `<FullModeOnly>`, settings UI) ✓
- **T001** Money precision (`lib/money.ts` — toCents/sumMoney/mulMoney/formatEUR) ✓
- **T002** UX/data integrity (native time pickers, friendly 401 cards, i18n fix) ✓
- **T003** Allergen propagation from inventory→recipe (`lib/allergens.ts`) ✓
- **T004** Production batch sheets (`app/production.tsx` + `lib/production.ts`) ✓
- **T005** Master cleaning schedule (`app/cleaning.tsx`, CleaningTask/CleaningCompletion) ✓
- **T006** Kios hands-free cooking (`hooks/useKios.ts` extended + `lib/timers.ts`) ✓
- **T007** Plate-photo AI waste detection (`app/wastecam.tsx`, `/api/ai/waste-vision`) ✓
- **T008** Inspection mode one-tap PDF (`lib/inspectionPdf.ts` + haccp.tsx button) ✓
- **T009** Energy + CO₂ per dish (`lib/sustainability.ts`, recipe detail + dishanalysis) ✓
- **T010** Email/PDF price ingest (`lib/ai.ts::parseSupplierPriceList`, `lib/priceIngest.ts`,
  procurement.tsx UI with anomaly badges and >5 % increase opt-in) ✓
- **T011** TSE / KassenSichV (`api-server/src/routes/tse.ts` HMAC-stub OR fiskaly proxy,
  `mobile/lib/tse.ts`, `app/kasse.tsx` Voll-Modus screen, Z-Bon PDF + DSFinV-K JSON export,
  Settings TseConfig editor). Stub-mode warning shown to operator; FISKALY_API_KEY +
  FISKALY_API_SECRET + FISKALY_TSS_ID + FISKALY_CLIENT_ID env vars activate real
  fiskaly cloud TSE seamlessly. ✓
- **T012** Final verify ✓ (all 4 typechecks clean, only pre-existing benign
  `useColors.ts(21,10)` error untouched per user instruction)
- **T013** HACCP Automation v2 ✓ — превърна HACCP от "ръчен формуляр" в
  "потвърди предложеното":
  - **T013a** Subscription tier foundation: `Subscription` type
    (starter/professional/enterprise + addons.bleThermometers/multiSite/advancedAi),
    AppState.subscription + 1 reducer (setSubscription), `useSubscription()` hook,
    `<RequiresAddon>` gate component, SubscriptionCard в settings.tsx с tier picker
    + 3 addon Switches (BLE +€19, multiSite +€29, advancedAi +€39).
  - **T013b** Auto-suggestions: `lib/haccpAutosuggest.ts` генерира за всяка
    StorageLocation с targetTemp/targetTempMax suggestion на slots 09:00 + 17:00,
    използва median на последните 7 дни ±0.4°C jitter. Нова `HaccpSuggestion` type.
    haccp.tsx "Heute zu bestätigen" секция с карти + 3 бутона
    (Bestätigen 1-tap / Abweichend / Maßnahme). HaccpLog.correctiveAction + suggestionId
    + source полета.
  - **T013c** Auto-log от съществуващи потоци: production batch finalizeBatch() в
    app/production.tsx auto-create cooking HACCP per recipe (source="auto-production");
    orders.tsx receive() (нов "Wareneingang bestätigen" бутон при sent→received
    transition) auto-create delivery HACCP (source="auto-delivery") — moved here
    от procurement.tsx за да съответства на LMHV (логваме при физически Wareneingang,
    не при draft).  History филтър chips (Alle/Auto/Manuell) + provenance Badge +
    corrective display.
  - **T013d** Rückstellproben (LMHV §11, 7 дни): `FoodSample` type, 7 reducers
    (add/addMany/update/remove/purgeExpired + setSampleStorage), `lib/foodSamples.ts`
    (buildSamplesForBatch 100g default + pendingToday + isExpired). Production save
    автоматично създава 1 проба/100g на recipe в "Probenkühlschrank" storage location
    (`sl-fridge-proben` в seedData). Proben секция в haccp.tsx с countdown + "Genommen"
    confirm + "Aufräumen" cleanup бутон.
  - **T013e** Bluetooth thermometer (paid addon): `lib/bleThermometer.ts` mock
    provider симулира 2 устройства (Inkbird IBT-2X 4.5°C + Thermapen ONE 72°C) със
    streaming на 5s интервал + jitter; real `react-native-ble-plx` provider стуб
    в коментар (изисква custom dev build). `useBleThermometer()` hook.
    haccp.tsx Live-Thermometer Card обвит в `<RequiresAddon name="bleThermometers">` —
    показва +€19/Monat CTA ако не е активно. captureBleReading promote-ва текущ
    read към HaccpLog с source="ble".
  - **T013f** Final verify ✓ (typecheck минава clean без новите файлове да въвеждат
    грешки; pre-existing useColors.ts(21,10) untouched per user instruction; screenshot
    /haccp потвърждава 8 видими auto-suggestion карти с 3-button workflow).
  - Files: `mobile/types.ts`, `mobile/contexts/AppContext.tsx`,
    `mobile/constants/seedData.ts`, `mobile/hooks/useSubscription.ts` (нов),
    `mobile/hooks/useBleThermometer.ts` (нов), `mobile/components/RequiresAddon.tsx`
    (нов), `mobile/lib/haccpAutosuggest.ts` (нов), `mobile/lib/foodSamples.ts` (нов),
    `mobile/lib/bleThermometer.ts` (нов), `mobile/app/haccp.tsx` (rewrite),
    `mobile/app/production.tsx` (finalizeBatch), `mobile/app/procurement.tsx`
    (addOrder auto-HACCP), `mobile/app/settings.tsx` (SubscriptionCard).

### T014 — DGE-Qualitätsstandard Compliance Scoring (Public-sector USP)
Уникален USP за немски публичен сектор (Schul-/Kita-/Krankenhaus-/Senioren-
Verpflegung). Никой конкурент (Apicbase, Foodics, MarketMan, Choco) няма
автоматичен DGE scoring. Отваря тръжен сегмент където DGE-сертификация е
често задължителна.
- **T014a** Foundation: `DgeStandard` ("schule"|"kita"|"krankenhaus"|"senioren"),
  `DgeCriterionResult`, `DgeScore` types + `AppState.dgeStandard` + `setDgeStandard`
  reducer (persisted via pick()). `lib/dge.ts` (~480 lines) с DGE_RULES per
  standard (Schule: ≥3 wholegrain, ≥5 veg/wk, ≥3 raw/fruit, ≥2 fruit, ≥1 legume,
  ≥1 sea fish, ≥2 vegetarisch, ≤1 red meat, ≤1 fried; Kita: + daily fruit+dairy,
  0 fried; Krankenhaus: ≥7 veg/fruit, ≥5 wholegrain, ≤2 red meat; Senioren:
  soft texture suppe/eintopf ≥3, ≥7 fruit, ≥5 dairy). `classifyRecipe()` чете
  `recipe.meat`/`category`/`allergens`/`ingredients` (lookup в inventory) и
  steps text → 11 feature flags (wholeGrain/vegetable/rawVeg/fruit/legume/redMeat/
  fried/seaFish/vegetarianOrVegan/dairy/softTexture). `scoreMenu({ menu, recipes,
  inventory, fromDate, toDate, standard, isDe })` пер-day OR-merge → counts distinct
  days → binary met/not-met → weighted overall 0-100 + recommendations[].
- **T014b** UI: `app/dge.tsx` (~360 lines) — standard picker chips, 7-day window
  toggle (this/next), big numerical gauge (зелено ≥80, жълто 60-79, червено <60)
  с linear bar, criteria breakdown с green/red icon + Badge + counter, auto
  recommendations list, empty state ако `daysWithMenu===0`, "all met" success
  card. Floating CTA "als Standard aktivieren" за first-time users. Stack.Screen
  registered в `_layout.tsx`.
- **T014c** Entry-points: settings.tsx `DgeStandardCard` (Off + 4 standard chips
  + Open link); menu.tsx live Badge "DGE 78/100" в planner header (color по score)
  с tap → /dge — само ако `state.dgeStandard` set; more.tsx нов entry "DGE-
  Qualitätsstandard" в legalDocs section с award icon + tint #059669.
- **T014d** PDF certificate: `lib/dgePdf.ts` (`dgeCertificateHtml()`) — full
  audit-friendly one-pager с brand header, operator + standard + period meta
  grid, color-coded gauge bar, criteria table (threshold/current/result), ден-
  по-ден menu breakdown, dual signature block, и DGE disclaimer. Reuse `sharePdf()`
  от lib/pdf.ts (web → print dialog, native → expo-print + share sheet).
  Бутон "Zertifikat erstellen (PDF)" в /dge само ако menu е planned.
- **T014e** Verify: typecheck clean (0 нови грешки, само pre-existing useColors.ts:21);
  screenshot /dge показва Schulverpflegung 68/100 с 6/9 criteria в действителен
  state.
- Files: `mobile/types.ts` (+DgeStandard/DgeCriterionResult/DgeScore + AppState.
  dgeStandard), `mobile/contexts/AppContext.tsx` (+setDgeStandard), `mobile/lib/
  dge.ts` (нов, ~480), `mobile/lib/dgePdf.ts` (нов, ~220), `mobile/app/dge.tsx`
  (нов, ~380), `mobile/app/_layout.tsx` (+Stack.Screen), `mobile/app/settings.tsx`
  (+DgeStandardCard), `mobile/app/(tabs)/menu.tsx` (+live Badge), `mobile/app/
  (tabs)/more.tsx` (+DGE entry).

### T-IA — Mehr-Menü Information-Architecture Reorg + Gebrauchsanleitung (May 2026)
Преди: Mehr-меню имаше 8 секции от които една ("Operations") с 19 смесени
entries, плюс 3 single-item секции (Filialen / Öko / Settings). Нови T013/T014
екрани (production, cleaning, kasse, dge, wastecam, aushang) бяха разпръснати
без структура, и липсваше in-app help screen.
- **IA reorg**: 8 mental-model-conformant sections според ежедневния workflow на
  кантинния lead — KI-Assistent / Tagesgeschäft / Küche & Produktion / Einkauf
  & Lager / Gäste & Verkauf / Qualität & Recht / Insights & Berichte /
  Administration. Всички section titles през i18n (`secKiAssistent`,
  `secDailyOps`, `secKitchenProd`, `secPurchaseStock`, `secGuestsSales`,
  `secComplianceQuality`, `secInsightsReports`, `secAdmin`). T013/T014 entries
  (production, cleaning, kasse, dge, wastecam, aushang) интегрирани в правилните
  секции. Нов Hilfe entry в Administration с tint #0ea5e9.
- **Gebrauchsanleitung** (`/help`): structured in-app user manual за всички 41
  функции. `constants/helpTopics.ts` (~620 lines) с HelpTopic[] (id, section,
  icon, title, what, when, howTo[], tips[], optional screen, optional related[],
  keywords). 8 секции огледално на Mehr-меню. `app/help.tsx` (~470 lines) —
  client-side full-text search (title + keywords + content), section filter
  chips с counts, accordion TopicCards с: 30-second elevator pitch ("what"),
  use-case section ("when"), numbered how-to steps, yellow tip block
  (#fef3c7/#fde68a/#92400e), related cross-jump bubbles (auto-expand при tap),
  "Öffnen" shortcut button → router.push(screen), Kios footer card. Всички
  данни client-side, no network, full-text search instant. Stack.Screen
  registered с title "Gebrauchsanleitung".
- **Tip-content guideline**: всеки topic има 1-3 практични съвета от реалния
  кухненски ден (не product marketing); пример Production: "Pflicht ab 50
  Portionen pro Tag in Gemeinschaftsverpflegung — bei Verdacht auf
  Lebensmittelvergiftung sind sie der einzige Beweis."
- **i18n**: добавени 8 section keys + 10 help keys + `team` (липсваше в DE/EN
  dict) + `helpSearch` placeholder с escaped quotes за нативно cross-platform.
- Files: `mobile/constants/i18n.ts` (+8 sec + 10 help + team keys per locale),
  `mobile/constants/helpTopics.ts` (нов, ~620), `mobile/app/help.tsx` (нов, ~470),
  `mobile/app/_layout.tsx` (+help Stack.Screen), `mobile/app/(tabs)/more.tsx`
  (пренаписан с 8-section IA + Hilfe entry).

## System Architecture

KItchenOS is built as a cross-platform Expo app for iOS, Android, and Web, complemented by an Express.js API server.

### UI/UX Decisions
The mobile application features a charcoal and amber theme (`#0a0a0b` / `#f59e0b`) with full light/dark mode support, controlled by the system. The Inter font family is used throughout the application. The guest pre-order web app (`artifacts/preorder/`) utilizes a warm amber/orange palette with Outfit/Playfair fonts.

### Technical Implementations
- **Frontend (Mobile)**: Expo Router app (`artifacts/mobile/`) handles all UI, state management, and AsyncStorage persistence.
- **Frontend (Pre-order Web)**: React + Vite application (`artifacts/preorder/`) for guest pre-ordering.
- **Backend**: An Express.js server (`artifacts/api-server/`) hosts AI-related endpoints and guest pre-order functionalities.
- **Authentication**: Integrates Clerk for user authentication, managing organizations, memberships, and invites. `expo-secure-store` is used for token caching on native platforms.
- **AI Integration**: Utilizes `gpt-5.4` for AI functionalities, with specific endpoints for chat completions (`/api/ai/chat`), vision-based tasks (`/api/ai/vision`), and JSON-mode completions (`/api/ai/json`).
- **State Management**: A single reducer over `AppState` is used, persisted to AsyncStorage upon every state change.
- **Internationalization**: Supports German (default) and English, with strings managed in `constants/i18n.ts` and accessed via a `useT()` hook.

### Feature Specifications
- **Multi-tenant Accounts**: Organizations, memberships (owner/manager/staff roles), and invitation system.
- **Supplier Discovery**: Integrates with Overpass and optionally Google Places for discovering food suppliers in specific regions.
- **HACCP Management**: Features for tracking storage locations, temperature logs, and allergen information (LMIV 14).
- **Menu and Recipe Management**: AI-driven menu generation, editable sell prices, menu OCR, and structured dish vision for nutrition analysis.
- **Inventory and Waste Management**: Receipt scanning for inventory import, auto-procurement based on shortages, and `Reste-Rezepte` for using expiring ingredients.
- **Demand Forecasting**: AI-powered demand forecasting based on weather, sales data, and expected guests.
- **Staff Management**: Shift planning (`Dienstplan`) and team leaderboards.
- **Sales and Reporting**: Daily sales entry, Zettle Z-report OCR, margin alerts, and multi-location rollup reports.
- **Lokale Erzeuger** (`app/producers.tsx`): Search screen for local small/medium agricultural producers via OpenStreetMap Overpass API. 10 categories: Bauernhof, Gemüsegärtner, Obstanbau, Milchbetrieb, Käserei, Getreidemühle, Bio-Betrieb, Direktvermarktung, Hofmetzgerei, Imkerei. Results sorted by GPS distance. One-tap save as regional supplier (adds "regional" tag). Info box explains CO₂/freshness benefits. API endpoint: `GET /api/producers/discover?category=&lat=&lng=`. Backed by same `supplierDirectory` DB table with `producer_<cat>` category prefix. Linked from Mehr → Operations.
- **Nachhaltigkeit & Öko Wizard** (`app/okowizard.tsx`): Eco-sustainability advisor with 10 daily challenges (Fleischfreier Tag +20, Resteverwertung +15, Regional bestellen +25, Kühlkette prüfen +10, Portionsgenauigkeit +30, Saisonale Zutaten +20, Bio einkaufen +20, Plastik reduzieren +15, CO₂ auszeichnen +25, Reste spenden +30). Each challenge shows difficulty badge (easy/medium/hard), points, CO₂ savings estimate, optional note field, and "Erledigt" button. Score persisted in `state.okoProgress`. 5 medal tiers: 🌱 Grüner Einsteiger (0), 🥉 Nachhaltigkeits-Lehrling (100), 🥈 Öko-Praktiker (300), 🥇 Klimaschützer (600), 💎 Umwelt-Champion (1000). Level-up alert on tier change. History tab shows all completed challenges with delete option. Can be enabled/disabled in Settings. Linked from Mehr → Nachhaltigkeit & Öko section.
- **Gericht-Analyse** (`app/dishanalysis.tsx`): Dish performance scorecard for last 90 days. Composite score per recipe = 40% sold volume + 30% margin% + 20% low waste + 10% revenue. Shows: total KPI stats, Top-Verkäufe bar chart (top 8 by sold), Top-Performer list (top 5, ranked), Kandidaten zum Streichen (bottom 3 candidates to drop from menu), full scorecard with all dishes, and a KI-Analyse section that calls `aiDishAnalysis()` for structured AI recommendations (topDishes to keep, dropDishes to cut, action tips). Linked from Mehr → Berichte.
- **Berichte & Auswertungen** (`app/reports.tsx`): Comprehensive kitchen analytics screen with 6 sections — (1) KPI-Vergleich (this vs last week/month: Umsatz Δ%, Portionen Δ%, Verlustquote Δ%, Ø pro Tag), (2) Abfall-Analyse (waste by reason as HBars + 7-day cost trend), (3) Wareneinsatz & Lager (stock value by category pie, food cost ratio last 30 days, expiring ≤7d/≤14d/belowMin alerts), (4) Catering-Pipeline (events by status with count+value, paid/open invoices, monthly revenue BarChart last 6 months), (5) HACCP-Konformität (compliance % last 30 days, logs by check type, 7-day logs trend), (6) Wochentag-Performance (avg revenue per weekday Mon–Sun over 90 days, best day highlighted). Linked from Mehr → Berichte section.
- **Menu Multi-Select Picker** (`app/(tabs)/menu.tsx`): The recipe picker modal stays open after adding a dish — each recipe row acts as a toggle (tap to add, tap again to remove). Added dishes show a filled green circle with ✓, unselected show empty + circle. A "X Gericht(e) ausgewählt / Fertig" bar appears at the top of the list when any dishes are selected, allowing closing the modal when done.
- **Statistics by Day + Year** (`app/(tabs)/stats.tsx`): Five range options: Heute / Tag / Woche / Monat / Jahr. "Tag" mode shows a navigable 14-day chip strip with ◀▶ arrows that shift the window 14 days at a time — full 1-year history is navigable. "Jahr" mode shows a 12-month BarChart of sold vs cooked portions and a second monthly revenue chart. Weekly bar chart is hidden in Tag/Jahr modes. Per-dish detail hidden in Jahr mode (too granular).
- **Sales 1-Year Retention** (`contexts/AppContext.tsx`): `addSale` reducer automatically prunes entries older than 365 days when a new sale is added. On app load (hydrate), loaded sales are also filtered to the last 365 days so previously accumulated data is cleaned up. Other fields retain their own caps (handovers: 200, forecasts: 60, priceHistory: 500).
- **Tablet Layout** (`app/(tabs)/_layout.tsx`): `useWindowDimensions()` detects screens ≥768px wide. On tablets the tab bar is 68px tall (vs phone default), icons are 24px (vs 20px), and labels are 12px. Content screens use flex/gap layouts that naturally scale to wider screens.
- **Customer Engagement**: Guest pre-order system, customer accounts (regular, business), guest feedback with multi-criteria ratings, and catering offer generation.
- **Pre-order Customer Accounts**: Full Clerk-auth customer flow in the preorder web app. `customerProfilesTable` stores `clerkUserId`, `displayName`, `email`, `homeLocationCode`, `accountType` (regular/business_pending/business_approved/rejected). Customers register, request business approval, and staff approve/reject via mobile. Only `business_approved` accounts can place orders. 08:00 Europe/Berlin cutoff enforced on both server and client.
- **Order Self-Service**: Customers can view/cancel/edit their own orders before the 08:00 cutoff from both `/my-orders` (web) and the mobile aggregate view. Cutoff calculation uses iterative DST-safe algorithm.
- **Staff Customer Management (mobile)**: `app/customers.tsx` — tabbed view (Pending/Approved/Rejected) with approve/reject buttons calling `PATCH /preorder/staff/customers/:id`. Auth-gated (401 expected when not logged in).
- **Daily Aggregate (mobile)**: `app/aggregate.tsx` — queries `GET /preorder/staff/orders/aggregate?locationCode=&date=` to show totals by dish and per-customer breakdown. Auth-gated staff view.
- **OpenAPI + Codegen**: All customer/staff endpoints defined in `lib/api-spec/openapi.yaml`. Orval codegen generates typed hooks: `useGetCustomerProfile`, `useUpsertCustomerProfile`, `useListCustomerOrders`, `useCancelOwnOrder`, `useUpdateOrderItems`, `useListStaffCustomers`, `useDecideStaffCustomer`, `useGetStaffOrdersAggregate`.
- **Event Invoicing (Rechnung)**: Each CateringEvent now has `invoiceNo`, `invoiceDate`, `paymentDueDays`, `invoicePaid` fields. `eventInvoiceHtml()` in `lib/pdf.ts` generates a formal DE Rechnung PDF (company letterhead from `CompanyProfile`, itemised positions, VAT breakdown, IBAN payment block). Share via `sharePdf()` directly from the event detail screen.
- **Transport Checklist (Transportcheckliste)**: `eventTransportChecklistHtml()` in `lib/pdf.ts` calculates GN 1/1 container counts per dish (ceil(portions/20) for hot, ceil(portions/25) for cold), shows temperature zone per item (min +65°C / max +7°C), HACCP signature field, and totals per vehicle type. Share button in event detail.
- **CRM Light**: `app/crm.tsx` — groups all events by clientEmail (fallback: clientName), shows event count, total revenue, unpaid invoice count per client, expandable list of their events with status indicator and navigation to event detail. Linked from Mehr → Operations.
- **Company Profile**: Stored in `AppState.companyProfile?: CompanyProfile`. Editable in Settings screen. Used as sender block on invoices.
- **Demo Account**: Settings screen has a "Demo-Daten laden" button that dispatches `loadDemoData` and populates 5 realistic catering events (Hochzeitsfeier Müller-Braun 180 Gäste, Firmenevent TechAG 85 Gäste, Stadtfest 350 Gäste, Jubiläum Dr. Schmidt completed+paid, Weihnachtsfeier enquiry) plus the KüchenMeister GmbH company profile.
- **Kios Voice Assistant** (`hooks/useKios.ts`, `lib/kios.ts`, `lib/voice.ts`, `components/KiosBar.tsx`, `artifacts/api-server/src/routes/ai.ts`): Always-on ambient voice assistant for the iPad kitchen companion. Wake word "Kios" with 9 fuzzy variants. Status pill floats above tab bar (off/idle/awake/thinking/speaking). Web-only.
  - **Massive coverage**: NAV_MAP covers all 38 app destinations (home, inventory, menu, stats, more, sales, zettle, orders, procurement, inventur, dienstplan, suppliers, producers, catering, events, calculator, waste, reste, preorder, customers, aggregate, rollup, priceserver, crm, forecast, handover, margin, leaderboard, reports, dishanalysis, okowizard, locations, haccp, scan, chat, recipe, team, settings, aushang). QUICK_COMMANDS has 38 regex patterns for instant navigation without AI round-trip.
  - **Rich AI context** (`buildKitchenContext`): today's portions/revenue/leftovers, today's & tomorrow's menu, 14-day sales top 10, expiring inventory (≤3 days), low stock with detail, upcoming catering events (30 days) with status, today/tomorrow event count, today's waste cost, open catering requests, open orders, today's handovers, low-margin recipes, today's HACCP entries, recipe/supplier/location/employee counts, **subscription tier + app mode** (T013), **active Rückstellproben count + today new + pending-not-taken** (T013, LMHV §11), and **DGE compliance line** (T014: "DGE-Standard schule: 68/100 (teilkonform), 3 Kriterien offen") via memoized scoreMenu(next7DayWindow). AI prompt has detailed area descriptions and example Q&As to ground responses in real numbers.
  - **T013/T014 nav additions** (`useKios.ts` NAV_MAP + QUICK_COMMANDS): `production` (Chargen / Rückstellproben), `cleaning` (Reinigungsplan), `kasse` (TSE / KassenSichV — Full-Modus only), `dge` (DGE-Score + Zertifikat). Quick patterns match natural German phrases ("Rückstellprobe nehmen", "Reinigung erledigt", "Rechnung schreiben", "DGE-Score", "Schulverpflegung") so they bypass the AI round-trip.
  - **Premium TTS via ElevenLabs** (`artifacts/api-server/src/lib/tts.ts`, `POST /api/ai/tts`): Server uses ElevenLabs Multilingual Turbo v2.5 model (~250ms TTFB, native German). Default voice "Sarah" (warm female, ID `EXAVITQu4vr4xnSDxMaL`); also supports "charlotte" and "antoni". Voice settings: stability 0.45, similarity_boost 0.8, style 0.15, speaker_boost true — tuned for canteen/kitchen warmth.
  - **Server-side disk cache** (`/tmp/kitchenos-tts-cache/<sha1>.mp3`): content-addressed by SHA1(model|voice|text). Cache HIT serves in **~7ms** (verified) vs ~460ms for new generation — 65× speedup, zero ElevenLabs cost on repeats. Cached files survive across container restarts within a session. `Cache-Control: public, max-age=604800, immutable` lets browser HTTP cache + CDN serve the same blob across page reloads.
  - **Pre-warm at session start** (`POST /api/ai/tts/prewarm` + `prewarmTtsCache()` client helper): when the user enables Kios, the client fires a single fire-and-forget request that queues all 45 static Kios German phrases (45 navigation confirmations, "Ja?", "Verstanden.", error messages) for background generation. By the time the user finishes their first wake-word command, every reply is already cached and plays instantly. Concurrency limited to 2 to respect ElevenLabs rate limits.
  - **High-quality client TTS** (`speakHQ` in voice.ts): tries server (ElevenLabs MP3 via HTML5 Audio, in-memory LRU cache of 30 utterances → revoked Object URLs), falls back to Web Speech with smart German voice selection (Google/Enhanced → online non-localService → iOS Anna/Helena/Petra/Markus → any German voice). Server-unavailable state cached for 60s.
  - **Safari/iOS PWA support — Web Audio API path** (`primeAudio`, `speakHQ`, `prefetchKiosPhrases` in `lib/voice.ts`): Two earlier attempts (one-shot silent-MP3 unlock; persistent `<audio>` element with src swapping) both failed on Safari iOS — the first reply played but every subsequent one was silent. Root cause: Safari strips user-activation grants from `HTMLAudioElement` instances after the first `ended` event fires, even on a "persistent" element. The fix is **AudioContext**: a single shared `_audioCtx` created and `.resume()`'d synchronously inside the user gesture (Kios pill tap, settings voice picker, "Hören" test button). Once unlocked, AudioContext stays blessed for the entire page lifetime — **all** subsequent playback uses fresh `AudioBufferSourceNode` instances which `start()` immediately from any async callback (timer, fetch, speech-recognition event) without further gestures. This is the documented Safari workaround (https://webkit.org/blog/6784/new-video-policies-for-ios/). Audio is fetched as `arrayBuffer`, decoded once via `_audioCtx.decodeAudioData`, and the resulting `AudioBuffer` is cached (LRU 30, replacing the prior blob-URL cache) — playback skips both network AND decode. **Client-side prefetch** (`prefetchKiosPhrases`) decodes the 15 hottest phrases ("Ja?", "Statistik wird geöffnet.", quick-command replies, error fallback, …) into AudioBuffer cache during `enable()` so the first reply plays with zero latency. Recognition uses `continuous: !isSafari()` (single-shot + auto-restart on Safari for stability). Chrome 15-second TTS cutoff workaround (pause/resume every 12 s) is skipped on Safari. AudioContext is defensively re-`resume()`'d on each `speakHQ` in case Safari suspended it (e.g. after backgrounding the tab).
  - **Phase bug fix**: `startListening(initialPhase)` — after "Ja?" plays, recognition restarts in "question" phase (not "wake") so the user's actual question is captured.
  - **T015 — Smart Kios v4** (`useKios.ts` extended): two new phases `"followup"` and `"confirm"` extend the wake/question/ai machine.
    - **Continuous conversation**: after every Kios reply (handsFree / quick / AI / smart), `scheduleFollowup(300)` arms a 10-second window (`FOLLOWUP_WINDOW_MS`) during which any final transcript >2 chars is treated as a question — NO wake word required. Hard TTL demotes back to `"wake"` on silence so a stranger can't accidentally trigger commands later.
    - **Smart deterministic lookups** (`handleSmartLookups`, runs BEFORE handleHandsFree): five intents that bypass both quick-commands and AI:
      - **Contact phone**: "Telefonnummer von X" / "Ruf X an" → searches `state.suppliers` (name + contact), `state.employees`, `state.events.clientName/clientPhone`. Speaks "X, Lieferant: 0151...".
      - **Recipe kcal**: "Kalorien hat X" → `recipe.kcalPerPortion` (or "keine Angabe").
      - **Recipe allergens**: "Allergene hat X" → `ALLERGEN_DE` map (gluten→Gluten, milk→Milch, ...) joined as "Gluten, Milch und Ei".
      - **Recipe price**: "Wie teuer ist X" → `recipe.sellPrice` formatted as "5,90 Euro".
      - **Recipe diet**: "Ist X vegan/vegetarisch/fleisch/fisch" → `recipe.category` check with Ja/Nein answer.
    - **Order item mutations with mandatory Ja/Nein confirm** (`PendingAction`, `scheduleConfirm`, `executePendingAction`): "Füge 5 Liter Milch zur Bestellung hinzu" / "Entferne Brot aus der Bestellung" parses qty+unit via `parseQtyUnit` (kg/g/Liter/Stück/Packung/...), resolves to oldest `status==="draft"` `OrderDraft`. Speaks "Soll ich ... bei METRO ...? Sage Ja oder Nein.", arms 30-second confirm window. On "Ja" → re-fetches the live order from current state (so any concurrent UI edits are preserved, not overwritten), dispatches `updateOrder`. On "Nein" → "Abgebrochen.". Ambiguous Ja+Nein → "Bitte antworte nur mit Ja oder Nein." (keeps TTL alive). On TTL expiry → silent cancel + back to `"wake"`. Remove uses substring-match by name at execute time, not stale index, so reordered items don't get the wrong line deleted.
- **Notifications**: Push notifications for daily tasks, HACCP reminders, low stock, and expiring items.

### System Design Choices
- **API Design**: OpenAPI specification (`lib/api-spec/openapi.yaml`) defines all API endpoints, with Zod for runtime validation.
- **Database Schema**: PostgreSQL database with schemas for organizations, memberships, supplier directory, published menus, guest orders, guest feedback, customer profiles, and various operational data (sales, HACCP, waste, inventory, shifts).
- **Modularity**: Codebase is structured into `artifacts/` for distinct applications (mobile, API server, pre-order web) and `lib/` for shared utilities and integrations.

## External Dependencies

- **Clerk**: Authentication and user management.
- **Expo**: Cross-platform mobile and web application development.
- **Express.js**: Backend API server framework.
- **OpenAI API**: For AI functionalities (`gpt-5.4` model for chat, vision, and JSON-mode completions).
- **PostgreSQL**: Primary database for persistence.
- **Open-Meteo**: For weather data in AI demand forecasting.
- **Google Places API**: (Optional) For enriching supplier metadata.
- **`expo-secure-store`**: Secure storage for tokens on native devices.
- **`react-native-qrcode-svg`**: For generating QR codes.
- **`expo-print` and `expo-sharing`**: For PDF export and sharing functionalities on native devices.
- **`expo-notifications`**: For managing push notifications.
- **Web Speech API**: For voice input and speech synthesis (web only).
### Menu camera surfacing (UX fix)

The AI menu-scanner already existed in `app/scan.tsx` (mode `menu` → `parseMenuImage` → import dishes as recipes), but it was only reachable via the Home QuickAction, the Inventory toolbar, and Mehr → Scan. Users on the Menu tab couldn't find it.
- `app/(tabs)/menu.tsx` — added a camera icon next to the rotate/AI buttons in the toolbar that pushes `/scan?mode=menu`. Also added a prominent "Speisekarte scannen" secondary button to the empty-state card so a fresh day immediately shows the option.
- `app/scan.tsx` — now reads `?mode=` via `useLocalSearchParams` (`menu | nutrition | tray | delivery`) so deep-links open in the requested mode (default still `receipt`).

### PDF menu support (Phase 6B #5)

The menu scanner now also accepts PDF menus, not only photos.
- **Server** (`artifacts/api-server/src/routes/ai.ts`): new `POST /api/ai/parse-menu-pdf` accepts `{base64, locale}`, extracts text via `pdf-parse@1.1.1` (imported from `pdf-parse/lib/pdf-parse.js` to skip its broken `index.js` self-test), truncates to 24k chars, sends to OpenAI in JSON mode with the same dish-extraction prompt as the image path. Returns `{data: ParsedMenu}`. Caps PDF at 15 MB; rejects scanned/imageonly PDFs with 422 (no extractable text).
- **Mobile** (`artifacts/mobile/lib/ai.ts`): added `parseMenuPdf()` helper.
- **Mobile** (`artifacts/mobile/app/scan.tsx`): in menu mode, the picker card now shows an extra `PDF wählen / Pick PDF` button that uses `expo-document-picker` (PDF only) → `expo-file-system/legacy` to read base64 → `parseMenuPdf` → same dish-picker UI as the image flow.
- **Mobile** (`artifacts/mobile/metro.config.js`): added `resolver.blockList` regex to ignore `pdf-parse` and its install-time `pdf-parse_tmp_*` dirs (those vanish during `pnpm install` and crash Metro's file watcher).
- **Deps**: added `pdf-parse@1.1.1` + `@types/pdf-parse` to api-server (v2 needs `@napi-rs/canvas` + DOM polyfills for pdfjs — overkill for text-only); added `expo-document-picker` and `expo-file-system` to mobile.
- i18n keys: `pickPdf`, `parsingPdf` (DE + EN).

### Cookbook-aware AI assistant (Phase 6B #6)

The AI assistant now behaves like a German Küchenchef with knowledge of hundreds of classic Mensa recipes, plus a one-tap seed bank.
- **Persona** (`artifacts/mobile/lib/ai.ts`): exported `CHEF_PERSONA` preamble that names the canonical books (Dr. Oetker Schulkochbuch, Henriette Davidis, Bayerisches Kochbuch, Mensa-Kochbuch, Tim Mälzer Heimat) and demands realistic Mensa portions / LMIV allergens / kcal. Prepended to `generateWeekMenu` and the new `generateRecipe` helper.
- **Recipe-from-idea**: `generateRecipe({idea, locale})` returns a fully-formed `GeneratedRecipe` (nameDe/name, type, category, meat, portionGrams, allergens, stepsDe/steps, base/sellPrice, cookTime, kcalPerPortion).
- **Seed bank** (`artifacts/mobile/lib/seedRecipes.ts`): 30 hand-written classic German Mensa recipes (Wiener Schnitzel, Sauerbraten, Königsberger Klopse, Rouladen, Schweinebraten, Currywurst, Frikadellen, Gulasch, Hähnchenschnitzel, Kasseler, Käsespätzle, Maultaschen, Bauernfrühstück, Kartoffelpuffer, Spinat-Lasagne, Linsen-Bolognese, Gemüse-Curry, Falafel, Chili sin Carne, Ofengemüse, Forellenfilet, Backfisch, Linsensuppe, Erbsensuppe, Tomatensuppe, Kürbissuppe, Gulaschsuppe, Salate, Apfelstrudel, Kaiserschmarrn, Milchreis) with grams, allergens, kcal, base/sell price.
- **UI** (`artifacts/mobile/app/(tabs)/menu.tsx`): the recipe picker modal header now has a `+ KI-Rezept` action that opens a textarea modal calling `generateRecipe`. When the recipe library is empty, the picker also shows a `Klassiker importieren (30)` button that bulk-imports the seed bank (skips name duplicates, asks for confirmation if recipes already exist).
- i18n keys: `importClassics`, `importClassicsConfirm`, `classicsImported`, `aiRecipe`, `aiRecipePrompt`, `create` (DE + EN).

### Cookbook expansion + Mixer (Phase 6B #7)

The seed cookbook was expanded from 30 German recipes to ~150 across 7 cuisines, and a new "Mixer" feature lets the chef enter or photograph available ingredients to get a single complete recipe suggestion.
- **Seed library** (`artifacts/mobile/lib/seedRecipes.ts`): grouped into named arrays — GERMAN/Austrian (37 incl. Schweinshaxe, Tafelspitz, Zwiebelrostbraten, Käsknöpfle, Topfenstrudel, Sachertorte, Wiener Gulasch), ITALIAN (25 incl. Carbonara, Aglio e Olio, Arrabbiata, Pesto, Lasagne, Pizza Margherita/Funghi/Salami, Risotti, Saltimbocca, Osso Buco, Vitello Tonnato, Caprese, Minestrone, Pasta e Fagioli, Cacio e Pepe, Tortellini in Brodo, Gnocchi alla Sorrentina, Ravioli, Pollo alla Cacciatora, Tiramisù, Panna Cotta, Bruschetta), FRENCH (17 incl. Coq au Vin, Boeuf Bourguignon, Ratatouille, Quiche Lorraine, Bouillabaisse, Cassoulet, Soupe à l'Oignon, Salade Niçoise, Confit de Canard, Steak Frites, Croque Monsieur, Crêpes Suzette, Tarte Tatin, Crème Brûlée, Moules Marinières, Soupe au Pistou, Blanquette de Veau), SPANISH (14 incl. Paella Valenciana/Mariscos, Tortilla, Gazpacho, Patatas Bravas, Gambas al Ajillo, Albóndigas, Pisto, Fabada, Cocido, Pollo al Ajillo, Pulpo a la Gallega, Churros, Crema Catalana), BALKAN (10 incl. Schopska, Tarator, Banitza, Musaka, Sarmi, Kavarma, Ćevapi, Burek, Ajvar, Bob Tschorba), ASIAN (37 — Thai/Vietnamese/Chinese/Japanese/Korean/Indian/Indonesian: Pad Thai, Green/Red/Massaman Curry, Tom Kha/Yum, Som Tam, Khao Pad, Pho Bo, Bun Cha, Bánh Mì, Sommerrollen, Mapo Tofu, Kung Pao, Süß-Sauer, Bratreis, Chow Mein, Wonton, Peking-Ente, Mongolisches Rind, Tonkotsu Ramen, Miso, Teriyaki, Katsu, Gyoza, Yakisoba, Gyudon, Tempura, Bibimbap, Bulgogi, Kimchi-Jjigae, Korean Fried Chicken, Butter/Tikka Masala Chicken, Dal, Biryani, Palak Paneer, Samosas, Nasi Goreng, Satay), AMERICAN BBQ (10 — Pulled Pork, Brisket, Spareribs, Buffalo Wings, Cheeseburger, Mac & Cheese, Coleslaw, Cornbread, Texas Chili, Smoked Sausage). All exported as `SEED_RECIPES` (concatenated). Each entry has portionGrams, allergens (LMIV tokens), kcal, basePrice, sellPrice, cookTimeMin, and bilingual stepsDe/steps.
- **Mixer AI** (`artifacts/mobile/lib/ai.ts`): `generateRecipe` now accepts optional `idea` AND optional `availableIngredients: string[]` — when ingredients are passed, the prompt instructs the chef-persona to pick ONE classic dish from cookbook knowledge that uses MOSTLY those ingredients (assuming basic pantry). Also new `detectIngredientsFromPhoto({base64, locale})` vision helper that returns `{ingredients: string[]}` — concise localized ingredient names from a fridge/counter photo.
- **Mixer UI** (`artifacts/mobile/app/(tabs)/menu.tsx`): the recipe-picker modal header now has a `🥗 Mixer` button next to `+ KI-Rezept`. Mixer modal has: comma-separated ingredients textarea + camera button (uses `expo-image-picker` like scan.tsx → `detectIngredientsFromPhoto` → merges results into the textarea, deduped) + "Rezept vorschlagen" button → `generateRecipe({availableIngredients})` → adds the proposed recipe to the library.
- i18n keys: `mixer`, `mixerSubtitle`, `mixerIngredientsLabel`, `mixerPhotoButton`, `mixerDetected`, `mixerSuggest`, `detecting` (DE + EN).

### Exchange email — текущо ограничение и бъдещ план

Текущата Outlook интеграция (Replit connector) свързва **един** Microsoft 365 акаунт (на разработчика/демо). Подходящо е за тестване и демо.

**Планирано за по-късно:** KItchenOS ще се продава като SaaS на независими оператори. Всеки клиент трябва да свърже **свой собствен** Microsoft 365 акаунт. Нужно е:
1. Регистрация на Azure AD Multi-tenant App (portal.azure.com) — `client_id` + `client_secret` → env vars
2. Нова таблица `org_exchange_tokens` в БД (org_id, access_token, refresh_token, expires_at)
3. OAuth routes: `GET /api/auth/microsoft/start?orgId=` и `GET /api/auth/microsoft/callback`
4. Бутон "Свържи Exchange акаунт" в мобилното (Settings/More)
5. Mail route-овете да използват org-specific токен от БД вместо Replit connector

### Pre-order UX improvements + Catering→Event bridge (Phase 6E)

Three targeted UX improvements across the pre-order web app and mobile.

- **Pre-order landing page** (`artifacts/preorder/src/pages/landing.tsx`): Added sticky header with KitchenOS logo + `AuthNav` (sign-in/profile/orders links visible from the first screen). `SignedOut` users see an "Anmelden / Registrieren" card explaining the benefits of an account. `SignedIn` users see a "Meine Bestellungen" shortcut button.
- **Smart Stamm-Kantine redirect** (`SmartRedirect` component in landing.tsx): When a logged-in `business_approved` customer has a `homeLocationCode` set in their profile, the landing page shows a quick-jump card ("Ihre Stamm-Kantine → Zur Karte") and auto-redirects to `/menu/<code>` on load. Customers with pending/regular accounts see their current status and a link to their profile. Profile loading state shows a spinner.
- **Catering email → Event bridge** (`artifacts/mobile/app/catering.tsx`): New `createEventFromRequest()` function maps a `CateringRequest` (parsed email) to a `CateringEvent`: copies subject→title, fromEmail→clientEmail, date, guests, dietary→notes, and maps all AI-proposed recipe blocks → `EventMenuItem[]` with correct portions and sell prices. Dispatches `addEvent` and navigates directly to `eventdetail?id=<new>` so the chef can immediately refine the menu and generate a PDF offer. New button "Als Veranstaltung anlegen" (icon: calendar) added below the PDF button in every request card.
- **i18n**: `saveAsEvent` key added in DE ("Als Veranstaltung anlegen") and EN ("Create event from request").

### Event Management + AI Offer Generation + Price Server (Phase 6D)

Full catering event lifecycle management with AI-generated offer letters and external price list synchronisation.

- **Types** (`artifacts/mobile/types.ts`): `EventStatus` (anfrage/angebot/bestaetigt/produktion/abgeschlossen/abgesagt), `EventMenuItem` (recipeId, recipeName, portions, pricePerPortion), `CateringEvent` (full event with cost fields), `PriceListEntry`, `PriceServerAuthType`, `PriceServerConfig`. `AppState` extended with `events[]`, `priceList[]`, `priceServerConfig?`.
- **AppContext** (`artifacts/mobile/contexts/AppContext.tsx`): Actions `addEvent`, `updateEvent`, `removeEvent`, `setPriceList`, `setPriceServerConfig` with reducer cases.
- **Event list** (`artifacts/mobile/app/events.tsx`): Lists all events sorted by date with status filter chips (Alle/Anfrage/Angebot/Bestätigt/In Produktion/Abgeschlossen/Abgesagt), colour-coded status badges, live grand-total per event, FAB `+` to create new, empty state with CTA button.
- **Event detail** (`artifacts/mobile/app/eventdetail.tsx`): Full-featured create/edit form — 6-step status stepper (colour-coded), basic info (title, client, email/phone, date/time, venue, guests, notes), menu item builder (recipe picker with price-list price fallback, per-dish portions + price/portion + line total), cost inputs (staff/equipment/transport/overhead%/VAT%), live totals breakdown (food cost, each cost line, overhead, VAT, grand total, per person), AI offer generator via `generateEventOffer()` → editable text area → Share. Save/delete.
- **Price server** (`artifacts/mobile/app/priceserver.tsx`): Configure external ERP price endpoint (URL + auth: None/Basic/Bearer/API-Key), "Test connection" verifies count, "Sync now" syncs into `priceList[]` state, last-sync status indicator, preview of first 8 entries.
- **Price server lib** (`artifacts/mobile/lib/priceServer.ts`): `syncPriceList(config)` — normalises heterogeneous ERP JSON responses (arrays, `{articles}`, `{items}`, `{products}`, `{data}`) and field aliases (`name/artikel/bezeichnung`, `preis/price`, `einheit/unit`, etc.) into `PriceListEntry[]`.
- **AI** (`artifacts/mobile/lib/ai.ts`): `generateEventOffer(input)` — generates a professional German Angebot letter (150–250 words, reference placeholder, itemised menu, cost summary, 14-day payment terms) via `generateJson<string>`.
- **More screen** (`artifacts/mobile/app/(tabs)/more.tsx`): "Veranstaltungen" + "Preisserver" links added to Operations section.
- **i18n**: 50+ new keys in both DE and EN (status labels, form fields, cost fields, sync/auth labels).

### Tagesabschluss Entry Window + Overpass Fix (Phase 6F)

- **Erfassungsfenster** (`app/sales.tsx`, `app/settings.tsx`): Configurable time-window (HH:mm start → end) during which cooked/sold counts can ONLY be increased, not decreased. Prevents retroactive reductions during service. The `−` button is disabled and direct text-editing is guarded against lower values. A status banner shows 🔒 "Erfassungsfenster aktiv" (yellow) inside the window or 🔓 upcoming window info outside. Configuration card in Settings (toggle + two time pickers). Defaults: disabled, 10:00–14:30.
- **Types**: `NotificationPrefs` extended with `salesWindowEnabled: boolean`, `salesWindowStart: string`, `salesWindowEnd: string`. `seedData.ts` defaults added.
- **i18n**: 7 new keys DE + EN (`salesWindowTitle`, `salesWindowDesc`, `salesWindowEnable`, `salesWindowFrom/FromDesc`, `salesWindowTo/ToDesc`).
- **Overpass 502 fallback — Producers** (`artifacts/api-server/src/routes/producersDiscover.ts`): When Overpass API is unavailable and the DB cache is empty, the endpoint now returns static fallback data (4–6 realistic Berlin/Brandenburg producers per category) instead of a 502 error. Response includes `usingFallback: true` flag. Added 25-second AbortController timeout. Mobile producers screen (`app/producers.tsx`) detects the flag and shows subtle amber notice instead of red error card.
- **PLZ + Radius supplier search** (`artifacts/api-server/src/routes/suppliersDiscover.ts`, `artifacts/mobile/app/suppliers/discover.tsx`): Complete rewrite of supplier discovery. New `GET /suppliers/geocode?plz=` uses **Nominatim (OSM)** to convert a 5-digit German PLZ to lat/lng + city name (no API key needed, reliable). `GET /suppliers/discover` now accepts `lat`, `lng`, `radiusKm` (1–100 km) and uses Overpass `around:` query (radius-based, not BBOX) to find nearby shops. Falls back to static Berlin/Brandenburg data if Overpass is unavailable. Mobile screen redesigned: PLZ text input + 🔍 button + radius segmented picker (5/10/25/50/100 km) + category chips. Shows distance badge per result. No 502 errors shown to user.

### Customer accounts + 08:00 cutoff + daily aggregate (Phase 6C)

The pre-order portal now distinguishes anonymous guests from logged-in customers (regular vs business-approved), with a per-day 08:00 Europe/Berlin lockout for self-service edits and a per-customer aggregate view for the kitchen.
- **Schema** (`lib/db/src/schema/preorder.ts`): added `customer_profiles` (clerk_user_id PK, displayName, email, homeLocationCode, accountType ∈ {regular, business_pending, business_approved, rejected}, ownerOrgId). Extended `guest_orders` with `customer_id` (nullable for back-compat with existing guest rows) and `wanted_for` (date, nullable).
- **OpenAPI** (`lib/api-spec/openapi.yaml`): new schemas `CustomerProfile`, `CustomerAccountType`, `UpsertCustomerProfileBody`, `DecideCustomerBody`, `OrderAggregateLine`, `OrderAggregateResponse`, `UpdateOrderItemsBody`. New ops: `getCustomerProfile`, `upsertCustomerProfile`, `listCustomerOrders`, `updateOrderItems`, `cancelOwnOrder`, `listStaffCustomers`, `decideStaffCustomer`, `getStaffOrdersAggregate`. `GuestOrder` gained `customerId`, `wantedFor`, and a server-computed `editable` flag.
- **Server** (`artifacts/api-server/src/routes/preorder.ts`): `cutoffInstantFor(YYYY-MM-DD)` resolves the 08:00 Europe/Berlin instant via Intl introspection (handles DST without a tz library). `isOrderEditable` gates the customer-side PATCH/cancel routes (409 past cutoff). `POST /preorder/orders` now requires auth + `business_approved` profile and a `wantedFor` date that is still pre-cutoff. `ensureProfile` lazily seeds a `regular` profile from Clerk on first call. Staff scoping: a customer is visible to a staff member only if `home_location_code` is one of the staff's published locations OR the customer is already approved into one of the staff's orgs (prevents cross-tenant PII leaks). `staff/orders/aggregate` groups by customer for a given date and returns per-dish totals + grand total.
- **Web** (`artifacts/preorder/src/`): `main.tsx` wraps in `ClerkProvider` (frontend-API proxied through `/api/__clerk` in prod). `App.tsx` adds `/sign-in`, `/sign-up`, `/profile`, `/my-orders`. `pages/profile.tsx` lets the customer set displayName + home canteen and request business approval (one-way `regular → business_pending`). `pages/my-orders.tsx` lists own orders with cancel button (disabled past cutoff). `pages/checkout.tsx` requires auth + `business_approved`, defaults `wantedFor` to today if before 08:00 else tomorrow. `components/auth-nav.tsx` shows sign-in / profile / orders links across pages.
- **Mobile** (`artifacts/mobile/`): `app/customers.tsx` — staff approval queue (tabs: pending / approved / rejected), approve/reject calls `PATCH /preorder/staff/customers/:id`. `app/aggregate.tsx` — daily customer-by-customer order aggregate for a chosen location + date (defaults to today Berlin). Both linked from `app/(tabs)/more.tsx` (`customers`, `dailyAggregate` i18n keys).

### Marketing Website Refresh + Sales Collateral PDFs (May 2026)

Comprehensive update of the marketing site (`artifacts/website`) reflecting all 2025–26 product innovations, plus generation of two downloadable sales-collateral PDFs.

- **Marketing copy rewritten** (`src/lib/i18n.tsx`, ~600 lines DE+EN): full coverage of new USPs (DGE-Score live + PDF certificate, Kios voice assistant, Fiskaly TSE POS, LMIV per dish, HACCP digital, BIO/Öko wizard, tray-photo waste analysis, shift handover, multi-site roll-up, BuT/RKSH school accounts, ESG/CO₂, catering CRM with Outlook lead capture).
- **Home page rewrite** (`src/pages/home.tsx`): new hero "Eine Plattform. Ihre ganze Küche. Komplett konform." + 4-USP why-grid (Award/Mic/Receipt/Database), stats strip (−18 % waste, +22 % orders, −4 hr admin, 100 % audit-ready), real screenshot gallery, testimonial.
- **Features page rewrite** (`src/pages/features.tsx`): 25 features grouped into 6 sections (Konformität & Qualität, Tagesgeschäft & Bedienung, Küche & Produktion, Einkauf/Lager/Forecast, Gäste/Verkauf/CRM, Insights/Berichte/Multi-Standort) with appropriate Lucide icons.
- **For-operators rewrite** (`src/pages/for-operators.tsx`): 6 segment cards — Betriebskantine, Schule/Kita, Krankenhaus/Klinik, Senioren-Heim, Catering/Event, Hotel/Tagungsrestaurant — each with concrete value-prop snippets.
- **NEW Compare page** (`src/pages/compare.tsx`): 17-row head-to-head feature table KItchenOS vs Apicbase / Foodics / MarketMan / Choco using `<MarkCell>` (Check/Minus/X icons with semantic `aria-label`); KItchenOS column highlighted with `bg-primary/[0.04]`. "When to pick which" summary cards beneath.
- **NEW Standards page** (`src/pages/standards.tsx`): 8 compliance areas (DGE, LMIV, HACCP/DIN 10514+10516, KassenSichV/TSE/DSFinV-K, EU-Bio 2018/848, DSGVO/GDPR, BuT/RKSH, ESG/CO₂) each with tag chip + Lucide icon + descriptive body.
- **NEW Downloads page** (`src/pages/downloads.tsx`): two download cards linking to `/downloads/sales-emails.pdf` and `/downloads/lead-list.pdf` via native `<a download>` attribute. BASE-prefix-aware (`import.meta.env.BASE_URL`).
- **Routing** (`src/App.tsx`): registered `/compare`, `/standards`, `/downloads`. **Layout** (`src/components/layout.tsx`): added Compare, Standards to top-nav and Downloads to footer.
- **Sales-collateral PDF generator** (`scripts/src/generate-marketing-pdfs.ts`): pdfkit-based, embeds full DE content. Two outputs to `artifacts/website/public/downloads/`:
  - **sales-emails.pdf** (~24 KB) — 8 templates: Schule/Kita, Klinik, Senioren, Betriebskantine, Catering, Hotel + Follow-up + Breakup, each with Zielgruppe, Sende-Zeit, Betreff, full body.
  - **lead-list.pdf** (~30 KB) — 40 publicly-known DACH operators grouped by segment (Großcaterer: apetito/Sodexo/Compass/Aramark/Dussmann/Klüh/Stockheim/Hofmann; Träger/Schulen: FRÖBEL/IB/Studierendenwerke; Kliniken: Charité/Helios/Sana/Asklepios/Vivantes/Unikliniken; Senioren: Korian/Alloheim/Pro Seniore/Diakonie/Caritas/AWO; Werkskantinen: BMW/Siemens/SAP/Bosch/Daimler Truck; Hotels: Lindner/Maritim/Steigenberger; öffentliche Hand: Bundeswehr/JVA/Studentenwerk-Bund/kommunale Schulämter; Bio: FRoSTA/Alnatura) — each card has name, city, segment, size, why-fit, contact path, website.
- **Critical pdfkit fix**: avoid stack-overflow recursion by using `bufferPages: true` + post-content `paginateAtEnd()` that calls `bufferedPageRange()` / `switchToPage(i)` and writes footer with `lineBreak: false`. Never attach `pageAdded` listeners that themselves call `.text()`. Avoid `continued: true` on long flowing text under bufferPages.
- **Script wiring** (`scripts/package.json`): `pnpm --filter @workspace/scripts run gen:marketing` regenerates both PDFs. Dependencies `pdfkit` + `@types/pdfkit` added as devDeps to the scripts package.
- **Files**: `src/lib/i18n.tsx`, `src/pages/{home,features,for-operators,compare,standards,downloads}.tsx`, `src/App.tsx`, `src/components/layout.tsx`, `scripts/src/generate-marketing-pdfs.ts`, `scripts/package.json`, `artifacts/website/public/downloads/{sales-emails,lead-list}.pdf`.

### T016 — Smart Kios v5: 7 intelligence enhancements (May 2026)

Building on T015's wake/followup/confirm state machine, Kios learned seven new tricks. All work lives in `artifacts/mobile/hooks/useKios.ts` — no new server routes, no schema changes.

- **T016a — Conversation memory (anaphora resolution)**. `KiosRefs.lastContext: { recipe?, inventoryItem?, contact?, ts } | null` (3-min TTL). Every successful smart-lookup hit refreshes it. `expandAnaphora()` rewrites pronouns ("davon"/"dazu"/"das"/"die"/"es"/"sie"/"der") into the last-referenced entity name BEFORE the regex patterns run, so chains like "kalorien hat Linsensuppe" → "und wie teuer ist das?" resolve to Linsensuppe automatically.
- **T016b — More data intents**. Five new question patterns hit the local AppState directly (no AI round-trip): "Wer arbeitet morgen / am Freitag" (queries `state.shifts`), "Wie viel haben wir [diese Woche/letzten Monat] weggeworfen" (sums `state.waste.cost` in date range), "Umsatz heute" / "Wie viele Portionen" (aggregates `state.sales`), "Top-Kunde diesen Monat" (groups `state.events` by `clientName`, sums revenue from `menuItems[].pricePerPortion × portions`). Helpers: `dateRangeFromPhrase()` (heute/gestern/diese Woche/letzte Woche/diesen Monat/letzten Monat), `parseSingleDay()` (heute/morgen/übermorgen/Mon-Sun).
- **T016c — Voice mutations beyond orders**. `PendingAction` union extended with four new kinds: `addHaccpEntry` (parses "Notiere Kühltemperatur 5 Grad" → `addHaccp` dispatch), `setInventoryQty` ("Setze Milch auf 12 Liter" → `updateInventory`), `consumeInventoryQty` ("Verbrauche 2 kg Mehl" → `updateInventory` decrement; grams normalised at parse-time, converted back to inv.unit at execute-time), `logWaste` ("Notiere 500 Gramm Brot weggeworfen" → `addWaste`). Same Ja/Nein confirm-window pattern as T015 with a 30-second TTL. Inventory mutations re-fetch by `id` at execute-time so a mid-window UI edit on another device cannot be silently overwritten.
- **T016d — Natural-language recipe search**. `handleRecipeSearch()` runs as the first dispatcher branch in `handleSmartLookups`. Filters: category (vegan/vegetarisch/Fleisch/Fisch/Kinder), type-by-name (Suppe/Salat/Dessert), `unter X Euro`, `unter X kcal`, `ohne X` (allergen exclusion via `ALLERGEN_DE_TO_KEY` regex table). Speaks top 3 hits with prices; appends "Insgesamt N Treffer" if there are more.
- **T016e — Proactive morning briefing**. `composeMorningBriefing(state)` pulls today's events (with confirmed count via `EventStatus === "bestaetigt" | "produktion"`), expiring items (≤2 days), low-stock count, yesterday's waste cost, and tomorrow's events into one short German paragraph. Returns `null` when there's nothing to report. Triggered from `enable()` via AsyncStorage key `kios:lastBriefingAt` (12-hour gate). Spoken BEFORE wake-listening starts so the briefing never gets clipped by an overlapping recognition restart.
- **T016f — Internet recipe search**. `handleSmartLookups` returns the marker reply `__T016F_FETCH__:<query>` when the user says e.g. "suche Rezept für vegane Lasagne". `handleQuestion` detects the prefix and asynchronously calls the existing `lib/ai.ts:generateRecipe()` (no new server route — the AI integration is already wired). The returned `GeneratedRecipe` is widened to a full `Recipe` (id + empty ingredients[] + Allergen-typed allergens via defensive filter). Then a `addRecipeFromOnline` `PendingAction` queues a Ja/Nein confirm. On Ja → `addRecipe` dispatch.
- **T016g — Rush mode (terse replies)**. `isRushMode()` returns `true` during 11:30–13:30 and 17:30–19:30 (lunch + dinner service). `terseQuickReply(nav)` swaps verbose nav replies for one-word forms ("Lager." instead of "Ich zeige dir den Lagerbestand."). The "Ja?" wake-prompt is skipped entirely in rush mode (saves ~600 ms). Outside rush, the verbose form is friendlier. Note: `SaleEntry` is a daily aggregate, so we cannot derive sales velocity for rush detection — time-of-day is the only signal.

**Files**: `artifacts/mobile/hooks/useKios.ts` (sole touch-point — additions ~700 LOC; existing T015 confirm-window machinery handles all five new pending actions). New imports: `AsyncStorage`, `generateRecipe`, `HaccpLog`, `WasteEntry`. No server, schema, or i18n changes.

### T017 — Marketing-site App dropdown (May 2026)

`artifacts/website/src/components/layout.tsx` gained an "Zur App / Open App" dropdown in top-nav, mobile-menu, and footer. Two entries: Pre-Order Portal (`/preorder/`) and App Demo (`/`). Both open in a new tab via `target="_blank" rel="noopener noreferrer"` so marketing context isn't lost. Inline comment notes the swap point for absolute custom-domain URLs once each artifact is published separately. New i18n keys (DE+EN): `navApp`, `navAppPreorder`, `navAppPreorderDesc`, `navAppDemo`, `navAppDemoDesc`, `navAppNote`.

### T018 — Hardware comparison page (iPad vs Android, May 2026)

User strategy decision: at contract signing the customer chooses iPad or rugged Android. New page `artifacts/website/src/pages/hardware.tsx`, route `/hardware`, nav-link between Standards and Pricing.

- **Hero + Cloud-First guarantee card**: prominent EU-cloud (Frankfurt), AES-256, 30-day backups, sub-5-min tablet swap, AVV. This is the architectural promise that makes the device interchangeable.
- **Two device summary cards**: iPad 10.9″ (10th Gen) + Jamf School/Mosyle vs Galaxy Tab Active5 + Android Enterprise/Knox, with hardware cost and per-month MDM cost. Android card carries an "Empfehlung Küche / Kitchen Pick" badge.
- **10-row comparison table** (`<ScoreCell>` with best/good/ok states): Robustheit, Anschaffungspreis, MDM, PWA-Support, Sprachsteuerung (Kios), Display, Akku, Service in DE, Markenwirkung, Beschaffung öffentlicher Sektor. Honest trade-offs — Android wins durability/price/PWA-storage/voice/battery/procurement, iPad wins MDM-maturity/display/service-network/image.
- **4 recommendation cards** ("Wann welche Plattform?"): rugged-environment → Android, tight-budget/public-sector → Android, existing Apple-ecosystem → iPad, premium-restaurant → iPad.
- **CTA to /demo + /contact** at the bottom.
- ~70 new i18n keys (DE + EN) under `hw*` prefix in `src/lib/i18n.tsx`.

Critical fix during build: removed two duplicate `ctaTalk` entries (key already existed in both DE and EN sections). The page reuses the existing `ctaTalk` ("Mit uns sprechen / Talk to us").

### Strategy decisions captured (deployment & data, May 2026)

Pending implementation tasks captured here so they aren't lost:

- **Customer device strategy**: Safari PWA on iPad OR Chrome PWA on Android (rugged Galaxy Tab Active5), customer picks at contract signing. Both run via MDM in Single-App Mode locked to the app + a separate `hilfe.kitchenos.de` support subdomain (subdomain not yet provisioned).
- **Auth**: invitation-only via Clerk (already wired). No public sign-up. Operator provisions accounts after contract.
- **Add-on activation**: planned tier-based flow — instant for <€20/month items, 24h admin-approval window for higher-tier modules. Not yet built. UX target: in-app catalogue → "Anfrage senden" → admin dashboard ticket → feature-flag flip after approval window.
- **Cloud-first data sync (CRITICAL GAP)**: customer-facing message says "all data lives in the EU cloud" but mobile AppState (orders, sales, inventory, HACCP, waste, recipes, events, shifts, cleaning) currently persists ONLY in `AsyncStorage` via `lib/storage.ts`. Already-cloud-backed: Clerk identity, suppliers/producers search, TSE signing, mail, preorder customer profiles. **Required next phase**: extend `lib/api-spec/openapi.yaml` with sync endpoints for the operational state, add server routes under `artifacts/api-server/src/routes/`, build offline-first sync layer in `artifacts/mobile/contexts/AppContext.tsx` (last-write-wins per row with `updated_at` timestamps initially; CRDT only if true multi-writer conflicts emerge in field testing). Ship the schema + endpoints first as one phase, then mobile sync as a second phase.
