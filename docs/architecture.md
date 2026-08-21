# Architecture

High-level layers and where things live. For details on each topic, follow the cross-references.

## System layers

```
┌────────────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React 19 + TS + Tailwind v4 + shadcn/ui)         │
│   ├── routes/        thin screens (Home, Scan, Binders, Catalog…)  │
│   ├── features/      feature modules (scan, review, catalog, …)    │
│   ├── components/    PolygonEditor, CardThumb, Pagination, …       │
│   └── api/           typed clients → /api/* fetches                │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ HTTP (Vite dev proxy → :8000)
┌──────────────────────────────────▼─────────────────────────────────┐
│  Backend (FastAPI on Python 3.11+)                                 │
│   ├── api/           thin routers (binders, cards, pages, review,  │
│   │                  scans, dashboard, settings, enrich,           │
│   │                  placements)                                   │
│   ├── services/      business logic (binders, ingest, review,      │
│   │                  cards, pages, dashboard, settings_svc, match, │
│   │                  placements, enrich, export)                   │
│   ├── cv/grid.py     page bbox + per-cell card refinement          │
│   ├── detectors.py   detector registry + per-binder config schema  │
│   ├── matchers.py    pluggable matching strategies                 │
│   ├── embeddings/    DINOv2-small wrapper (lazy singleton)         │
│   └── db/            SQLite schema + connection helpers            │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│  Storage (everything under data/)                                  │
│   ├── card_tracker.db   SQLite — schema in db/schema.sql           │
│   ├── scans/            source page photos (JPEG)                  │
│   ├── crops/            warped per-card canonical crops            │
│   └── models/           HF cache for DINOv2 weights                │
└────────────────────────────────────────────────────────────────────┘
```

Data flow is unidirectional: routes call services, services call cv/embeddings/db. No service imports from `api`. Pure functions where practical.

## Storage conventions

- **DB stores relative paths** (e.g. `crops/abc123/slot_0.jpg`). The API converts to URLs (`/data/crops/abc123/slot_0.jpg`) via `services/paths.py`. FastAPI serves `data/` through `StaticFiles` so URLs resolve.
- **Embeddings live in SQLite as `BLOB`s** (float32 bytes via `numpy.tobytes()` / `numpy.frombuffer`). One vector per `core_card` and per `placement` (the latter so we can re-rank candidates without re-embedding).
- **Source photos and crops live on disk**, not in SQLite, to keep the DB small.

## Per-component links

- Data model & SQL schema → [data-model.md](data-model.md).
- The capture-to-commit user journey → [scan-flow.md](scan-flow.md).
- CV details → [detection.md](detection.md).
- Embedding model + matching thresholds → [embeddings.md](embeddings.md).
- Review queue semantics → [review-queue.md](review-queue.md).
- Layout system → [layouts.md](layouts.md).
- HTTP endpoints → [api.md](api.md).

## Constraints

- **Offline at runtime.** The only acceptable network call is the one-time DINOv2 weight download from Hugging Face on first scan, cached in `data/models/`.
- **No paid APIs, no external card databases.** Future integrations (MCP servers, lookup agents) are opt-in placeholders surfaced under Settings.
- **SQLite single-file storage.** Brute-force NumPy similarity search is fine into the tens of thousands of cards. Migrate to `sqlite-vec` or FAISS if that ceiling becomes uncomfortable.
