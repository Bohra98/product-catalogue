# Decisions

## Assumptions where the acceptance criteria were unclear

**What "top rated" means.** Fake Store has no curated featured list. Products are ranked by average rating, then by number of ratings (a 4.8 from 400 people beats a 4.8 from 3), then by id so the order is stable. The home page shows the top 5 (`FEATURED_COUNT`). The rule lives in one function, `compareTopRated` in `backend/src/services/CatalogService.ts`.

**Top rated within a category.** Fake Store categories hold only 4 to 6 products. Showing the top 5 would often leave nothing for the "additional products" the criteria ask for. Category pages therefore show the top 3 (`CATEGORY_FEATURED_COUNT`) under "Top rated in …" and the rest under "More in …", both in rank order.

**Category URLs.** Category names such as `men's clothing` contain an apostrophe and a space. The backend derives a slug (`mens-clothing`) and maps it back, so URLs are clean and the client never needs to encode names.

**Search.**
- Matching is case-insensitive and covers the title, description and category name.
- The term is trimmed. A multi-word term must match every word, so `cotton jacket` finds products that mention both.
- Each word matches the start of a word, not any substring. `men` finds "Men's" and "Mens" but not "Women's" or "recommended". `jacket` still finds "jackets". The trade-off: `ring` no longer finds "Earrings".
- Query and product text are normalised the same way: accents are removed, apostrophes are dropped (`men's`, `men’s` and `mens` are the same) and other punctuation splits words (`t-shirt` = `t shirt`). Two neighbouring words are also tried joined, so `tshirt` finds both. A term made only of punctuation matches nothing.
- The search page checks the 100-character cap itself, so a hand-edited URL gets a clear message instead of the API's generic validation error.
- Results use the same top-rated order.
- Search runs when the user clicks Search or presses Enter, not on every keystroke, since the criteria say "clicking the search button".
- A blank term is blocked in the UI and rejected by the API (400). Terms are capped at 100 characters.
- Fake Store has no search endpoint, so the backend filters the list itself.

**Enquiry form.**
- Fields: name, email and message are required; phone is optional.
- The client sends only the product id. The backend looks the product up, so the email cannot name a product or price the customer did not see.
- The email goes to `SALES_INBOX`, with `Reply-To` set to the customer.
- "Thank you" shows once the mail provider accepts the message. If sending fails, the customer sees an error and keeps what they typed.

**"Sends to the sales inbox" without an email account.**
- The default provider (`file`) writes each email as a real `.eml` file to `backend/outbox/`.
- Docker Compose runs Mailpit, a local SMTP server with a web inbox, so reviewers can see the email arrive.
- Neither needs an account.

**Product images.** Fake Store image URLs point at `fakestoreapi.com`. If the browser loaded them directly, the client would be calling Fake Store, which the brief rules out. The backend proxies images at `/api/images/:id`, fetches only from the configured Fake Store host (so the proxy cannot be aimed at other hosts), and sets a one-day cache header.

**Currency.** Fake Store prices carry no currency. They are shown as USD.

## Dropped or simplified, and why

| Item | Why |
| --- | --- |
| Persisting enquiries (database) | The criteria only require the sales inbox to get the enquiry. A store adds a database to run locally and in AWS for no visible gain in a PoC. It is the first item under "next steps". |
| Queue and retries for email | The request waits for the provider to accept the email. Fine at PoC volume, and it keeps "Thank you" honest. |
| Auth, cart, checkout, pagination, sorting, filters | Outside the five criteria. |
| Playwright end-to-end tests | The critical path is covered by API tests (supertest) and UI flow tests (Testing Library) through the real router. I also clicked through all five flows by hand against the live Fake Store API. A browser E2E suite is a next step. |
| Infrastructure as code (CDK/Terraform) | The containers are ready for AWS, but provisioning an account is outside "runs locally in 10 minutes". The intended layout is in the README. |
| Shared types package | Backend and frontend are separate packages with separate `node_modules`, as requested. The API types live in `backend/src/contract.ts` and are copied to `frontend/src/api/types.ts`. Two copies can drift; the fix is in "next steps". |
| Distributed cache and rate limit | Both are in memory, so they work per instance. Fine for one container. |

## How it was verified

- **npm path:**
  - Automated tests and typecheck for both apps, and a production build.
  - A smoke test of every endpoint against live Fake Store.
  - A manual browser pass of all five flows, with the enquiry landing as a `.eml` file in the outbox.
- **Docker path:** tested by hand with `docker compose up --build` on Docker Desktop.
  - All three containers reach a running state, and backend and frontend report healthy.
  - nginx serves the SPA, including a refresh on deep links such as `/products/3` and `/categories/jewelery`.
  - nginx forwards `/api`, image proxy included.
  - All five flows work at :8080.
  - Each enquiry arrives in Mailpit at :8025, which also covers `SmtpMailer`.
- **Not covered:** the Docker checks are manual. No CI job builds the images or runs the stack yet, and nothing has been deployed to AWS.

## How this grows past the PoC

**Swapping the product source.** Write a class that implements `ProductRepository` (`listAll`, `getById`, `getImage`) and register it in `backend/src/repositories/index.ts`. Routes, services and the frontend do not change. The interface is small on purpose: with about 20 products, filtering and ranking in memory is simplest. For a large catalogue (a database, a PIM, OpenSearch), add query methods such as `findByCategory` and `search` to the interface and push the work into the adapter.

**Curated or merchandised "top rated".** Replace `compareTopRated`, or have `getFeatured` read a curated id list from config or a CMS. The API response shape stays the same.

**Swapping the email provider.** Implement `Mailer.send` and register it in `backend/src/mail/index.ts`. Amazon SES works today with `MAIL_PROVIDER=smtp` and SES SMTP credentials. A native SES v2 SDK adapter (IAM role, no SMTP password) would be about 30 lines.

**UI and theming.** Colours, spacing, radius and fonts are CSS custom properties in `frontend/src/styles.css`. A reskin or white-label theme overrides those variables without touching components. Components get data only through `frontend/src/api/client.ts`, so a move to React Query or server rendering touches one module.

**AWS readiness.**
- Config comes only from env vars, validated at boot.
- Logs are JSON lines on stdout, which CloudWatch picks up.
- `/healthz` does not depend on upstream, so a Fake Store outage does not get healthy tasks killed.
- The backend container runs as a non-root user and finishes in-flight requests on SIGTERM.
- `TRUST_PROXY` handles client IPs behind an ALB.
- Secrets (SMTP credentials) come in as env vars from Secrets Manager.

## With another day

1. **Add a CI workflow** (GitHub Actions) that runs tests, typecheck and `docker compose build`, so the Docker path stays verified without a manual run.
2. **Generate the API contract.** Publish an OpenAPI spec from the zod schemas and generate the frontend types from it, removing the hand-copied `types.ts`.
3. **Persist enquiries** (DynamoDB or Postgres) before sending, and send through a queue (SQS) with retries, so a mail outage never loses an enquiry.
4. **Playwright smoke test** of the five flows against `docker compose up`.
5. **Image caching.** Cache proxied images in memory or S3, or put CloudFront in front. Upstream images are 150 to 350 KB and take 1 to 3 s.
6. **Basic observability.** Request ids in logs, request metrics, and an alert on upstream error rate.
7. **Small UX gaps.** Loading skeletons, empty states for categories, and a link from the "Thank you" message back to browsing.
