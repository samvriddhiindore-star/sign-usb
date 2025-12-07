# USB Control Backend — Functionality & Tech Overview

This document summarizes the project's technology stack, core functionality, architecture, database schema, API surface, environment variables, run/build instructions, file map, and recommended next steps.

**Purpose**: The app is a full-stack USB management/control application (backend + Vite React frontend) that allows admins to manage users, machines, policies, and record USB usage logs.

**Project root**: `UsbControlBackend`

**Quick summary**
- **Backend**: Node.js + TypeScript, Express-style server, Drizzle ORM for Postgres
- **Frontend**: React + Vite (client is in `client/`)
- **DB**: Postgres (Neon remote connection used in `.env`)
- **Auth**: JWT and bcryptjs for password hashing
- **Dev tools**: `tsx` for running TypeScript directly in dev; build outputs are in `dist/`

**Tech Stack**
- **Language**: TypeScript (ESM)
- **Runtime**: Node.js (recommended Node 18+; works with later Node versions)
- **Frontend bundler**: Vite
- **ORM**: Drizzle ORM (schema in `shared/schema.ts`)
- **Database**: Postgres (Neon recommended for existing config)
- **Auth**: `bcryptjs` (password hashing), JWT tokens (session management)
- **Process manager / deployment hints**: `pm2`, `systemd`, Docker + reverse proxy (Nginx)

**Core Functionality / Features**
- Admin creation and login flows (seeded default admin present in repo tools)
- User CRUD (create, read, update, delete) via protected API and client UI
- Machine management (register machines, view, etc.)
- Policy management (create/assign policies to machines/users)
- USB logging (record device connect/disconnect and metadata)
- Client dashboard pages for viewing and managing users, machines, logs, and policies
- Dev server that uses Vite middleware for hot reload during development

**Database (high-level)**
Tables (defined in `shared/schema.ts`):
- `admins` — admin users (authentication + roles)
- `machines` — registered machines/endpoints
- `policies` — USB access policies and rules
- `usb_logs` — logs of USB events (connect/disconnect, timestamps, machine/user reference)

(For full schema details, see `shared/schema.ts`.)

**Backend API surface (high level)**
- Authentication
  - `POST /api/admin/register` — register admin (used in seed and tests)
  - `POST /api/admin/login` — login admin (returns JWT)
- Users
  - `GET /api/users` — list users
  - `GET /api/users/:id` — get single user
  - `POST /api/users` — create user
  - `PUT /api/users/:id` — update user
  - `DELETE /api/users/:id` — delete user
- Machines, Policies, Logs
  - CRUD endpoints exist for machines/policies and endpoints for USB logs (see `server/routes.ts` and `server/storage.ts`)

Security: most protected endpoints require a valid JWT; server uses `JWT_SECRET` from environment.

**Important environment variables (from `.env`)**
- `DATABASE_URL` — Postgres connection string (present in `.env` in repo; rotate if publicly exposed)
- `NODE_ENV` — `development` | `production`
- `PORT` — server port (default `3000`)
- `HOST` — host binding (`localhost` or `0.0.0.0`)
- `JWT_SECRET` — JWT signing secret (must be strong in production)
- `SESSION_SECRET` — session secret (if session-based flows used)

**Run / Build / Deploy**
- Development (local):

  ```bash
  npm install
  npm run dev
  # dev uses tsx to run server code and Vite middleware for client
  ```

- Production build + run (example):

  ```bash
  npm ci
  npm run build
  # start the built server
  NODE_ENV=production PORT=3000 DATABASE_URL="postgresql://..." JWT_SECRET="..." SESSION_SECRET="..." node dist/index.cjs
  ```

- Process manager examples:
  - `pm2 start dist/index.cjs --name sign-usb --env production`
  - `systemd` unit referencing an env file (recommended for servers)

- Reverse proxy / TLS: Use Nginx or Caddy to terminate TLS (HTTPS), then proxy to `http://127.0.0.1:3000`.

**Files & Code map (high-level)**
- `server/` — backend server code
  - `server/index.ts` — server entry (starts Express server)
  - `server/routes.ts` — Express-style route definitions
  - `server/storage.ts` — DB access layer using Drizzle
  - `server/vite.ts` — dev-only Vite middleware wrapper
  - `server/auth.ts` — auth helpers (JWT validation), if present
  - `server/static.ts` — static file serving in production (if used)
  - `server/seed.ts` — seed script to insert default admin
- `shared/schema.ts` — DB schema for Drizzle ORM
- `client/` — Vite + React app
  - `client/src/lib/api.ts` — client API wrappers
  - `client/src/pages/` — dashboard, users, machines, logs pages
  - `client/index.html`, `client/src/main.tsx` — frontend entry
- `vite.config.ts` — Vite config (ESM `__dirname` handling)
- `package.json` — scripts and dependencies
- `FUNCTIONALITY.md` — (this file)
- `.env` — local environment variables (DO NOT commit to public repos)

**Operational notes & recommendations**
- Secrets & credentials: rotate the DB credentials if `.env` content was exposed publicly. Use a secrets manager in production.
- Node version: use Node 18+ (Node 20 recommended). The project uses ESM patterns (uses `fileURLToPath(import.meta.url)` for `__dirname`).
- Use `npm ci` in CI/CD for reliable installs using `package-lock.json`.
- Add health-check endpoint and optional metrics for monitoring.
- Run `npm audit` and patch vulnerabilities as part of maintenance.

**Suggested next steps / optional artifacts I can add**
- Add a production `Dockerfile` + `docker-compose.yml` for easy containerized deployment.
- Provide a `systemd` unit file or `pm2` ecosystem file and example `nginx` config for reverse proxy and TLS.
- Create simple health-check endpoint and readiness probe.
- Generate API documentation (OpenAPI / Swagger) for the backend.

---

If you'd like, I can now:
- Create the `FUNCTIONALITY.md` file in the repository (already done),
- Commit & push it to `origin/main`,
- Or generate one of the optional artifacts above (Dockerfile, `systemd` unit, `nginx` config, or Swagger doc).

Tell me which follow-up you'd like and I will proceed.
