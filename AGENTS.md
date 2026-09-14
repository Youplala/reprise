# Paris GO — agent guidance

Applies equally to Hermes, Codex/ChatGPT, and Claude. Follow the user's task scope, inspect existing changes before editing, and leave unrelated work untouched.

## Purpose and naming

Paris GO (formerly Reprise) is a free, independent Expo/React Native app for finding and rephotographing Paris viewpoints from 1970, comparing photographs, and preparing voluntary contributions to the Observatoire photo participatif. User-facing copy is French; use **Paris GO**.

Keep legacy technical identifiers unless an explicit migration is requested: package/Expo slug/URL scheme `reprise`, native ID `fr.youplala.repriseparis`, repository `Youplala/reprise`, and public site `https://youplala.github.io/reprise/`.

The current app uses bundled/cached public snapshots refreshed from GitHub, local captures, and a user-controlled official WebView form. It has no user-account backend and does not query the upstream Observatoire API at runtime. `docs/architecture-cible.md` describes a future design, not the implemented architecture.

## Repository map

- `src/app/`: Expo Router routes and layouts; `src/screens/`: screen implementations.
- `src/components/`, `src/hooks/`, `src/providers/`: shared UI, device hooks, state; `src/constants/`, `src/types/`, `src/utils/`: shared contracts and helpers. `@/*` resolves to `src/*`.
- `src/services/`: local persistence, archive images, capture and official-form preparation/security; `src/data/`: snapshot validation, storage and synchronization.
- `assets/data/`: generated public snapshots/metadata; `scripts/`: ingestion, metadata import, image delivery and privacy guard.
- `tests/*.test.mjs`: Node tests, including source-contract checks; `__tests__/`: Jest tests.
- `app.json`, `app.config.js`, `eas.json`: app identity, native configuration and build profiles. Generated root `ios/` and `android/` directories are ignored.
- `site/`: static GitHub Pages site; `docs/`: architecture, privacy, publication and App Review material. Review notes can be dated or inconsistent; verify the actual release build.
- `store-screenshots/`: separate Next.js marketing editor with its own dependencies and saved composition; excluded from root TypeScript checks.
- `.github/workflows/`: PR quality, daily snapshot refresh and Pages deployment.

## Verified commands and validation

These commands are verified against repository scripts, README and workflows; their presence does not imply they passed in this session. From the root, use Node 22 and npm, matching `quality.yml`:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npx expo export --platform ios --no-bytecode --output-dir /tmp/reprise-ios-export
```

`npm test` runs Node tests followed by Jest. The export checks the iOS JavaScript bundle only. Automated checks on Linux do not validate a native build, simulator, device, camera, permissions or WebView behavior.

**Native iOS validation must happen on a Mac with Xcode**, using a development build, not Expo Go. `npm run ios` builds/runs iOS; `npx expo run:ios --device` targets an iPhone. Validate navigation and layout in the simulator, then camera/lenses, orientation, location, Photos permissions, capture persistence and official-form attachments on a physical iPhone. Report simulator and device results separately, including build and OS; mark missing coverage as pending.

For a local form fixture without real submissions:

```bash
EXPO_PUBLIC_OFFICIAL_SUBMISSION_FIXTURE=1 npx expo start --dev-client --clear
```

Other scoped commands:

- `npm run data:test`: ingestion/privacy tests.
- `node scripts/ingest-observatoire.mjs`: fetches upstream data and rewrites the snapshot; run only for data work.
- `npm run data:import-paris1970 -- /path/to/paris-1970`: regenerates archive metadata from a local clone.
- In `store-screenshots/`: `pnpm install`, `pnpm dev`, `pnpm build`. Root CI does not build this editor.
- Never use `npm run reset-project` for maintenance: it moves/deletes application sources and scripts.

## GitHub Roadmap and PR-only workflow

Use the GitHub **Roadmap** project and linked issues for priorities, acceptance criteria and progress. Discover the actual project and existing status fields; do not invent a project URL, number or status. If inaccessible, report that limitation and proceed within the user's stated scope.

Work on a focused branch from current `main`; link the issue/Roadmap item in the PR. Describe the behavior change, validation evidence and remaining native checks. Agent changes reach `main` through reviewed PRs with passing required checks: no direct pushes to `main`, protection bypasses or self-merges. Respect explicit restrictions on staging, commits, pushes and remote updates.

`snapshot.yml` is an existing automation exception: it regenerates data daily at 04:00 UTC (or manually), checks privacy and directly commits/pushes changed snapshots. This is not permission for agents to bypass PRs.

## Security and deployment

Never read, print or commit secrets: environment files, credentials, signing material or token stores. Do not dump the environment or resolved secret-bearing configuration. Use variable names and public configuration only. `GOOGLE_MAPS_API_KEY` belongs in local/EAS configuration; production Android intentionally fails without it. Never place secrets in `EXPO_PUBLIC_*`.

Preserve ingestion field allowlists and privacy guards; never log or publish raw upstream contact data. Preserve WebView navigation/attachment authorization checks. Users supply identity and consent and trigger final submission; do not automate real deposits or fabricate successful publication. Preserve attribution and documented image-rights limits; MIT covers code, not photographs.

`pages.yml` deploys `site/` after relevant pushes to `main` or manual dispatch. EAS profiles are development (iOS simulator), preview (device), and production (auto-increment). The documented release command `eas build --platform ios --profile production --auto-submit` builds and submits externally; run only within explicit release authorization. `EXPO_APPLE_ID` is supplied externally. Keep privacy/site/store declarations consistent with changed SDKs and data flows; consult `docs/PUBLICATION.md`.

## Definition of done

- Requested behavior and issue acceptance criteria are met with a focused diff and relevant regression coverage.
- Applicable automated checks pass; report exact checks run, failures and omissions without claiming unperformed validation.
- Required Mac simulator/device validation is evidenced or explicitly pending; JavaScript export alone cannot establish native readiness.
- Documentation, privacy and attribution remain accurate; no secrets, unrelated generated files or accidental data refreshes enter the change.
- Review the final diff/status, link the PR to the Roadmap issue when authorized, and keep progress honest.
