# Geneeez

Dataset analytics platform — backend (FastAPI) + frontend (Next.js + Ant Design).  
This document describes project structure, setup, running, common issues, API reference, and developer notes.

---

## Table of contents

- Project overview
- Architecture & tech stack
- Repo layout
- Prerequisites
- Environment variables
- Backend: install & run
- Frontend: install & run
- Database: init & seeding
- Polars / native libs troubleshooting
- Common issues & troubleshooting
- API summary
- Frontend pages & components
- Performance tips
- Testing
- Contributing

---

## Project overview

Geneeez is a no-code dataset analytics tool.  
- Backend provides dataset ingestion, previews, schema, charts and recipe-based analyses.  
- Frontend offers a lightweight dashboard UI (Ant Design) with dataset explorer, preview, visualizations and analytics panels.

---

## Architecture & tech stack

- Backend: FastAPI, SQLAlchemy, Pydantic, Polars (for fast columnar data ops), PostgreSQL, psycopg2-binary
- Frontend: Next.js (React), Ant Design, Recharts
- Storage: Local `storage/` (served with StaticFiles)
- Dev: Python 3.10+, Node 18+, Docker (optional for Postgres)

---

## Repo layout

- api/ — FastAPI app entry (main.py), routers, models, schemas
  - api/app/routers — routers (auth, datasets, analysis, recipes, ...)
  - api/app/db.py — SQLAlchemy engine, session, Declarative Base
  - api/app/models.py — ORM models
  - api/app/schemas.py — Pydantic schemas
  - scripts/ — optional seed scripts
- web/ — Next.js frontend
  - web/pages — route pages (`/`, `/datasets`, `/datasets/[id]`, ...)
  - web/components — reusable React components (ChartPanel, ColumnDrawer, AppShell, ...)
  - web/context — auth context
- storage/ — static file storage (served at `/files`)
- .env — environment variables for backend

---

## Prerequisites

- Python 3.10+ (use virtualenv or venv)
- Node 16+ / 18+
- PostgreSQL (local or in Docker)
- Optional: Docker / docker-compose for Postgres

---

## Environment variables

Put these in `api/.env` or root `.env` depending on loader:

- FRONTEND_ORIGIN=http://localhost:3000
- JWT_ACCESS_SECRET=...
- JWT_REFRESH_SECRET=...
- ACCESS_TTL_MIN=15
- REFRESH_TTL_DAYS=7
- DATABASE_URL=postgresql+psycopg2://<user>:<password>@127.0.0.1:5432/<db>
  - Note: use `postgresql+psycopg2://` for SQLAlchemy + psycopg2-binary.
  - URL-encode special chars in username/password.
- MONGODB_URI (if used)
- PUBLIC_API_BASE=http://127.0.0.1:8080

---

## Backend: install & run

1. Create virtualenv and activate:
   - Windows (PowerShell): `python -m venv .venv; .\.venv\Scripts\Activate.ps1`
   - Windows (cmd): `python -m venv .venv && .\.venv\Scripts\activate`
2. Install:
   - `pip install -r api/requirements.txt`
   - Ensure `psycopg2-binary` and `polars` are installed: `pip install psycopg2-binary polars`
3. Run dev server:
   - From project root: `uvicorn api.main:app --reload --host 0.0.0.0 --port 8080`
   - Health: GET http://127.0.0.1:8080/health

Notes:
- If DB not reachable, FastAPI startup may error. Ensure DB is up and credentials match `DATABASE_URL`.

---

## Frontend: install & run

1. `cd web`
2. `npm install` or `pnpm install`
3. Run dev: `npm run dev` (default: http://localhost:3000)
4. Configure `PUBLIC_API_BASE` if backend port differs.

---

## Database: init & seeding

- init_db() creates tables. It's invoked at FastAPI startup in `api/main.py` (check implementation in `api/app/db.py`).
- Two options for seeding recipe templates:
  - Startup seeding inside `@app.on_event("startup")` — implemented if present in `main.py`.
  - Dedicated script: `python scripts/seed_recipes.py` (recommended for deterministic runs).

If using startup seeding, ensure:
- A single startup handler performs init + seeding.
- Use SQLAlchemy session (SessionLocal) and commit, then close session.

Example seed script (run manually):
```bash
python scripts/seed_recipes.py
```

---

## Polars: installation & troubleshooting

- Install: `pip install polars`
- Common problems:
  - ModuleNotFoundError: ensure the backend process uses the same virtualenv where polars is installed.
  - On Windows, use latest pip and wheels: `pip install -U pip wheel setuptools` then `pip install polars`.
  - If running inside Docker, install polars in Docker image or use manylinux wheel compatibility.
- Verify: in Python shell used by backend:
  ```py
  import polars as pl
  print(pl.__version__)
  ```

---

## Common issues & fixes

- Database auth fails:
  - Use `postgresql+psycopg2://` in DATABASE_URL.
  - URL-encode `@`, `:` or spaces.
  - Confirm user exists and has privileges on database.
- Module not found after pip install:
  - Activate correct venv before running server.
  - Restart the process after installing packages.
- Spinner stuck on login:
  - Ensure auth context sets `initializing = false` on both success and failure.
  - Do not redirect preemptively; let login page render when `user === null && !initializing`.
  - Add request timeout on `/auth/refresh` to avoid indefinite waits.
- Frontend layout broken / unreadable:
  - Check for missing component imports or invalid style modifications.
  - Revert recent layout changes if things render vertically — missing flex/width rules often cause this.
- Slow charts / navigation:
  - Cache chart results server-side.
  - Sample large datasets before sending to frontend.
  - Memoize React components and debounce query generation (ChartPanel improvements help).

---

## API summary (important endpoints)

- Auth
  - POST /auth/login — body: { email, password } → sets cookies / returns tokens
  - POST /auth/refresh — refresh session cookie
  - POST /auth/logout
- Datasets
  - GET /datasets — list
  - GET /datasets/{id} — metadata / schema
  - GET /datasets/{id}/preview — first N rows
  - GET /datasets/{id}/download?fmt=csv — file download
- Analysis / Charts
  - POST /datasets/{id}/chart — payload: { kind, x, y, bins, sample, ... } → returns chart data (hist/bar/line/scatter)
- Health
  - GET /health — service health check

Refer to `api/app/routers` for full input/output shapes and validation.

---

## Frontend pages & components

- Pages:
  - `/` — login / signup
  - `/datasets` — list datasets
  - `/datasets/[id]` — dataset detail, explorer, preview, visualize (ChartPanel)
- Key components:
  - AppShell — top bar + layout
  - ChartPanel — chart controls + rendering (Recharts)
  - ColumnDrawer — column details side panel
  - useAuth context — manages user, initializing, refresh logic

---

## Performance tips

- Backend:
  - Use Polars for columnar ops and sampling.
  - Add caching (in-memory or redis) for chart payloads.
  - Sample large datasets server-side (limit to 5k points).
- Frontend:
  - Memoize chart renderers (React.memo).
  - Debounce filter/option changes before requesting charts.
  - Virtualize tables for huge previews (react-window / rc-virtual-list).
- Network:
  - Use gzip/deflate and keep responses compact (send numeric arrays, not full objects where possible).

---

## Testing

- Backend: run pytest from `api` if tests present:
  ```bash
  cd api
  pytest -q
  ```
- Frontend: run Jest/RTL if configured:
  ```bash
  cd web
  npm test
  ```

---

## Contributing

- Create feature branch, run linter/tests before PR.
- Keep API-compatible changes documented.
- For UI work, preserve existing routes and props.

---

## Troubleshooting quick checklist

- 500 on startup → check DB URL, DB up, migrations/init_db run.
- ModuleNotFoundError → activate venv used by server.
- Auth spinner → ensure `/auth/refresh` times out and `initializing` is set false on error.
- Chart errors → check `runChart` payload, required fields (x/y), and server logs.

---

## Contact & license

- Internal repo for team use. Add maintainers and license file as needed.

---
