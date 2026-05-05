# KItchenOS

## Overview
KItchenOS is an AI-driven kitchen operations application for German restaurants, canteens, and hotels. Its purpose is to streamline kitchen management, including menu generation, inventory, HACCP compliance, staff planning, and customer engagement. The project aims to optimize efficiency, reduce waste, and enhance the dining experience through AI, targeting the hospitality sector with capabilities like multi-tenant account management, supplier discovery, client-side AI for demand forecasting and recipe generation, and a comprehensive guest pre-order system.

## User Preferences
- **Communication Style**: I prefer simple language and detailed explanations. Bulgarian conversational language; code/comments in DE/EN.
- **Workflow**: I want iterative development with each step announced.
- **Interaction**: Ask before making major changes.
- **Codebase Changes**: Do not make changes to the `artifacts/mockup-sandbox/` folder.

## System Architecture

KItchenOS is a cross-platform Expo application (iOS, Android, Web) complemented by an Express.js API server.

### UI/UX Decisions
The mobile application uses a charcoal and amber theme (`#0a0a0b` / `#f59e0b`) with full light/dark mode support and the Inter font family. The guest pre-order web app (`artifacts/preorder/`) features a warm amber/orange palette with Outfit/Playfair fonts. Tablet layouts are optimized for wider screens (≥768px).

### Technical Implementations
- **Frontend (Mobile)**: Expo Router app (`artifacts/mobile/`) for UI, state management, and AsyncStorage persistence.
- **Frontend (Pre-order Web)**: React + Vite application (`artifacts/preorder/`) for guest pre-ordering.
- **Backend**: Express.js server (`artifacts/api-server/`) for AI-related endpoints and pre-order functionalities.
- **Authentication**: Clerk for user authentication, organization management, memberships, and invites; `expo-secure-store` for token caching.
- **AI Integration**: Uses OpenAI API (`gpt-5.4`) for chat, vision, and JSON-mode completions. Kios, the voice assistant, includes advanced features like conversation memory, smart lookups, voice mutations, and internet recipe search.
- **State Management**: A single reducer manages `AppState`, persisted to AsyncStorage. Data is now persisted per user.
- **Internationalization**: Supports German (default) and English via `constants/i18n.ts`.
- **Operating Modes**: Supports "Voll-Modus" (Full: cash register + financial/tax) and "Light-Modus" (Lite: staff/operations assistant only) selected in settings.
- **Deployment Strategy**: Marketing website served at `/`, mobile app at `/app/`, pre-order at `/preorder/`, and API at `/api/`.

### Feature Specifications
- **Multi-tenant Accounts**: Organizations, roles (owner/manager/staff), and invitations.
- **Supplier & Producer Discovery**: Integration with Overpass API (OSM) and optionally Google Places. Supports PLZ and radius search.
- **HACCP Management**: Tracking storage, temperature logs, allergen information, automated suggestions, auto-logging from production/delivery, and `Rückstellproben` (food samples). Integrates with Bluetooth thermometers (paid addon).
- **Menu and Recipe Management**: AI-driven menu generation, editable sell prices, menu OCR/PDF scanning, structured dish vision for nutrition analysis, and a recipe mixer based on available ingredients.
- **Inventory & Waste Management**: Receipt scanning, auto-procurement, `Reste-Rezepte`, and AI-powered plate photo waste detection.
- **Demand Forecasting**: AI-powered forecasting using weather and sales data.
- **Staff Management**: Shift planning and team leaderboards.
- **Sales & Reporting**: Daily sales entry, Zettle Z-report OCR, margin alerts, multi-location rollup reports, and a configurable "Erfassungsfenster" for sales entry.
- **DGE-Qualitätsstandard Compliance**: Automated scoring and PDF certification for public sector catering (Schule, Kita, Krankenhaus, Senioren).
- **Kios Voice Assistant**: Hands-free cooking commands, timers, recipe steps, portion math, ambient mode, and proactive morning briefings.
- **Customer Engagement**: Guest pre-order system with customer accounts (regular, business-approved), feedback, and catering offer generation. Customers can manage their orders with an 08:00 cutoff time.
- **Event Management**: Full lifecycle from request to invoice, AI-generated offers, and transport checklists. Integrates a Price Server for external ERP price list synchronization.
- **CRM Light**: Groups events by client for quick overview.
- **Eco-Sustainability (Öko Wizard)**: Advisor with challenges and scoring.
- **Dish Analysis**: Performance scorecard for recipes.
- **In-App Help**: Structured user manual for all functions with full-text search.
- **Demo System (T020)**: Auth gate via `useProtectedRoute()` hook in `_layout.tsx` (Stack-compatible, redirects unauthenticated users to `/(auth)/sign-in`). Three pre-provisioned demo Clerk accounts (`demo-kantine@`, `demo-schule@`, `demo-catering@kitchenos.de`, public password `KitchenOS-Demo-2025!`) seeded via `pnpm --filter @workspace/scripts run seed:demo`. Each variant has a full coherent `AppState` bundle (`constants/demoSeeds.ts`) — Kantine München (200 portions/day, lite mode), Bio-Schulmensa (vegan/vegetarian, DGE schule standard, Öko enabled), Eventküche Berlin (catering-driven, 6 employees, 4 upcoming events, full mode). Per-user AsyncStorage isolation (`kitchenos.state.v1.<userId>`) ensures variants don't leak across each other. Two entry paths: (1) sign-in screen "Demo testen" button → modal with 3 variant cards; (2) marketing site hero/CTA → `/app/?demo=<variant>` → auto-launch on web. Seed application is queue-based: `applyDemoSeed` queues the seed before `setActive()` resolves, then `AppProvider` consumes it at the next hydrate completion under the demo user's storage key — eliminating cross-account data leaks. 30s expiry timer guards against stale queued seeds.

### System Design Choices
- **API Design**: OpenAPI specification (`lib/api-spec/openapi.yaml`) with Zod validation.
- **Database Schema**: PostgreSQL for operational data (organizations, suppliers, menus, orders, HACCP, etc.) and customer profiles.
- **Modularity**: Codebase structured into `artifacts/` (mobile, API server, pre-order web) and `lib/` (shared utilities).

## External Dependencies

- **Clerk**: User authentication, authorization, and organization management.
- **Expo**: Cross-platform application development framework for mobile and web.
- **Express.js**: Backend web application framework.
- **OpenAI API**: AI model integration (`gpt-5.4`) for natural language processing and vision tasks.
- **PostgreSQL**: Primary relational database for application data.
- **Open-Meteo**: Weather data API for demand forecasting.
- **Nominatim (OSM)**: Geocoding service for PLZ to lat/lng conversion.
- **Overpass API (OSM)**: Local producer and supplier discovery.
- **ElevenLabs**: Premium text-to-speech (TTS) for Kios voice assistant.
- **`expo-secure-store`**: Secure key-value storage for tokens on native mobile devices.
- **`expo-document-picker`**: For selecting PDF files from mobile devices.
- **`expo-file-system`**: For reading local files.
- **`expo-image-picker`**: For selecting images from mobile devices.
- **`expo-print` and `expo-sharing`**: For PDF generation and sharing on native platforms.
- **`expo-notifications`**: For managing push notifications.
- **Web Speech API**: Browser-based speech recognition and synthesis for Kios (web only).
- **`pdf-parse`**: For extracting text from PDF documents for menu scanning.
- **`pdfkit`**: Used in `scripts` for generating marketing collateral PDFs.
- **Microsoft 365 / Outlook Integration**: For email/event AI bridge, with planned multi-tenant OAuth.