# Product Catalogue

A small product catalogue: a React (TypeScript) frontend and a Node.js (TypeScript) backend. Customers can browse top-rated products, open a category, search, view a product and send a sales enquiry.

Product data comes from the public [Fake Store API](https://fakestoreapi.com). Only the backend calls it, through a swappable adapter. No paid accounts, API keys or secrets are needed to run anything.

## Run it

Requires **Node.js 20.12 or newer** (developed on Node 24).

```bash
npm run setup     # installs backend/ and frontend/ dependencies (npm ci in each)
npm run dev       # backend on :4000, frontend on :5173
```

Open http://localhost:5173.

- Enquiry emails land in `backend/outbox/` as `.eml` files. Open one in any mail client, or just `cat` it.
- No `.env` is needed; every setting has a safe default. To change something, `cp backend/.env.example backend/.env` and edit it.
- Offline or Fake Store down? Set `PRODUCT_SOURCE=fixture` in `backend/.env`. That serves a bundled snapshot of the same 20 products with placeholder images.

You can also run each app on its own, in two terminals:

```bash
cd backend && npm ci && npm run dev
cd frontend && npm ci && npm run dev
```

### With Docker

```bash
docker compose up --build
```

- App: http://localhost:8080
- Sales inbox (Mailpit): http://localhost:8025. Every enquiry shows up here as a real email.

This was tested by hand with `docker compose up --build` on Docker Desktop:
- all three containers come up healthy
- the API and image proxy work through nginx
- SPA deep links survive a refresh
- all five flows work at :8080
- each enquiry shows up in Mailpit at :8025

## Test

```bash
npm test             # backend (Jest) then frontend (Vitest)
npm run typecheck    # tsc for both apps
```

Or per app: `cd backend && npm test`, `cd frontend && npm test`.

| App | Runner | What is covered |
| --- | --- | --- |
| backend | Jest + supertest (SWC transform) | Every endpoint against the fixture data, ranking and search rules, enquiry validation (including header-injection attempts), mailer failure, rate limiting, the Fake Store adapter (mapping, caching, timeouts, bad payloads, image host pinning), env validation |
| frontend | Vitest + React Testing Library | The five acceptance flows through the real router: home shows 5 products, category shows top-rated plus more, search shows only matches, tile click opens the product, enquiry ends on "Thank you". Also error and validation states, and that the API client only calls `/api` |

## Why React + Node, both in TypeScript

- **One language and one type system end to end.** The API contract (`backend/src/contract.ts`) is plain TypeScript interfaces, and the frontend uses the same shapes.
- **React** is the most common choice for this kind of UI, has mature testing tools (Testing Library) and needs no server rendering for a catalogue this size. Vite gives a fast dev loop and a static build that any CDN can serve.
- **Node + Express** is small, well understood, and enough for a thin API that mostly adapts an upstream source. Zod validates every input and the env config at the edge.
- The two apps are **independent packages** with their own `package.json`, lockfile and `node_modules`. They can be built, deployed and owned separately.

## Architecture

```
Browser ── /api/* ──▶ backend (Express)
  │                    ├─ http/routes      validate input, map errors, set cache headers
  │                    ├─ services         CatalogService (ranking, category split, search)
  │                    │                   EnquiryService (product lookup, email build)
  │                    ├─ ProductRepository ◀─ FakeStoreProductRepository  (live, cached)
  │                    │   (interface)     ◀─ FixtureProductRepository     (offline/tests)
  │                    └─ Mailer           ◀─ FileMailer | ConsoleMailer | SmtpMailer
  │                        (interface)
  └── static React app (Vite dev server, or nginx in the container)
```

- **The browser only talks to its own origin.** Vite (dev) or nginx (container) forwards `/api` to the backend. Product images also go through the backend (`GET /api/images/:id`), so the client never touches `fakestoreapi.com`.
- **Product data sits behind `ProductRepository`** (`backend/src/repositories/ProductRepository.ts`). Routes and services only see that interface and an internal `ProductRecord`; the public JSON shape is mapped separately. Changing the source means one new adapter class plus one line in `repositories/index.ts`.
- **Email sits behind `Mailer`** (`backend/src/mail/Mailer.ts`). `MAIL_PROVIDER` picks the adapter:
  - `file` (default) writes `.eml` files.
  - `console` logs the email as JSON.
  - `smtp` sends to Mailpit locally, or to Amazon SES's SMTP endpoint on AWS.
- **`createApp(deps)`** builds the Express app from injected dependencies and reads no env. Tests pass in the fixture repository and an in-memory mailer.

### API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/products/featured` | Top `FEATURED_COUNT` (5) by rating |
| GET | `/api/categories` | `{ slug, name }` list |
| GET | `/api/categories/:slug/products` | `{ category, featured, others }` |
| GET | `/api/products?q=term` | Search; 400 if `q` is blank or over 100 chars |
| GET | `/api/products/:id` | 404 if unknown |
| GET | `/api/images/:id` | Image proxy |
| POST | `/api/enquiries` | `{ productId, name, email, phone?, message }` → 201 `{ enquiryId, message }` |
| GET | `/healthz` | Liveness; does not call upstream |

Errors always look like `{ "error": { "code", "message", "fields?" } }`.

## Configuration

All backend config is environment variables, validated at startup. The full list with comments is in [`backend/.env.example`](backend/.env.example). The frontend has one optional dev setting, `API_PROXY_TARGET` (default `http://localhost:4000`).

## Deploying to AWS (not done in this PR)

The images follow the usual container contract: env-only config, JSON logs on stdout, a `/healthz` endpoint, a non-root user and graceful `SIGTERM` handling. One straightforward layout:

- **Backend:** ECR image on ECS Fargate (or App Runner) behind an ALB, with `TRUST_PROXY=true`. Use `MAIL_PROVIDER=smtp` pointed at Amazon SES SMTP, with credentials from Secrets Manager.
- **Frontend:** either the nginx image on ECS (set `API_UPSTREAM`), or `frontend/dist` on S3 + CloudFront with `/api/*` routed to the ALB.

## More docs

- [`DECISIONS.md`](DECISIONS.md): assumptions, cuts, how it evolves, next steps
- [`AI_USAGE.md`](AI_USAGE.md): how AI was used and where it was corrected
- [`PR_DESCRIPTION.md`](PR_DESCRIPTION.md): the pull request write-up
