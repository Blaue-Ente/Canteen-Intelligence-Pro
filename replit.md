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
