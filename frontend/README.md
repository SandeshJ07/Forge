# Forge

A personal gym companion app: exercise glossary, manual workout log, body measurement tracking, personal records, and AI-generated weekly training plans — built to run on iOS, Android, and web from one codebase.

This is the **frontend** repo. The backend (FastAPI + Postgres) lives in a separate repo, [Forge_BE](https://github.com/SandeshJ07/Forge_BE), and must be running before this app can do anything beyond showing the sign-in screen.

## Stack

- **App**: React Native + Expo (managed workflow, TypeScript, expo-router) — targets iOS, Android, and web from one codebase
- **Backend**: a separate FastAPI + Postgres service ([Forge_BE](https://github.com/SandeshJ07/Forge_BE)) — this repo talks to it over a plain REST API (`src/lib/apiClient.ts`), nothing Supabase-specific remains
- **Auth**: JWT access + refresh tokens issued by the backend, stored via `expo-secure-store` (native) or `localStorage` (web) — see `src/lib/tokenStorage.ts`
- **State**: TanStack Query (server state) + Zustand (local UI state, incl. the auth session)
- **Charts**: victory-native (+ @shopify/react-native-skia, with a web/CanvasKit build via `canvaskit-wasm`)
- **AI**: Anthropic API (Claude) — the app never calls Anthropic directly; it calls the backend's `/plans/generate`, which does

## Accounts and platforms

- **Multiple accounts, one active login per device.** Any number of people can use the same install — only one JWT session is held at a time (`src/stores/useAuthStore.ts`). "Switch account" in Settings signs out, clears all locally cached data (`src/api/auth.ts: signOutAndReset`), and returns to sign-in for the next login.
- **iOS, Android, and web from one codebase.** Token storage (`src/lib/tokenStorage.ts`) branches per platform: native uses `expo-secure-store` (Keychain/Keystore), web falls back to `localStorage` (there's no OS keychain in a browser — this is the same trust model any web app's session already has). `metro.config.js` registers `.wasm` as an asset extension so `@shopify/react-native-skia`'s web (CanvasKit) build loads correctly for the measurement charts. Desktop-width web gets its own sidebar layout (`src/hooks/useResponsive.ts`); phones and mobile web keep the tab bar.

## Prerequisites

- Node.js 20+ and npm
- [Expo Go](https://expo.dev/go) on your phone, or an Android/iOS simulator
- **[Forge_BE](https://github.com/SandeshJ07/Forge_BE) running somewhere reachable** — see that repo's README for setup (it needs its own Postgres instance)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Point at your backend**:
   ```bash
   cp .env.example .env
   ```
   Set `EXPO_PUBLIC_API_URL` to wherever Forge_BE is running (default assumes `http://localhost:8000`, matching that repo's local dev default).
3. **Seed the exercise glossary** — this now happens on the backend, not here. Run `python -m scripts.seed_exercises` in the Forge_BE repo once, against whichever Postgres instance it's pointed at.
4. **Run the app**:
   ```bash
   npx expo start
   ```
   Scan the QR code with Expo Go, or press `a`/`i`/`w` for an emulator/simulator/web.

First run lands you on sign-in → a multi-step onboarding wizard → the main app. The sign-in screen (`app/(auth)/sign-in.tsx`) has five modes: sign in (username **or** email + password), sign up (email + username + password), verify email (6-digit code emailed at sign-up — in local dev without SMTP, read it from the backend console), forgot password, and reset password (code + new password). Your username can be changed later in Settings → Account. Onboarding is one question per screen — swipe left/right or use Back/Next — covering: units, optional gender/age/height/starting weight, goal, experience level, equipment access, warm-up + plan-refresh-reminder preferences, and an optional personal Anthropic key.

A native splash screen (`expo-splash-screen`, configured in `app.json`) shows while the auth session and profile are loading, and hides itself once routing has decided where to send you — see `app/_layout.tsx`. Routing there also sends a user who has finished onboarding straight to Home. The current splash/app icon images (`assets/icon.png`, `assets/splash-icon.png`) are still Expo's default placeholders; swap them for real Forge branding whenever you have one.

## Project structure

```
app/                      # expo-router screens (file-based routing)
  (auth)/                 # sign-in
  (tabs)/                 # Home, Log, Plan, Progress (measurements), Exercises (glossary), Settings
  exercise/[id].tsx        # exercise detail
  workout/new.tsx          # log a manual workout (exercise picker + sets)
  plan/history.tsx         # past generated plans
  records.tsx               # personal records list
  onboarding.tsx             # multi-step swipeable onboarding wizard
src/
  api/                    # thin wrappers around apiClient, one file per resource
  components/             # shared UI (ui/: Button, Card, Chip, OptionCard, PhotoBackdrop, ScreenHeader, ...) + feature components
  constants/navigation.ts # single nav config shared by the phone tab bar and desktop sidebar
  hooks/                  # TanStack Query hooks wrapping src/api, useResponsive (desktop-web layout)
  stores/                 # Zustand (auth session, unit system)
  types/                  # hand-written types mirroring the backend's schema
  constants/              # theme tokens, bundled image map (images.ts)
  lib/
    apiClient.ts            # fetch wrapper: base URL, bearer token, 401 -> refresh -> retry-once
    tokenStorage.ts          # platform-aware secure token persistence
    queryClient.ts
    planRefresh.ts           # plan-refresh-cadence reminder helper
    format.ts                # dates ("Today", "Mon, Sep 21"), weights in the user's units
assets/onboarding/         # CC0 photography for onboarding + desktop sign-in (see CREDITS.md)
public/canvaskit.wasm      # Skia's WebAssembly engine for web charts (see below)
metro.config.js            # registers .wasm as an asset (Skia web/CanvasKit)
```

## Design notes / assumptions

- **Multi-account, single active session.** Authorization is enforced entirely by the backend (every request carries a bearer token; the backend filters every query by the authenticated user). This app holds no authorization logic of its own beyond attaching the token and reacting to 401s.
- **Manual entry only.** Forge previously integrated with Hevy and Strava; both were removed by request to keep the app self-contained with no third-party fitness accounts required. Re-adding a sync integration later means adding both a backend provider client/routes and a corresponding `src/api/*.ts` file here.
- **The Anthropic key never sits in this app.** `PUT /anthropic-key` / `DELETE /anthropic-key` (`src/api/anthropicKey.ts`) are the only ways the client touches it — the actual key value is stored and used exclusively server-side.
- **AI calls are opt-in and cached.** `generatePlan()` (`src/api/plans.ts`) is only called from an explicit button press, never automatically. The plan-refresh cadence preference (weekly/biweekly/monthly) only ever surfaces a reminder banner on the Plan tab (`app/(tabs)/plan.tsx`, `src/lib/planRefresh.ts`) — it never triggers a call on its own.
- **Personal records are computed server-side** as a side effect of `POST /workouts` — this app just displays whatever `/personal-records` returns; there's no client-side PR computation logic anymore.
- **Progress photos are fetched as authenticated blobs, not URLs.** The backend's photo-file endpoint requires a bearer token, which `<Image source={{uri}}>` can't attach — so `getProgressPhotoUrl` (`src/api/measurements.ts`) fetches the file and converts it to a data URL instead of returning a plain link.
- **Demographics are optional and used narrowly.** Gender, birth year, and height are only ever used in the plan-generation prompt to sanity-check reasonable starting intensity — never to gatekeep exercises. Starting body weight isn't a separate field; it's just the first row in `measurements` (type `body_weight`), so it appears on the same trend chart as every later weigh-in.
- **Onboarding is a swipeable, one-question-per-step wizard on phones** (photo hero, large option cards, a top back arrow, and a primary button that reads "Skip for now" while an optional step is empty) — see `app/onboarding.tsx`. Desktop web shows every step as one form beside a photo panel, with a pinned "Finish setup" bar. Every optional step can be left blank.
- **Manual workout logging** lives at `app/workout/new.tsx` (reached from "+ Log workout" on the Log tab, or Home). Pick exercises from the glossary, enter weight/reps/optional RPE per set (weight in the user's unit system, converted to kg before sending), and the backend reports any new personal records in the same response.
- **Installable on mobile web (PWA).** `public/manifest.json` and a custom `public/index.html` (manifest link, iOS meta tags, apple-touch-icon) make the web build installable. `src/components/InstallPwaPrompt.tsx`, shown on Home, offers an Install button on Android/Chrome (`beforeinstallprompt`) and "Share → Add to Home Screen" instructions on iOS Safari; it's dismissible and never renders natively or when already installed.
- **AI provider is the user's choice.** Claude (Anthropic) or Gemini (Google), picked in onboarding or Settings → AI plan generation, each with an optional personal key (`src/api/aiKeys.ts`, `src/constants/aiProviders.ts`).
- **Plans start from a preferences screen** (`app/plan/new.tsx`): training days, the muscles for each day (multi-select, individual muscles only), warm-up on/off (asked here only, not in onboarding or Settings), session length and notes, pre-filled from the previous plan.
- **Plans generate in the background.** After tapping Create/Generate the user is sent straight back; `usePlanGeneration` (`src/hooks/usePlans.ts`) polls `GET /plans/generation` and `PlanGenerationPill` floats over every screen with progress, then “ready → View” or the error with “Try again”.
- **Install nudge on first visit.** On mobile web the sign-in screen slides up an install sheet once (`src/components/InstallNudge.tsx`); closing it any way is remembered on the device and also silences the Home banner. Settings → App keeps the option.
- **Motivational stats on Home** (`src/components/ProgressStatsCard.tsx`, data from `GET /stats/overview`): this month vs last (workouts, weight lifted), next workout milestone, biggest strength gains since the first session, and lifetime totals with a “that's about N cars” comparison.
- **Weekly streak on Home** (`src/components/StreakCard.tsx`, logic in `src/lib/streak.ts`): consecutive Mon–Sun weeks with at least one workout, plus a calendar heatmap. The current week never breaks a streak while it's in progress.
- **Installable on mobile web.** `src/lib/pwaInstall.ts` captures the browser's one-time install prompt at startup; the Home banner and Settings → App use it (one-tap install on Android Chrome/Edge, step-by-step instructions on iOS Safari and other browsers). The manifest ships 192/512px icons, which Chrome requires.
- **One navigation model, two layouts.** `src/constants/navigation.ts` defines the sections (order, labels, Ionicons). Phones and mobile web get a bottom tab bar; desktop web (≥900px) gets a persistent sidebar (`src/components/DesktopSidebar.tsx`), mounted in `app/_layout.tsx` so it also stays visible on detail screens (exercise, records, plan history, log workout). Those detail screens use `HeaderBackButton`, which falls back to their parent section when there's no history (deep link or page refresh on web).
- **Charts on web need CanvasKit.** Skia binds to CanvasKit when its module is first imported, so the chart (`src/components/TrendLine.tsx`) is only loaded through `LazyTrendLine.web.tsx` (`WithSkiaWeb`), after `public/canvaskit.wasm` has loaded. If you upgrade `@shopify/react-native-skia`, re-copy the matching wasm with `node node_modules/@shopify/react-native-skia/scripts/setup-canvaskit.js`.
- **Onboarding imagery is real photography, not illustrations.** Public-domain (CC0) photos from StockSnap and Wikimedia Commons, bundled in `assets/onboarding/` with sources in `CREDITS.md`. `PhotoBackdrop` adds a gradient scrim so the photos blend into the dark UI.
- **No app store publishing.** This is scaffolded for Expo Go / internal dev-client use (native) and static hosting (web) only; adding EAS Build/submit steps is a separate, explicit ask.

## Deployment

1. **Backend first** — deploy Forge_BE somewhere reachable (its own Postgres, its own host). See that repo's README.
2. **Web** — run `npx expo export --platform web`, then deploy the resulting `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages). Set `EXPO_PUBLIC_API_URL` to the deployed backend's URL at build time. Prefer a host that lets you set custom response headers, since `@shopify/react-native-skia`'s CanvasKit (used by the charts) benefits from COOP/COEP headers for full performance.
3. **iOS/Android via Expo Go** — nothing beyond step 1. Anyone with the Expo Go app and your project's QR code/URL can run it, as long as `EXPO_PUBLIC_API_URL` points somewhere they can reach.
4. **iOS/Android as a real installable app (TestFlight, Play internal testing, or public store) — not currently set up.** Needs an [EAS](https://expo.dev/eas) account, `eas.json` (not present in this repo yet), Apple Developer Program / Google Play Console enrollment, and app signing credentials.

## Known follow-ups (not blocking, but worth knowing about)

- No automated tests were added — this is a personal-scale scaffold; add them if the app grows beyond casual personal use.
- `assets/icon.png` and `assets/splash-icon.png` are still Expo's generic placeholder graphics, not Forge branding — replace them (and re-run `npx expo prebuild` if you've generated native projects) once you have real artwork.
- Progress-photo uploads on web assume the picked asset is a `blob:`/`data:` URI (standard for `expo-image-picker` on web); if a future picker library returns something else, `pickAndUploadProgressPhoto` (`src/api/measurements.ts`) will need a matching branch.
