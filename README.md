# SplitNest

> Shared living. Smarter splitting.

SplitNest is a shared-expense app for a household. Create a home, add its members, split a bill between them to the cent, and let each member pay their own share. It is the solution to the assignment that is reproduced in full further down in this file.

**Payments are simulated.** Paying a share only records `paidAt` in the database. There is no payment gateway and no money moves. The UI says so on the payment confirmation.

## Features

- Create homes and add members; members keep their creation order.
- Create a bill from a dollar amount. The UI converts it to integer cents, previews each member's share with the same function the API uses, then saves the bill and its shares in one transaction.
- Bill details with per-member share, paid/outstanding badge and payment date.
- Pay a share with a confirmation dialog, a stable `Idempotency-Key`, double-click protection, and an error that leaves the share unpaid.
- Dashboard (outstanding total, bills, members, recent bills, who owes what) and a balances page with per-member progress.
- Skeleton loading, a "taking longer than usual" hint, empty states, error states with retry (including 404 and 500), validation messages, toasts and a responsive layout with a mobile navigation drawer.

## Technology stack

| Area     | Tools                                                           |
| -------- | --------------------------------------------------------------- |
| API      | TypeScript, Hono, Cloudflare Workers                            |
| Database | Cloudflare D1 (SQLite), SQL migrations in `api/migrations`      |
| Web      | React 19, Vite, TypeScript, TanStack Router (file-based routes) |
| Tests    | Vitest in the Workers runtime (`@cloudflare/vitest-plugin`)     |
| Quality  | Biome, `tsc --noEmit` in strict mode                            |

No other runtime dependencies were added. Icons are small inline SVGs, styling is one plain CSS file with design tokens, and validation is hand-written (a few small functions).

## Architecture

```text
Browser (React + TanStack Router)
   │  fetch /api/...   (Vite proxies /api to :8787 in development)
   ▼
Hono app on a Cloudflare Worker  ── routes → validation → SQL (D1 binding `DB`)
   ▼
D1 / SQLite  (constraints protect the data even if the API has a bug)
```

- **API** (`api/src`): thin routes that validate input, run SQL, and throw `HttpError`. One `onError` handler turns every error into `{ "error": "message" }`, so unknown errors become a JSON 500 and unknown routes a JSON 404.
- **Web** (`web/src`): `lib/api.ts` is the only code that calls `fetch`; it parses every response instead of trusting its shape. `hooks/useResource.ts` gives each page loading/error/success state. Pages are small and use shared components from `components/`.
- **Shared code**: `api/src/split.ts` is a pure function imported by both the API and the web app, so the bill preview can never disagree with the saved split.

## Project structure

```text
api/
  migrations/0001_init.sql     schema and constraints
  src/index.ts                 app, JSON error and 404 handlers
  src/routes/homes.ts          homes, members, balances
  src/routes/bills.ts          bills, shares, payments
  src/split.ts                 integer bill splitting (shared with web)
  src/validation.ts            body, amount and header validation
  src/errors.ts                HttpError
  test/                        original tests + edge-cases.test.ts
web/
  src/routes/                  one file per page (file-based routing)
  src/components/              app shell, UI kit, dialogs, icons
  src/context/                 current home, homes list, toasts
  src/hooks/                   useResource and data hooks
  src/lib/                     api client, money helpers, idempotency keys, summaries
  src/styles.css               design tokens and styles
```

## Database schema

All money columns are integer cents. Foreign keys are enforced by D1.

| Table     | Purpose                                                             | Named constraints                                                                                                                                                        |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `homes`   | A household                                                         | `homes_name_not_blank` (CHECK)                                                                                                                                           |
| `members` | People in a home; `seq` (AUTOINCREMENT) is the creation order       | `members_id_unique` (UNIQUE), `members_home_fk` (FOREIGN KEY), `members_name_not_blank` (CHECK)                                                                          |
| `bills`   | A bill for a home                                                   | `bills_home_fk`, `bills_total_positive` (CHECK integer and > 0), `bills_title_not_blank`                                                                                 |
| `shares`  | One member's part of a bill, `paid_at` and the paying `payment_key` | `shares_bill_fk`, `shares_member_fk`, `shares_amount_non_negative` (CHECK integer and >= 0), `shares_one_per_member` (UNIQUE bill + member), `shares_paid_state` (CHECK) |

What the important ones stop:

- `bills_total_positive` stops zero, negative and non-integer totals even if the API check is bypassed.
- `shares_one_per_member` stops a member getting two shares of one bill.
- `shares_paid_state` makes `(paid_at IS NULL) = (payment_key IS NULL)`, so a share is either unpaid or fully paid with a key. It can never be half paid.
- The foreign keys stop members, bills and shares that point at something that does not exist, and cascade deletes cleanly.

## API

Every error is `{ "error": "message" }`.

| Method and path                                                   | Success                                           | Errors                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| `POST /api/homes` `{ name }`                                      | 201 `{ id, name }`                                | 400 bad JSON, 422 bad name                                    |
| `POST /api/homes/:homeId/members` `{ name }`                      | 201 `{ id, homeId, name }`                        | 404 home, 400, 422                                            |
| `POST /api/homes/:homeId/bills` `{ title, totalCents }`           | 201 `{ id, homeId, title, totalCents, shares[] }` | 404 home, 422 bad amount / no members / bad title, 400        |
| `POST /api/bills/:billId/shares/:shareId/pay` + `Idempotency-Key` | 200 `{ id, memberId, amountCents, paidAt }`       | 400 key missing, 404 bill or share, 409 paid with another key |
| `GET /api/homes/:homeId/balances`                                 | 200 `{ balances[] }` in member order              | 404 home                                                      |
| `GET /api/health`                                                 | 200 `{ status: "ok" }`                            |                                                               |

Extra read endpoints used by the web app: `GET /api/homes`, `GET /api/homes/:homeId` (with members), `GET /api/homes/:homeId/bills`, `GET /api/bills/:billId`.

## Setup and development

You need Node 20+ and pnpm. If `pnpm` is not installed, `npx pnpm@10 <command>` works too.

```bash
pnpm install
pnpm dev          # api on http://localhost:8787, web on http://localhost:5173
```

`pnpm dev` applies the migrations to a local D1 database first. Open http://localhost:5173.

## Testing and quality

```bash
pnpm test         # 4 files: the 3 original files + api/test/edge-cases.test.ts
pnpm check        # Biome
pnpm typecheck    # tsc in both packages
pnpm build        # production build of the web app
```

`api/test/edge-cases.test.ts` adds tests for splitting (even, uneven, one member, fewer cents than members), invalid bodies and amounts, missing home/bill/share, missing or blank `Idempotency-Key`, repeated payments with the same and with a different key, 10 simultaneous payments, balances over several bills and homes, and direct tests of the database constraints. The original tests and `api/test/helpers.ts` are unchanged.

## Decisions

**1. Money is integer cents, and the split uses integer maths only.**
The API accepts `totalCents` only if it is a JSON number that is a safe positive integer (strings, decimals, zero and negatives get 422; there is also an upper bound so sums stay exact). `splitCents` gives everyone `floor(total / n)` and gives one extra cent to each of the first `total % n` members, so 1000 between 3 is `334, 333, 333` and the shares always sum to the total. "First" is defined by `members.seq`, an auto-increment column, so the order is a fact stored in the database and not an accident of query order. The web app never uses floats for money either: `parseAmountToCents` reads the digits of the typed string, and amounts are formatted from integers. Because the web app imports the very same `splitCents`, the preview cannot drift from what the API saves.

**2. Payment idempotency and concurrency are decided by one SQL statement, not by JavaScript state.**
The paying key is stored on the share (`payment_key`, with `paid_at`). Paying runs:
`UPDATE shares SET paid_at = ?, payment_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL`.
SQLite runs write statements one after another, so if several requests race for the same share exactly one finds `paid_at IS NULL` and updates the row; the others change zero rows. After the update the handler reads the stored row: if its `payment_key` equals the request's key, the answer is `200` with the stored result (this covers a retry and also the winner itself); if it is different, the answer is `409`. There is no in-memory state, so this also holds across Worker isolates. A key only has meaning for one share, which is why it can live on the share row instead of in a separate table. The test with 10 simultaneous different-key requests expects exactly one `200` and nine `409`, and the test with 10 simultaneous same-key requests expects ten identical `200` answers. In the browser, one key is created per payment attempt (`web/src/lib/idempotency.ts`) and reused for automatic retries (network error, timeout, 5xx) and for the "Try again" button. It is dropped only when the server gives a final answer.

**3. The database enforces the rules, the API only gives friendly errors.**
Validation in the API returns clear 4xx messages, but the schema repeats the important rules as named constraints: positive integer totals, non-negative integer shares, one share per member per bill, the paid-state check, and foreign keys (D1 enforces them). A bug or a direct write cannot create a negative bill or a half-paid share; the tests exercise these constraints directly. A bill and all its shares are inserted with `db.batch`, which is one transaction, so a bill never exists without its shares.

**Other choices.** There is no state library: a small `useResource` hook is enough for loading/error/success. The UI only changes a share to "paid" after the server answers 200 and the bill is reloaded. Response bodies are parsed with small type guards instead of casts.

## Demo video

Demo video (3 minutes or less): _link to be added before submission_

The app is only run locally (`pnpm dev`). It is not deployed anywhere.

## Known limitations

- There is no authentication, so anyone can pay any share. The assignment says "a member pays their share" and has no users.
- Members cannot be removed or renamed, and bills cannot be edited or deleted (not required).
- A bill splits between the members present when it is created. A member added later owes nothing for older bills.
- If a member were added in the few milliseconds between reading the members and inserting the shares, that member would be missing from that one bill. Fixing it needs a single `INSERT ... SELECT` and was left out to keep the code readable.
- The currency symbol is `$` and is not configurable.
- The Manrope font is loaded from Google Fonts; offline it falls back to a system font.

## AI assistance disclosure

This project was built with **Claude Code (Claude Sonnet 5.5, Anthropic)** running in the Claude desktop app. It was used to inspect the starter repository and the tests, write the migration, API, tests and web app, run the test/lint/type/build commands, and exercise the app in a browser. The submitter is expected to review the code and be able to explain every part of it.

---

# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173. The starter page shows a title. `/api/health` returns `{ "status": "ok" }`.

```bash
pnpm test         # run the visible tests in api/test
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.
