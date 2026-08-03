# Setup

The top-level [README.md](../README.md) has the same instructions in marketing-friendly form. This file is the operational reference, with extra notes the README skips.

## Prerequisites

- Python **3.11+** (3.13 tested).
- Node **20.19+** or **22.12+** (Vite 8 requirement).
- **Yarn classic** (v1) — install with npm once Node is present:

  ```bash
  npm install --global yarn
  ```

- **Git**.
- *(Optional)* **Claude Code CLI** — only needed for the [metadata-enrichment skill](enrichment.md):

  ```bash
  npm install --global @anthropic-ai/claude-code
  claude   # first run walks you through sign-in
  ```

## Backend

### Linux / macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/init_db.py
```

### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python scripts/init_db.py
```

If PowerShell blocks the activation script:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Run the API

```bash
uvicorn card_tracker.main:app --reload --port 8000
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
python scripts/init_db.py
```

```bash
# Linux/macOS
rm data/card_tracker.db
cd backend
python scripts/init_db.py
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
