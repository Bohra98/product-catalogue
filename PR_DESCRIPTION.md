# Product catalogue PoC: React + Node, swappable product source and mailer

## Summary

Adds a small product catalogue that covers the five acceptance criteria:

1. **Home** shows the 5 top-rated products.
2. **Category** pages show the top-rated products in that category, then the rest.
3. **Search** shows only products matching the submitted term.
4. **Product tiles** open a product details page.
5. **Enquire** on a product opens a contact form. Submitting it emails the sales inbox and shows "Thank you".

The repo has two independent apps, each with its own `package.json` and `node_modules`:

- `backend/`: Node + Express + TypeScript. It is the only thing that talks to Fake Store.
- `frontend/`: React + Vite + TypeScript. It only calls same-origin `/api`, product images included.

## Key design points

- **`ProductRepository` interface** has two adapters:
  - `FakeStoreProductRepository`: live, validated with zod, cached in memory, with timeouts.
  - `FixtureProductRepository`: an offline snapshot, also used by tests.
  - A new data source is one new class plus one line of wiring.
- **`Mailer` interface** has three providers:
  - `file` (default): writes real `.eml` files.
  - `console`: logs the email.
  - `smtp`: Mailpit locally, Amazon SES SMTP on AWS.
  - No accounts are needed to see an enquiry arrive.
- **Image proxy** (`/api/images/:id`) keeps the browser off `fakestoreapi.com`. It only fetches from the configured Fake Store host.
- **Input safety:**
  - Zod validates every request and the env config.
  - Single-line fields reject control characters, which blocks email header injection.
  - The server looks the product up from its id instead of trusting client data.
  - JSON body limit, helmet headers, and a per-IP rate limit on enquiries.
  - Errors use one JSON shape and never leak upstream details.
- **Container-ready for AWS:** env-only config, JSON logs, `/healthz`, non-root user, graceful shutdown, `TRUST_PROXY` for an ALB.

## Assumptions (full list in `DECISIONS.md`)

- "Top rated" means highest average rating, then most ratings, then id.
- Category pages show the top 3 as featured, because categories only hold 4 to 6 items.
- Search is case-insensitive over title, description and category. Every word must match, and it runs on submit only.
- Enquiry fields: name, email and message are required; phone is optional.
- Prices are shown as USD.

## Trade-offs and cuts

- Enquiries are not stored and there is no queue. "Thank you" means the mail provider accepted the message.
- Cache and rate limit are in memory, so they apply per instance.
- API types are kept as two copies (`backend/src/contract.ts` and `frontend/src/api/types.ts`), the cost of separate packages. The next step is generating them from an OpenAPI spec.
- No Playwright E2E, no IaC, no auth or cart.

## Verification

- **npm:** automated tests, typecheck, production build, a smoke test against live Fake Store, and a manual browser pass of all five flows.
- **Docker:** checked by hand with `docker compose up --build`.
  - Containers come up healthy.
  - The API and image proxy work through nginx, and SPA deep links survive a refresh.
  - All five flows work at :8080.
  - Enquiries arrive in Mailpit at :8025.
- **Not yet:** a CI job for the Docker build, and an AWS deployment.

## How to test

```bash
npm run setup
npm test            # backend: Jest (59 tests), frontend: Vitest (14 tests)
npm run typecheck
npm run dev         # http://localhost:5173
```

Manual check:

1. The home page shows 5 products.
2. Click **Men's Clothing**. You should see 3 under "Top rated" and 1 under "More".
3. Search `ssd`. Two SSDs should appear and nothing else.
4. Click a tile, click **Enquire**, fill in name, email and message, and send. You should see "Thank you!".
5. `ls backend/outbox` shows the email as a `.eml` file.

Offline: set `PRODUCT_SOURCE=fixture` in `backend/.env`.

With Docker: `docker compose up --build`. Then open http://localhost:8080 for the app and http://localhost:8025 for the Mailpit sales inbox.

## Docs

- `README.md`: run, test, architecture, API, AWS notes
- `DECISIONS.md`: assumptions, cuts, how it evolves, next steps
- `AI_USAGE.md`: tools, instruction files, turning points, corrections

🤖 Generated with [Claude Code](https://claude.com/claude-code)
