# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three separate npm projects, each with its own `package.json` and lockfile. Install all three:

- `/` (root): shared tooling only (ESLint, Prettier, Vitest, Playwright). Runs the unit tests for `backend/` and `frontend/`, and the E2E tests in `e2e/`.
- `backend/`: Express 4 + Sequelize over SQLite.
- `frontend/`: Next.js 14 (App Router) + next-intl + HeroUI.
- `docs/`: Docusaurus site for the public docs. Excluded from lint and tests.

## Commands

Install: `npm install` in the root, `backend/`, and `frontend/` (CI uses `npm ci`).

Development (two servers):
- Backend: `cd backend && npm run migrate && npm run dev`, listens on port 8001. `dev` runs `tsoa spec-and-routes` first.
- Frontend: `cd frontend && npm run dev`, listens on port 8000.
- Other backend scripts: `npm run seed` (demo data), `npm run drop` (undo all migrations).

Tests:
- Unit tests: `npx vitest run` from the root. Bare `npm test` starts watch mode.
- One file: `npx vitest run backend/routes/members/delete.test.js`
- One test by name: `npx vitest run -t "name"` (add a file path to narrow it).
- Coverage: `npm run coverage`.
- E2E (non-Docker): `npx playwright install --with-deps`, then `npm run e2e:dev`. This builds and starts both servers via `playwright.dev.config.ts`. For one spec: `npx playwright test e2e/not-demo-mode.spec.ts --config playwright.dev.config.ts`.
- E2E (Docker): `docker-compose up --build`, then `npm run e2e:docker`. It targets `http://localhost:${HOST_PORT:-8000}`. If host port 8000 is taken, start the container with `HOST_PORT=8080 FRONTEND_ORIGIN=http://localhost:8080 docker-compose up --build` and run the tests with the same `HOST_PORT`.

Lint and format:
- `npm run lint` (root ESLint covers the whole repo; `frontend` also runs `next lint`).
- `npm run format:check` / `npm run format`. Prettier only covers `frontend/` and `backend/` `.ts/.js/.json`, not `e2e/`.

Build:
- Backend: `cd backend && npm run build` (tsoa, then tsc, then copies `public/swagger.json` into `dist/`). `npm start` runs `dist/index.js`.
- Frontend: `cd frontend && npm run build`.

## Backend architecture

- `backend/server.ts` builds the Express app and is the only place routes are registered. Every route file is a factory, `export default function (sequelize) { const router = express.Router(); ...; return router; }`, and each is mounted by hand with `app.use('/resource', factory(sequelize))`. Adding an endpoint means adding a file and a mount line in `server.ts`. Nothing is auto-discovered.
- Layout: `routes/<resource>/<action>.js` (for example `routes/cases/edit.js`), `models/` (Sequelize models, each defined through `defineX(sequelize, DataTypes)`), `migrations/` and `seeders/` (sequelize-cli), `middleware/`, and `config/`.
- tsoa is used only for `controllers/` (currently `HealthController` and `IndexController`). `tsoa spec-and-routes` generates `backend/routes.ts`, which `server.ts` imports, and `public/swagger.json`, which serves `/api-docs`. Both are generated, so run `tsoa spec-and-routes` (or `npm run build`) before a server can start from a clean checkout.
- Authorization lives in two middleware factories. `middleware/auth.js` provides `verifySignedIn` (JWT Bearer token from the `Authorization` header) and `verifyAdmin` (global role). `middleware/verifyEditable.js` provides project-level checks, such as `verifyProjectOwner`, `verifyProjectManagerFromProjectId`, and `verifyProjectDeveloperFromCaseId`, which resolve the project from the route params or from the case, run, or member record.
- Roles are stored as integers, which are indexes into the arrays in `routes/users/authSettings.js`. Global roles are `administrator` (0) and `user` (1). Project roles are `manager`, `developer`, and `reporter`. The project owner is `projects.userId` and is checked separately from membership. Read `docs/docs/usage/roles.md` for the full permission matrix.
- Backend config is read from environment variables in `config/config.js`. `DATABASE_PATH` controls the SQLite file, and the default `SECRET_KEY` is a development placeholder.
- Global rate limit: 1000 requests per hour per IP, applied to every route.

## Frontend architecture

- Routes live under `frontend/src/app/[locale]/`, with locale always in the URL (`de`, `en`, `pt-BR`, `zh-CN`, `ja`). `frontend/src/middleware.ts` handles locale routing, and `frontend/src/i18n/routing.ts` holds the locale list.
- Data access is in per-feature modules, for example `frontend/utils/*Control.ts` and `app/.../projects/[projectId]/members/membersControl.ts`. They call the backend with `fetch` and a token from `frontend/utils/token.ts` (`TokenProvider.tsx`). The API origin comes from `frontend/config/config.ts`: on the client it is `NEXT_PUBLIC_BACKEND_ORIGIN` or the relative `/api`, and during SSR in production it is `localhost:$PORT$API_PATH`.
- UI strings are in `frontend/messages/*.json`. `messages/strings.test.ts` requires every locale to have exactly the same keys as `en.json`, so a new string must be added to all five files.
- Frontend tests are colocated with their source (`*.test.ts`). The root Vitest config maps `@` to `frontend/`.

## Production and Docker

- The `Dockerfile` builds frontend (standalone output) and backend (`dist/`). `entrypoint.js` is the runtime. It runs `sequelize-cli db:migrate`, seeds when `IS_DEMO=true`, mounts the backend under `API_PATH`, and serves everything else through Next.js. This gives one process and one port (8000 in the container; the host port is `HOST_PORT` in `docker-compose.yaml`, default 8000). docker-compose 1.29 cannot nest defaults, so `FRONTEND_ORIGIN` does not follow `HOST_PORT` and must be set alongside it. The port is published on `HOST_BIND` (default `127.0.0.1`). `BASE_PATH` (build arg, e.g. `/test`) sets Next's `basePath` and `Config.basePath`; with it, set `API_PATH=/test/api` too and have the proxy forward the prefix unstripped (see README).
- `API_PATH` is a build argument. The Dockerfile rewrites `spec.basePath` in `backend/tsoa.json` with `jq` at build time, so changing it means rebuilding the image.
- The runtime layout (`backend/node_modules/express` imported from `entrypoint.js`, `backend/config` and `migrations` copied as-is) is what makes the single-process setup work. Check it if you change Docker or the file layout.

## CI

`.github/workflows/ci.yml` runs on push and PR to `main`/`develop`: root `format:check`, `lint`, and `test`, then a frontend build. `e2e.yml` runs Playwright against Docker and against the dev servers, on PRs only.
