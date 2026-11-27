# CLAUDE.md

## Project Context
This repository implements a small product catalogue proof of concept designed to evolve into a production system without throwing away the foundation.
- **Client**: React with TypeScript
- **Backend**: Node.js with TypeScript
- **Goal**: Clean architecture, clear assumptions, fast local startup (<10 minutes), and critical-path tests

## Non-Negotiable Architecture Rules
1. **No Direct Fake Store Calls from Client**: The frontend must never call the Fake Store API (`fakestoreapi.com`) directly. All product data must come through our backend API
2. **Swappable Data & Mail Boundaries**:
   - Isolate product data access behind a repository/adapter interface so the backing data source can be swapped later without rewriting UI components or route handlers.
   - Isolate enquiry/email sending behind a mailer/provider interface so email providers can be swapped later.
   - Support a zero-paid-account local/dev flow so a reviewer can run and test everything locally without creating paid external accounts.
3. **AWS Compatibility & Local Setup**: Keep any infrastructure/container definitions compatible with AWS, and keep local startup straightforward (ideally 1–2 commands, e.g., `docker compose up` or clear dev scripts).
4. **Secrets & Config**: Never commit secrets or API keys. Use `.env.example` for configuration templates.

## Working Conventions
- Prefer small, readable, well-typed modules with clear error handling and input validation over over-engineered abstractions.
- Keep changes focused on the critical path: Home (5 top-rated/featured products), Category (top-rated + additional products in category), Search (matching search term on search submit), Product details, and Enquiry (contact form -> sales inbox flow + "Thank you" message).
- Record assumptions, simplifications, trade-offs, and AI workflow notes in `DECISIONS.md`, `AI_USAGE.md`, and `README.md`.

## Repo Layout & Commands
- `backend/` and `frontend/` are independent apps, each with its own `package.json`, lockfile and `node_modules`. No npm workspaces; the root `package.json` only holds zero-dependency convenience scripts.
- Backend tests use **Jest** (`@swc/jest`, native ESM mode). Frontend tests use **Vitest** + React Testing Library.
- API contract types live in `backend/src/contract.ts` and are copied to `frontend/src/api/types.ts`. Change both together.
- From the root: `npm run setup`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.
