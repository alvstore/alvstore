# ALV Store — ERP & Storefront

Premium home-theater installer ERP: CRM, repairs (job sheets), POS, inventory, invoicing/quotations, finance, HR/payroll, procurement, chat, and a public marketing site.

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | **Next.js 14** (App Router, React 18, TypeScript), Tailwind + shadcn/ui, TanStack Query |
| Auth      | **Auth.js (NextAuth v5)** credentials provider → own API (bcrypt + JWT sessions) |
| Backend   | **Express + TypeScript** (`server/`) — replaces Supabase |
| Database  | **PostgreSQL** via **Prisma** (embedded PGlite for local dev; any Postgres in prod) |

No Supabase dependency remains at runtime: the original SQL migrations in
`supabase/migrations/` are applied to a plain PostgreSQL database, auth lives
in `auth.users` (bcrypt password hashes), file storage is served from disk by
the API, and the former edge functions are Express routes under
`/api/functions/*`.

## Quick start

```sh
# 1. install dependencies
npm install
npm --prefix server install

# 2. create + migrate + seed the database (one command)
npm run db:setup        # admin login: admin@alvstore.in / admin123

# 3. run everything (db socket :5433, API :4000, web :3000)
npm run dev:all
```

Open http://localhost:3000 — sign in with `admin@alvstore.in` / `admin123`
(override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before `db:setup`).

Runtimes can also be started individually:

```sh
npm run dev:db          # embedded PostgreSQL socket (dev only)
npm run dev:backend     # Express API on :4000
npm run dev             # Next.js on :3000
```

## Architecture

```
repo root                 Next.js app (src/app, src/screens, src/components)
├── src/app/              App Router: route wrappers + Auth.js handler
│   ├── (app)/            protected section — guarded by <ProtectedRoute>
│   ├── page.tsx…         public pages (marketing site, login, public share links)
│   └── api/auth/         Auth.js route handler
├── src/integrations/
│   └── supabase/client.ts   ← drop-in replacement client: same API surface
│                              (from()/auth/storage/functions), talks to our API
├── src/lib/router-compat.tsx  react-router-dom → next/navigation shim
└── server/               Express + Prisma backend (own package.json)
    ├── src/routes/data.ts       PostgREST-style data API over Prisma
    ├── src/routes/storage.ts    file uploads served from server/uploads
    ├── src/routes/functions.ts  edge-function ports (WhatsApp/Razorpay/…)
    ├── src/auth/                signup/login/password-reset, JWT middleware
    ├── tools/bootstrap-db.ts    applies supabase/migrations to plain Postgres
    ├── tools/introspect.ts      generates prisma/schema.prisma + relation meta
    └── tools/seed.ts            creates the admin user
```

### How data flows

Pages keep their original query-builder calls:

```ts
const { data } = await supabase
  .from("job_sheets")
  .select("id, status, customers(name)")
  .eq("status", "in_progress");
```

The client (`src/integrations/supabase/client.ts`) serializes the chain to a
compact JSON payload → `POST /api/backend/data/query` → the Express data router
translates it into a Prisma query (filters, embedded relations, ordering,
pagination, counts) → PostgreSQL. Responses keep the `{ data, error, count }`
shape, so the UI layer is unchanged.

### Authentication

- Email+password verified by the API against `auth.users.password_hash` (bcrypt).
- The API issues a JWT access token; Auth.js stores it in the session JWT.
- Client calls carry `Authorization: Bearer <token>`; the API enforces auth and
  anonymous-access rules per table (mirrors the old RLS public-token policies).
- `user_roles` (admin / staff / technician / customer) loads with the session.

### Production database

1. Provision PostgreSQL 14+.
2. Apply the schema: run the bootstrap against your DB —
   set `DATABASE_URL` and use `psql "$DATABASE_URL"` with
   `server/sql/bootstrap.sql`, then every file in `supabase/migrations/` in
   filename order, then `server/sql/own-auth.sql`
   (or point `PGDATA` tooling at it; the bootstrap tool currently targets the
   embedded dev database).
3. `server/.env`: `DATABASE_URL=postgres://user:pass@host:5432/alvstore`.
4. `npm --prefix server run prisma:generate && npm --prefix server run db:seed`.
5. Run the API (`npm --prefix server run dev` or build + start) and set
   `API_SERVER_URL` for the Next.js app to its address.

### Environment variables

Web (`.env`): `AUTH_SECRET`, `API_SERVER_URL` (see `.env.example`).
API (`server/.env`): `DATABASE_URL`, `JWT_SECRET`, optional Razorpay / SMTP /
WhatsApp credentials (see `server/.env.example`).

### Notes & known deltas

- **Realtime**: Supabase Realtime subscriptions were replaced with short
  polling (chat: 4 s, notifications: 10–15 s).
- **Edge functions**: WhatsApp/Razorpay ports are fully wired to provider APIs
  when credentials exist; email/SMS log to the server console until a provider
  is configured; Hikvision endpoints return 501 until configured.
- **Password reset**: without SMTP the reset link is printed in the API logs
  and shown inline on the forgot-password page (dev convenience).
- `supabase/` is kept only as the migration source + function reference; the
  running system never contacts Supabase.
