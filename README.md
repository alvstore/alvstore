# ALV Store — ERP & Storefront

Home-theater installer ERP: CRM, repairs, POS, inventory, invoices and quotations, finance, HR/payroll, procurement, chat, and a public marketing site.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Material UI 9 / Emotion, TanStack Query |
| Motion | Framer Motion for page/widget entrances; GSAP for leaf-text counters and scroll scrubbing only |
| Charts | Recharts with actual transaction data, 7/30-day controls, loading/empty/error states |
| Authentication | Auth.js v5 credentials → Express API, bcrypt passwords, JWT sessions |
| Backend | Express + Prisma + PostgreSQL; embedded PGlite is available for local development |

There is **one UI system**: MUI components styled with `sx`. Tailwind, shadcn, and Radix have been removed. SVG/canvas are used for drawing, not as a second UI kit. There is no Supabase runtime dependency; the compatibility client retains the old query-builder API and sends requests to our own backend.

## Quick start

Use Node.js 22+ and npm.

```sh
npm install
npm --prefix server install

# If local environment files are absent, copy the examples and set secrets:
# cp .env.example .env
# cp server/.env.example server/.env

# Create/update the schema, generate Prisma metadata, and seed defaults.
npm run db:setup

# Database socket :5433, API :4000, web :3000
npm run dev:all
```

Open http://localhost:3000. The development seed creates `admin@alvstore.in` / `admin123` **only if that account does not exist**. Override `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` before the first setup. Re-running setup does not reset an existing password or erase business data. Never use the development credentials in production.

Services can also run individually:

```sh
npm run dev:db
npm run dev:backend
npm run dev
```

### HTTPS and embedded previews

The web server binds to `0.0.0.0`; Next.js permits the sandbox `*.e2b.app` development origin. Browser requests always use relative `/api/backend/*` URLs. Next.js proxies them to `API_SERVER_URL`, which is server-side configuration; a browser must never call the sandbox's localhost API directly.

All three Auth.js cookies explicitly use `sameSite: "none"`, `secure: true`, and `partitioned: true` (CHIPS), with host-only `__Host-alv.*` names and no fixed cookie domain. Partitioning lets supported browsers retain the preview's CSRF/session cookies even when ordinary third-party cookies are blocked; CSRF validation is not bypassed. Use an HTTPS web origin for a non-local preview or deployment. For local HTTPS, `npm run dev:https` uses Next.js's development certificate support.

If sign-in fails with a security-check/cookie message, reload the preview and retry. The login page offers **Open sign-in in a new tab** for browsers that still prohibit embedded storage. Partitioned sessions are isolated by top-level site, so the standalone tab and embedded preview may require separate sign-ins. Blocking all cookies still prevents a session. The new cookie names replace the old `authjs.*` names, so existing sessions need a one-time sign-in again.

Only an actual credentials rejection is shown as **Invalid email or password**. Missing CSRF cookies, provider/network failures, and a callback without a retained session have distinct messages; none silently redirects to Dashboard as a successful login. Signup likewise reports when an account was created but automatic sign-in failed.

## Prisma database lifecycle

`server/prisma/schema.prisma` is the source of truth for 64 public models and the two auth models. There is no SQL migration directory to replay.

`npm run db:setup` performs:

1. Start a temporary embedded socket if the configured local database is not running.
2. `prisma db push --skip-generate` against the configured `DATABASE_URL`.
3. Generate the JavaScript/WASM Prisma client and source-schema query metadata.
4. Run the idempotent Prisma seed, which also installs `prisma/runtime.sql` functions and triggers.
5. Close only the temporary socket owned by setup.

Runtime SQL defines behavior Prisma cannot express (number generation, audit, finance/stock triggers); it does not create application tables. Setup uses no reset or accept-data-loss flags. If Prisma detects a destructive schema change, inspect it and back up the database rather than bypassing the warning. Schema push is not a substitute for a reviewed production change-management process.

Useful commands:

```sh
npm --prefix server run db:push
npm --prefix server run prisma:generate  # also regenerates API metadata
npm --prefix server run db:seed          # requires a running database
```

Metadata is generated from the full source schema, not the reduced runtime DMMF, so UUIDs and native `@db.Date` fields retain their types. Unchanged metadata is not rewritten, avoiding unnecessary API watcher restarts on no-op setup. The API validates/coerces date filters and writes, returns date-only fields as `YYYY-MM-DD`, and serializes Prisma decimals as JSON numbers. Audit writes set the actor identity transaction-locally so it cannot leak into another pooled request.

### External PostgreSQL

1. Provision PostgreSQL 14+ and a database/user permitted to manage the `public` and `auth` schemas. Back up any existing database.
2. Set `DATABASE_URL` to the external database. The local embedded default is `postgres://postgres:postgres@127.0.0.1:5433/postgres`.
3. Set unique `AUTH_SECRET`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and the HTTPS `APP_ORIGIN`.
4. Run `npm run db:setup` against that URL, inspect the result, then build and run:

   ```sh
   npm --prefix server run build
   npm run build
   npm --prefix server start
   npm start
   ```

5. Set the web server's `API_SERVER_URL` to the API's internal address and terminate public HTTPS at a trusted reverse proxy.

The isolated lifecycle test covers embedded PostgreSQL; an external PostgreSQL deployment must still be verified in its own environment.

## UI and motion conventions

Shared components are in `src/components/mui/`:

- `AnimatedPage` on every screen; `PageHeader` for titles and actions.
- `StatCard` / `CountUp`, `DataTable`, `FormDialog`, `ConfirmDialog`, search, tabs, status chips, and empty states.
- `WidgetCard`, `Sparkline`, `ProgressRing`, `TrendChart`, `ChecklistWidget`, `AgendaWidget`, `WorkloadCalendar`, and `DistributionWidget`.
- `SegmentedControl` for keyboard-operable moving selection pills; `ChartViewport` for first-visible chart drawing.

Dashboard's workload month grid uses actual task due dates/statuses and coordinates with its event/task agenda. Sales use a soft area chart; Finance keeps highlighted daily bars. The shared shell exposes **Cmd/Ctrl+K** page/action search, with a mobile search button and shortcuts derived from the existing role-filtered navigation. Shared MUI buttons, icon controls and navigation receive composable hover/press feedback; first-visible widget/counter entrances do not repeat on scroll, and reduced motion/print retain final content.

The authenticated sidebar now uses an inset rounded surface, a compact icon rail, quieter collapsible groups, a moving active-page pill and a fixed real-user profile/settings dock. Sidebar, header and Cmd/Ctrl+K open one shared search dialog. Existing routes/role rules and saved collapse preferences are preserved; corrupt/blocked storage, nested routes, the Customers → CRM redirect, mobile search focus handoff and desktop breakpoint changes are covered by regressions. Shared width/easing constants keep the drawer and content aligned. See [docs/sidebar-redesign.md](docs/sidebar-redesign.md) for the audit, implementation and verification.

Dashboard, Finance, Tasks, and Calendar adopt the new real-data widgets. The shared theme and kit provide consistent surfaces, focus treatment, and finite entrance/interaction timing throughout all 58 screens and all seven palettes. Financial trends are never fabricated, and failed requests are not presented as zero activity.

Use `Box component={motion.div}`, **never `Stack` as a motion host**. Animation tokens live in `src/lib/motion-presets.ts`; stagger delays are capped. Do not add blanket layout animation to editable forms or tables. GSAP may count numbers or read scroll progress, but must not pin/reparent React DOM. The public speaker section uses CSS sticky positioning. Repeating public decoration pauses offscreen/in hidden tabs and is replaced by static content for reduced motion. Print styles preserve actual document and barcode content.

The public reference audit, ERP mapping, and implementation notes are in [docs/ui-modernization.md](docs/ui-modernization.md). The follow-up scan, gap analysis, implementation plan and results are in [docs/interaction-audit.md](docs/interaction-audit.md). These are original components inspired by public widget patterns, not copied paid template source or assets.

## Verification

```sh
npm run check          # 58-screen UI guardrails, TypeScript, unit/API tests
npm run test:db        # opt-in disposable DB setup/seed/disconnect/recovery test
npm --prefix server run build
npm run build

# With DB/API/web already running, and Playwright Chromium installed:
npx playwright install chromium
npm run test:e2e
```

E2E uses the seeded admin unless `E2E_EMAIL` / `E2E_PASSWORD` are set. `E2E_BASE_URL` overrides the default `http://localhost:3000`; `CHROMIUM_EXECUTABLE_PATH` can select an existing browser. E2E creates disposable business records and cleans them up: use a development/test database, not production. Browser downloads may require an unrestricted development environment.

Latest verification: **22 root tests, 5 API/serialization tests, and all 27 browser tests passed**; both production builds passed. The browser sweep covered **61 routes at 390px and 1440px (122 visits)** without render boundaries, page overflow or collected console/page/API errors. The isolated DB lifecycle test also passed during the earlier database work and was not repeated for this UI-only follow-up. Detailed results and limitations are recorded in [docs/ui-modernization.md](docs/ui-modernization.md#verification-results) and [docs/interaction-audit.md](docs/interaction-audit.md#verification).

Coverage includes sidebar routes/roles/collapse persistence, corrupt/blocked preferences, customer-list redirects, frame-sampled selection movement after page scroll, mobile drawer/search focus and breakpoint scroll unlock, seven-palette sidebar text contrast, workload month counts/failure/retry/day coordination, keyboard selectors, command-palette search/focus/mobile navigation, actual-request refresh feedback, composable button press/reduced-motion states, first-view chart/counter/print behavior, real-data widget controls, task persistence/failure rollback, calendar validation/CRUD/task linkage, destructive confirmation/focus, seven-theme restoration, barcodes/print-media content, public overlays/marquees, and client-side navigation cleanup. The lifecycle test uses a separate temporary data directory and socket, never the developer's running database. Expected outage logs during that test are intentional.

For deterministic release checks, run schema/lifecycle tooling first, then use compiled API/web servers (`npm --prefix server start` and `npm start`) for the browser sweep rather than hot-reloading processes. The HTTPS iframe tests also need OpenSSL; they create temporary certificates and locally map only their two fixture hostnames. They verify Secure/SameSite=None/Partitioned cookies, login/reload/logout with third-party cookies allowed and blocked, and use a server-observed control cookie to prove blocking is active. Negative tests cover real invalid-password and CSRF rejection, simulated provider unavailability, and a missing retained session. This does not verify the live external Arena proxy or every browser policy. External asset/provider requests are stubbed in browser tests.

## API operations

- `GET /api/health`: liveness, independent of the database.
- `GET /api/ready`: database readiness; returns 503 during an outage.
- Pool defaults: max 1 embedded / 5 external clients, 5-second connection timeout, idle-client error handling.
- Database-unavailable responses use `503`, `DB_UNAVAILABLE`, and `Retry-After: 2`. Express 4 async failures reach the error middleware instead of terminating the API process.
- **Writes are never automatically replayed** after a disconnect because their commit outcome may be unknown.
- SIGINT/SIGTERM stop accepting requests and close Prisma/the pool with a bounded shutdown window.
- Web access uses `/api/backend/health` and `/api/backend/ready` through the same-origin proxy.

## Architecture

```text
src/app/                      App Router pages and Auth.js route
src/screens/                  58 screen modules
src/components/mui/           Shared MUI/motion kit and widgets
src/components/layout/        Drawer/AppBar shell and route protection
src/integrations/supabase/    Local compatibility client; not a Supabase service
server/prisma/schema.prisma  Authoritative database models
server/prisma/runtime.sql    Trigger/function behavior
server/tools/setup-db.ts     Prisma push → generate → metadata → seed
server/src/routes/           Data, uploads, integration functions
server/src/auth/             API credentials/JWT/password-reset handlers
server/src/generated/        API query metadata (no auth password exposure)
```

Web settings: `AUTH_SECRET`, `API_SERVER_URL` (see `.env.example`). API settings: `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`, optional provider credentials (see `server/.env.example`). `PGLITE_DATA_DIR` / `PGLITE_SOCKET_PORT` override the embedded database location/port; the latter must match `DATABASE_URL`.

## Production safety / existing limitations

This UI/database modernization is **not a full authorization/security review**. Before internet exposure, scope the generic data API's anonymous/public-share access and authenticated record access more narrowly; its current table allowlists do not enforce complete per-record share-token isolation. Review password-reset development behavior (links can be returned/logged without SMTP), remove development credentials, rotate any previously tracked secrets, and use deployment secret storage. Keep uploaded files, local DB data, certificates, and test artifacts outside version control.

External providers (Razorpay, messaging, Hikvision, email, and the optional PDF AI gateway) require their own credentials and were not live-tested. Realtime UI uses short polling rather than Supabase subscriptions. Provider configuration does not belong in browser code.
