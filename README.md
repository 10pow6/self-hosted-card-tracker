<div align="center">

<img src="icon.png" alt="10pow6" width="96" height="96" />

# Card Tracker

**Self-hosted, offline-first inventory for binder-stored trading cards.**

Photograph a binder page → the app finds each card, indexes its physical location, and keeps a database of every unique card you own. Pokémon, sports, MTG, Yu-Gi-Oh — same database, same flow.

</div>

---

## The problem

If you store cards in binders, every "where did I put my Charizard?" devolves into flipping pages. Existing solutions either:

- Make you enter every card by hand (tedious for hundreds of cards).
- Charge a subscription.
- Rely on cloud APIs to identify cards (privacy + dependency on someone else's server).
- Lock you into one card type (Pokémon-only, sports-only).

**Card Tracker is type-agnostic, fully self-hosted, and offline by default.** Point your phone camera at a binder page; the app parses each pocket and tracks every card back to its physical location (binder → page → slot). The only network call in normal use is a one-time download of the local vision model on first run.

## How it works

1. **Capture.** Photograph or upload a binder page in any layout from 1×1 (toploader) up to 4×4 (16 pockets).
2. **Detect.** OpenCV finds the binder page in the photo, splits it into card-shaped slots, and pre-fills polygon boxes around each card.
3. **Adjust.** You drag corners to fix any boxes the detector missed, or mark slots as deliberately empty.
4. **Embed & match.** Each card crop is run through DINOv2-small (a 21M-parameter local vision model) and compared by cosine similarity against your existing card database.
5. **Resolve.** Strong matches link automatically. Ambiguous ones land in a work queue for a quick yes/no review. Cards with no near-neighbor become brand-new database entries.

Every step runs locally on your machine. No accounts, no cloud, no per-card API quotas.

## Features

- 📦 **Physical-location tracking** — binders → pages → slots, every placement linked to a canonical card identity.
- 🔍 **Visual similarity search** — DINOv2-small embeddings, brute-force cosine sim. Comfortable into the tens of thousands of cards.
- 📐 **Configurable layouts** — 1×1, 2×2, 3×3 (default), 3×4, 4×3, 4×4. Per-binder.
- 📱 **Mobile-first capture** — phone goes straight to the camera (Android) or "Take Photo" sheet (iOS).
- ✅ **Human-in-the-loop review queue** — keyboard shortcuts, defer/un-defer for ambiguous matches.
- 🧩 **Pluggable model slots** — swap detection / embedding / metadata-enrichment models in the future without UI changes.
- 🤝 **Forward-looking integrations** — placeholders for MCP servers and external agents to enrich card metadata.
- 🛡️ **Offline-first** — no third-party API keys required. The model weights download once.

## Stack

| Layer | What |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLite, OpenCV, PyTorch + transformers (DINOv2-small) |
| Frontend | Vite, React 19, TypeScript, Tailwind v4, shadcn/ui |
| Storage | Single-file SQLite at `data/card_tracker.db`; crops + scans on disk under `data/` |

## Setup

### Prerequisites

- **Python 3.11+** (3.13 tested).
- **Node 20.19+** or **22.12+** (Vite 8 requires this).
- **Yarn classic** (v1).
- **Git**.

### Clone

```bash
git clone https://github.com/10pow6/self-hosted-card-tracker.git
cd self-hosted-card-tracker
```

### Backend

#### Linux / macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/init_db.py
```

#### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python scripts/init_db.py
```

> If PowerShell blocks the activation script, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.

### Frontend

In a separate shell, from the repo root:

```bash
cd frontend
yarn install
```

### Run it

Two terminals (backend with venv active):

**Backend**
```bash
uvicorn card_tracker.main:app --reload --port 8000
```

**Frontend**
```bash
yarn dev
```

Open <http://localhost:5173> in your browser.

> The **first scan** triggers a one-time download of the DINOv2-small weights (~90 MB) into `data/models/`. Subsequent scans run fully offline. Override the cache location with the `HF_HOME` environment variable if you prefer.

### Mobile capture

Vite prints multiple LAN URLs when you run `yarn dev`. Open `http://<your-machine-ip>:5173` on your phone, navigate to a binder, and tap **Scan a page**.

- **Android Chrome**: tapping the upload tile opens the camera directly.
- **iOS Safari**: shows a "Take Photo / Photo Library" sheet (iOS UI policy — there is no way to bypass that with a plain `<input type="file">`; the only alternative is a live `getUserMedia` viewfinder, which requires HTTPS).

## Troubleshooting

- **`ETIMEDOUT 127.0.0.1:8000` from the Vite proxy on Windows.** Machines with WSL / Hyper-V / VirtualBox network adapters sometimes can't talk to the literal IPv4 loopback through Node. The bundled `vite.config.ts` already proxies via `localhost`. If it still trips, run uvicorn with `--host 0.0.0.0` so it listens on all interfaces.
- **First scan is slow.** That's the one-time DINOv2 weight download. Once cached under `data/models/` you'll see embeddings complete in ~50 ms per card on CPU.
- **Detection misses cards on dense layouts (4×4).** The CV thresholds (`MIN_CELL_FILL`, `MIN_HULL_FILL` in `backend/src/card_tracker/cv/grid.py`) were tuned for 3×3 cell sizes. You can still drag the boxes manually before commit; tighter thresholds for smaller cells are a known follow-up.

## Project layout

```
self-hosted-card-tracker/
├── backend/                    FastAPI + SQLite + OpenCV + DINOv2
│   ├── src/card_tracker/
│   │   ├── api/                HTTP endpoints
│   │   ├── services/           Business logic (binders, ingest, review, ...)
│   │   ├── cv/grid.py          Page detection
│   │   ├── embeddings/         DINOv2-small wrapper (lazy singleton)
│   │   ├── db/                 SQLite schema + connection
│   │   └── layouts.py          RxC layout parser/validator
│   └── scripts/init_db.py      Initialize the local database
├── frontend/                   Vite + React 19 + TS + Tailwind + shadcn
│   ├── public/icon.png         App icon (this one)
│   └── src/
│       ├── routes/             Dashboard, Scan, Binders, Cards, Review, Settings
│       ├── components/         Domain + UI components
│       ├── api/                Typed API clients
│       └── lib/layout.ts       Frontend layout helpers
├── data/                       Created on first run (SQLite + crops + scans + models)
├── docs/
│   ├── architecture.md         Data model + ingest pipeline + thresholds
│   └── setup.md                Same setup as here, with environment notes
└── sample_images/              Test images for the scan flow
```

## Further reading

- [docs/architecture.md](docs/architecture.md) — data model, ingest pipeline, similarity thresholds, embedder identity.
- [docs/setup.md](docs/setup.md) — setup instructions with extra environment notes.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 10pow6 LLC.

> The software is provided **"as is"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of the software.

## Support

If Card Tracker saves you a few "where did I put my Charizard?" hours and you'd like to chip in, **pay-what-you-want via Stripe**: <https://buy.stripe.com/cN2dUh9Jw0b1eo8000>. Entirely optional — the project is and stays MIT-licensed and self-hostable for free.

## 10pow6

- GitHub — <https://github.com/10pow6>
- Twitter — <https://twitter.com/10pow6>
- Discord — <https://discord.gg/6tr2kHcJ2b>
- YouTube — <https://www.youtube.com/@10pow6>
