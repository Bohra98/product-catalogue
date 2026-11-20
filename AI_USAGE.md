# AI usage

## Tools and models

- **Claude Code** (Anthropic), run from the VS Code extension, using **Claude Opus 5.5** (`claude-opus-5-5`).
- Claude Code read and wrote files and ran shell commands (npm, tests, curl smoke tests) in the repo. It also drove a headless Chromium (browser-use plugin) for the manual UI check.
- No other AI tools were used.

## Instruction files

- [`CLAUDE.md`](CLAUDE.md) in the repo root, written by me before any code. It holds the non-negotiable rules: no client calls to Fake Store, swappable product and mail boundaries, zero-paid-account local run, AWS-compatible containers, no committed secrets. It also lists the five critical-path flows and says assumptions go in these docs.
- A personal global `CLAUDE.md` that only sets writing style for the agent's chat replies. It has no effect on the code.

## Plan / spec

I gave Claude Code a structured brief: stack, constraints, the five acceptance criteria, and the deliverables. I asked for a plan and a list of assumptions **before** any code. The plan it proposed, which I approved with one choice made explicit (keep the backend image proxy), covered:

- An Express API with routes → services → `ProductRepository` and `Mailer` interfaces, each with a live adapter and a local adapter.
- A React app that only calls same-origin `/api`.
- The "top rated" rule (rating, then rating count), top 3 per category, and search semantics (case-insensitive, AND across words, submit-only).
- Enquiry fields and server-side product lookup.
- `.eml` file output plus Mailpit as the zero-account "sales inbox".
- A list of explicit cuts: no database, queue, auth, E2E suite or IaC.

## Turning points (my corrections)

1. **Separate apps, separate `node_modules`.** The first scaffold used npm workspaces with a shared `@catalogue/shared` types package. I wanted `backend/` and `frontend/` as independent apps. Claude restructured to two standalone packages, each with its own lockfile. The shared types became `backend/src/contract.ts` plus a copy in `frontend/src/api/types.ts`. The root `package.json` kept only zero-dependency convenience scripts.
2. **Jest for the backend.** Backend tests were first written with Vitest. I asked for Jest, keeping Vitest for the Vite-based frontend. Claude switched the backend to Jest with `@swc/jest` in Jest's native ESM mode. It picked SWC over `ts-jest` because the project uses TypeScript 7, the native compiler, and `ts-jest` depends on the TypeScript JS compiler API. This was reasoning, not an experiment: `ts-jest` was never tried.

## Where AI output needed fixing, and how it was caught

| Problem | How it was caught | Fix |
| --- | --- | --- |
| The image proxy returned **500** instead of the intended 502 when a slow upstream image timed out. The timeout fired while reading the body, outside the error wrapping. | Live smoke test against the real Fake Store API (`curl /api/images/1`), then reading the JSON log line. | Wrapped the body read so it maps to `UpstreamError` (502). Added a separate 15 s image timeout, since images are 150 to 350 KB and take 1 to 3 s. Added a regression test. |
| The root `npm run dev` script left `tsx` and `vite` **running as orphans** after being stopped. npm does not forward SIGTERM to its children. | Checking the process list (`pgrep`) after stopping the script. | Each app runs in its own process group, and the whole group is killed on exit. Re-verified that nothing is left running. |
| **Product tiles had uneven heights** (277 to 346 px), because large images stretched the square image box. | Screenshot in a real browser, then measuring tile heights with JS. | Pinned the image inside a fixed square. Re-measured: all tiles 252 px. |
| The production build would not have shipped the **fixture JSON**, since `tsc` does not copy `.json` files. Offline mode would have crashed in the container. | Reviewing the build output path before running it. | The build script copies the fixtures into `dist/`. Confirmed by listing `dist/`. |
| The bulk `vi` → `jest` rename missed one call split across two lines. | Test run (`ReferenceError: vi is not defined`). | Fixed by hand; typed the fetch mocks as `jest.fn<typeof fetch>()`, which also fixed a type error. |
| A filler test asserted only that a class could be constructed. | Reading the generated tests. | Deleted. |
| The Vite config used `process.env` without Node types. | `tsc --noEmit`. | Added `@types/node` to the frontend dev dependencies. |

## What was checked, and what was not

- **Checked:**
  - Backend tests: 59 passing.
  - Frontend tests: 14 passing.
  - Typecheck and production build for both apps.
  - Live smoke test of every endpoint against the real Fake Store API.
  - A real `.eml` written to the outbox.
  - Manual browser pass of all five flows: home shows 5 products, category shows top-rated plus more, search shows only matches, the product page opens, and the enquiry ends on "Thank you".
- **Not checked:** the Dockerfiles and `docker-compose.yml`. Docker was not installed on the build machine, so they have never been built or run, and the SMTP/Mailpit path has never sent a real message. This is stated in the README and `DECISIONS.md`.

## Time spent

About 4 hours in total.
