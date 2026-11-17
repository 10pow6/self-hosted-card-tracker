# Setup

The top-level [README.md](../README.md) has the same instructions in marketing-friendly form. This file is the operational reference, with extra notes the README skips.

## Prerequisites

- Python **3.11+** (3.13 tested).
- Node **22.22+** (22.x LTS). react-router 8 declares `engines.node >= 22.22.0`, so `yarn install` hard-fails on older Nodes (Vite 8 alone would accept 20.19+/22.12+).
- **Yarn classic** (v1) — install with npm once Node is present:

  ```bash
  npm install --global yarn
  ```

- **[uv](https://docs.astral.sh/uv/getting-started/installation/)** — Python package manager for the backend:

  ```bash
  pip install uv
  ```

- **Git**.
- *(Optional)* **Claude Code CLI** — only needed for the [metadata-enrichment skill](enrichment.md):

  ```bash
  npm install --global @anthropic-ai/claude-code
  claude   # first run walks you through sign-in
  ```

## Backend

```bash
cd backend
uv sync --extra dev
uv run python scripts/init_db.py
```

`uv sync` creates `backend/.venv` and installs the exact versions pinned in `backend/uv.lock`. The same commands work in bash, Command Prompt and PowerShell.

To use the venv directly instead of `uv run`, activate it as usual (`source .venv/bin/activate`, `.venv\Scripts\activate.bat`, or `.venv\Scripts\Activate.ps1`).

### Dependencies

Python dependencies are declared in `backend/pyproject.toml` and pinned in `backend/uv.lock`. Commit both. Dependabot scans `uv.lock` for security alerts.

```bash
uv add <package>                     # add a runtime dependency
uv lock --upgrade-package <package>  # bump one package (e.g. for a Dependabot alert)
uv lock --upgrade                    # bump everything within pyproject ranges
uv sync --extra dev                  # apply the lockfile to .venv
```

### Run the API

```bash
uv run uvicorn card_tracker.main:app --reload --port 8000
```

Health check: `curl http://127.0.0.1:8000/health` → `{"status":"ok"}`.

## Frontend

```bash
cd frontend
yarn install
yarn dev
```

Open <http://localhost:5173>.

## Recreating the database

The app has no migration framework. After any change to [`backend/src/card_tracker/db/schema.sql`](../backend/src/card_tracker/db/schema.sql):

```powershell
# Windows
del data\card_tracker.db
cd backend
uv run python scripts/init_db.py
```

```bash
# Linux/macOS
rm data/card_tracker.db
cd backend
uv run python scripts/init_db.py
```

Crops and scan images under `data/crops` and `data/scans` are not deleted by `init_db`; they're orphaned references after a wipe. Delete them too if you want a clean reset:

```bash
rm -rf data/scans data/crops
```

## DINOv2-small weights

The first scan triggers a `transformers` download of `facebook/dinov2-small` (~90 MB) into `data/models/`. Override the cache location:

```bash
export HF_HOME=/some/other/path
```

The embedder pins `HF_HOME` to `data/models/` if not already set, so by default the model lives next to your DB.

## Mobile capture

`yarn dev` prints LAN URLs (look for non-127.0.0.1 entries). Open `http://<your-ip>:5173/scan` on your phone. No HTTPS needed — the file-input + `capture="environment"` path works on plain HTTP. Android opens the camera directly; iOS shows a "Take Photo" picker (iOS UI policy, can't be bypassed without HTTPS + `getUserMedia`).

## Layout of the data directory

```
data/
├── card_tracker.db         SQLite (schema in backend/src/card_tracker/db/schema.sql)
├── scans/<scan_id>.jpg     Source page photos
├── crops/<scan_id>/slot_<i>.jpg  Warped per-card crops
└── models/                 HF cache (DINOv2 weights, etc.)
```

To back up the entire app: copy `data/`. That's the whole state.

## Troubleshooting

See [troubleshooting.md](troubleshooting.md).
