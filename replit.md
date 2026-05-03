# KitchenOS

## Overview
KitchenOS is an AI-driven kitchen operations application designed for German restaurants, canteens, and hotels. It aims to streamline various aspects of kitchen management, from menu generation and inventory to HACCP compliance, staff planning, and customer engagement. The project's vision is to leverage AI to optimize efficiency, reduce waste, and enhance the overall dining experience, tapping into the market potential of the hospitality sector. Key capabilities include multi-tenant account management, supplier discovery, client-side AI features for demand forecasting and recipe generation, and a comprehensive guest pre-order system with customer accounts and feedback mechanisms.

## User Preferences
- **Communication Style**: I prefer simple language and detailed explanations.
- **Workflow**: I want iterative development.
- **Interaction**: Ask before making major changes.
- **Codebase Changes**: Do not make changes to the `artifacts/mockup-sandbox/` folder.

## System Architecture

KitchenOS is built as a cross-platform Expo app for iOS, Android, and Web, complemented by an Express.js API server.

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
- **Customer Engagement**: Guest pre-order system, customer accounts (regular, business), guest feedback with multi-criteria ratings, and catering offer generation.
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

### Customer accounts + 08:00 cutoff + daily aggregate (Phase 6C)

The pre-order portal now distinguishes anonymous guests from logged-in customers (regular vs business-approved), with a per-day 08:00 Europe/Berlin lockout for self-service edits and a per-customer aggregate view for the kitchen.
- **Schema** (`lib/db/src/schema/preorder.ts`): added `customer_profiles` (clerk_user_id PK, displayName, email, homeLocationCode, accountType ∈ {regular, business_pending, business_approved, rejected}, ownerOrgId). Extended `guest_orders` with `customer_id` (nullable for back-compat with existing guest rows) and `wanted_for` (date, nullable).
- **OpenAPI** (`lib/api-spec/openapi.yaml`): new schemas `CustomerProfile`, `CustomerAccountType`, `UpsertCustomerProfileBody`, `DecideCustomerBody`, `OrderAggregateLine`, `OrderAggregateResponse`, `UpdateOrderItemsBody`. New ops: `getCustomerProfile`, `upsertCustomerProfile`, `listCustomerOrders`, `updateOrderItems`, `cancelOwnOrder`, `listStaffCustomers`, `decideStaffCustomer`, `getStaffOrdersAggregate`. `GuestOrder` gained `customerId`, `wantedFor`, and a server-computed `editable` flag.
- **Server** (`artifacts/api-server/src/routes/preorder.ts`): `cutoffInstantFor(YYYY-MM-DD)` resolves the 08:00 Europe/Berlin instant via Intl introspection (handles DST without a tz library). `isOrderEditable` gates the customer-side PATCH/cancel routes (409 past cutoff). `POST /preorder/orders` now requires auth + `business_approved` profile and a `wantedFor` date that is still pre-cutoff. `ensureProfile` lazily seeds a `regular` profile from Clerk on first call. Staff scoping: a customer is visible to a staff member only if `home_location_code` is one of the staff's published locations OR the customer is already approved into one of the staff's orgs (prevents cross-tenant PII leaks). `staff/orders/aggregate` groups by customer for a given date and returns per-dish totals + grand total.
- **Web** (`artifacts/preorder/src/`): `main.tsx` wraps in `ClerkProvider` (frontend-API proxied through `/api/__clerk` in prod). `App.tsx` adds `/sign-in`, `/sign-up`, `/profile`, `/my-orders`. `pages/profile.tsx` lets the customer set displayName + home canteen and request business approval (one-way `regular → business_pending`). `pages/my-orders.tsx` lists own orders with cancel button (disabled past cutoff). `pages/checkout.tsx` requires auth + `business_approved`, defaults `wantedFor` to today if before 08:00 else tomorrow. `components/auth-nav.tsx` shows sign-in / profile / orders links across pages.
- **Mobile** (`artifacts/mobile/`): `app/customers.tsx` — staff approval queue (tabs: pending / approved / rejected), approve/reject calls `PATCH /preorder/staff/customers/:id`. `app/aggregate.tsx` — daily customer-by-customer order aggregate for a chosen location + date (defaults to today Berlin). Both linked from `app/(tabs)/more.tsx` (`customers`, `dailyAggregate` i18n keys).
