# Setup

All install/setup commands are listed here. **Run them yourself** — Claude does not execute installs.

## Backend (Python)

From the repo root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Initialize the SQLite database:

```bash
python scripts/init_db.py
```

Run the API (from `backend/`, with venv active):

```bash
uvicorn card_tracker.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health`.

## Frontend (Vite + React + TypeScript)

From the repo root, scaffold once:

```bash
yarn create vite frontend --template react-ts
cd frontend && yarn
```

Then dev server:

```bash
yarn dev
```

## DINOv2-small weights

Auto-downloaded by `transformers` on first embed call and cached under `data/models/` (set via `HF_HOME` env var if you prefer). One-time network use — fully offline afterward.
