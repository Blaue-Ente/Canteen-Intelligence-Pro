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
