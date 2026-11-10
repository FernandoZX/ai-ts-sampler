# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install deps: `pnpm install` (package manager is pinned via `packageManager: pnpm@10.12.3`)
- Run the server: `pnpm start` (`node server.js`)
- Run the server with auto-reload: `pnpm dev` (`nodemon server.js`)
- There is no test suite, lint config, or build step configured in this repo.

Server listens on `PORT` env var, defaulting to `3000`.

## Architecture

This repo contains two unrelated things sharing one root:

1. **`server.js`** — the real application. An Express 5 app that:
   - Applies `middleware/rateLimit.js` (a custom in-memory, per-IP sliding-window limiter) only on `GET /`.
   - Exposes a trivial in-memory `items` CRUD demo directly inline (`/api/items*`).
   - Mounts the job-board API from `APIS-INTELIGENCIA-ARTIFICIAL/` at `/api`.
   - Has a catch-all 404 handler and a final error-handling middleware (handles JSON parse errors and payload-too-large as 4xx, everything else as 500).

2. **`index.html` / `game.js` / `styles.css`** and **`index.js`** — unrelated static leftovers (a simple click-speed browser game, and a standalone arithmetic module). Not wired into `server.js`; treat as independent of the API work unless told otherwise.

### `APIS-INTELIGENCIA-ARTIFICIAL/` — job board API

This is a small in-memory (no DB) REST API for a job-board platform ("Plataforma de trabajos"), with Spanish field/route naming throughout. Structure:

- **`data.js`** — the entire data layer: in-memory arrays (`users`, `companies`, `jobs`, `applications`, `savedJobs`), id sequencing, CRUD helpers, authorization predicates (`canManageCompany`, `canManageJob`), and `present*` functions that shape entities for API responses based on the viewer (role-based field visibility, e.g. contact info or applicant counts only shown to owners/admins). Also seeds demo accounts/jobs on startup via `seed()`. All state is lost on restart.
- **`auth.js`** — bearer-token auth (opaque random tokens in an in-memory `sessions` Map, not JWT), scrypt password hashing with timing-safe comparison, and a per-IP+email login-failure lockout (`loginRetryAfter`/`recordLoginFailure`, 15 min window, 8 max fails). Exposes `requireAuth`, `optionalAuth`, `requireRole(...roles)` middleware.
- **`http.js`** — shared request-parsing/validation helpers (`takeText`, `takeEnum`, `takeNumber`, `takeId`, `takeUrl`, `normalizeEmail`, `takePassword`, pagination, etc.) plus the `catalogos` enum of valid values (categories, modalities, job types, experience levels, job/application states, roles). Routes build validation by composing these `take*` helpers against a `detalles` (error messages) array; a request is rejected if `detalles` is non-empty.
- **`jobQuery.js`** — `queryJobs()`: shared filtering/sorting logic for listing jobs (used by both the public job search and an owner's "my jobs" view via `allowAnyEstado`).
- **`index.js`** — mounts all `routes/*` under `/api`, seeds demo data on load, and exposes `/api/plataforma` (self-describing endpoint list + demo credentials) and `/api/catalogos`.
- **`routes/`** — one router per resource (`auth`, `usuarios`, `empresas`, `trabajos`, `postulaciones`, `guardados`, `admin`), each following the same pattern: parse via `http.js` helpers → authorize via `auth.js` middleware and `data.js` predicates → mutate/read `data.js` arrays → shape response via `present*`.

Authorization model: three roles — `candidato`, `empleador`, `admin`. Companies have an `propietarioId` owner; jobs have an `autorId` and belong to a company. `canManageJob`/`canManageCompany` in `data.js` are the single source of truth for "can this user edit/delete this resource" — reuse them rather than re-deriving ownership checks in routes.

## Conventions

- All API-facing identifiers (routes, JSON fields, error messages) are in Spanish; keep new code consistent with this.
- Validation follows a consistent shape: collect problems into a `detalles: string[]` array via the `take*`/`asBody` helpers in `http.js`, then `fail(res, 400, "Datos inválidos", detalles)` if non-empty. Reuse these helpers instead of writing ad hoc per-route validation.
- There is a Cursor agent at `.cursor/agents/anti-hacking-agent.agent.md` (Spanish) that reviews code for SQL injection, brute-force protection, and missing rate limiting — relevant context since this API hand-rolls its own rate limiting and auth rather than using a library.
