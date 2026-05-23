# Fluency Sprint

Fluency Sprint is currently a public demo. All rights reserved. No license is granted to copy, modify, distribute, sublicense, or use this code commercially without written permission.

Live: <https://fluencysprint.github.io/>

## What it does

Fluency Sprint is a focused language coach that answers:

- What is my current level — honestly?
- Where exactly am I weak?
- What should I practise today, given the time I have?
- Am I getting closer to my CEFR target?

It is **not** a streak-based game. Sessions are 5/10/20 minutes. Long tasks (writing, listening, speaking) can always be skipped without breaking your level estimate.

## Features

- **Multilingual by architecture** — Spanish and English packs out of the box. Adding a new language is a single folder under `src/languages/`.
- **A1 → C1 coverage** — beginner-friendly at A1/A2, useful at B1/B2, exam-relevant at C1.
- **Conservative adaptive placement** — starts at A1, only climbs if your answers support it. A single lucky high answer never inflates your level.
- **Per-level readiness** — independent A1/A2/B1/B2/C1 readiness percentages with explicit confidence (low / medium / high).
- **Skippable everything** — skip individual items, skip the writing prompt, skip the whole diagnostic.
- **Local learner profiles** — multiple profiles on one device, fully isolated. One language per profile.
- **Robust local persistence** — saves on every answer, on every tab switch, on every page hide. Storage status and last-saved time visible in Settings.
- **Spaced-repetition review** of tracked mistakes, weighted by recency and persistence.
- **Original content** — no scraped exam material.
- **No backend, no account, no telemetry** — pure static app.

## Coming soon

Listening and speaking are intentionally **not** part of the current scoring. The previous prototype gave noisy feedback that distorted level estimates; the modules will return once they can be trusted. The dashboard reflects this honestly rather than papering over it.

## Running locally

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

Node 20+ recommended.

## Deploying to GitHub Pages

This repo ships with `.github/workflows/deploy.yml`. To deploy:

1. Push to GitHub as `fluencysprint.github.io` with `base: '/'` in `vite.config.ts` (already set).
2. In Settings → Pages, set Source to **GitHub Actions**.
3. Push to `main`. The workflow runs `npm ci && npm run build` and publishes `dist/` to Pages.

The app uses `HashRouter` so every route works on Pages without a custom 404.

## Storage and backups

All progress is stored in your browser's `localStorage` under keys prefixed with `fluencySprint.`:

| Key | Contents |
| --- | --- |
| `fluencySprint.storageVersion` | Schema version |
| `fluencySprint.profiles` | List of learner profiles |
| `fluencySprint.activeProfileId` | The currently selected profile |
| `fluencySprint.profileData.<id>` | All progress, mistakes, sessions, drafts and resumable sessions for that profile |
| `fluencySprint.lastSavedAt.<id>` | Timestamp of the most recent save |

The app aggressively flushes writes on `visibilitychange`, `pagehide` and `beforeunload`, plus a periodic background flush, to maximise survival on mobile browsers. **There is no cross-device sync.** Use **Settings → Export backup** to move progress between devices.

If your phone clears site data, runs out of storage, or you use private/incognito mode, progress may be lost. Export a backup regularly.

## Profiles

Onboarding creates your first profile. To use the app yourself **and** give it to a friend who is, say, A1, create a second profile — each has its own language, level, history and mistakes.

- **Create a new profile** — Settings → Profile → "+ Create new profile" (or the existing-learners panel on Onboarding).
- **Switch** — Settings → "Switch profile".
- **Reset current profile** — wipes only that profile.
- **Delete current profile** — removes the entire profile.
- **Reset all app data** — wipes everything.

## What the placement does and doesn't do

It **does**:

- Start at A1 and only branch up if you pass enough lower-level items.
- Report each level independently as `not yet / emerging / developing / strong / not enough evidence`.
- Cap your overall estimate at the highest level where you have both enough items attempted and ≥ 70% accuracy.
- Drop confidence when you skip items, give low-confidence correct answers, or skip writing entirely.

It **does not**:

- Officially certify your CEFR level — it is unofficial, for self-study guidance.
- Score listening or speaking yet.
- Replace teacher feedback for writing — writing analysis is rule-based and Spanish-leaning.

## Tech stack

- Vite 8 + React 19 + TypeScript
- Tailwind v4 (via `@tailwindcss/vite` — no `tailwind.config.js`)
- React Router v7 (`HashRouter`)
- Vitest + Testing Library
- All data structures defined in `src/types.ts`; language packs in `src/languages/`; placement engine in `src/lib/placement.ts`.

## Rights

All exercise content is original.
