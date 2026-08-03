# Troubleshooting

Failure modes that have actually been hit. Add new entries here when you find a new one.

## `ETIMEDOUT 127.0.0.1:8000` from the Vite proxy

**Symptom**: Vite dev server logs `http proxy error: /api/... Error: connect ETIMEDOUT 127.0.0.1:8000`.

**Likely cause**: machines with WSL / Hyper-V / VirtualBox virtual network adapters sometimes fail to route Node's connect to the literal IPv4 loopback. The TCP SYN gets silently dropped or delayed past the OS connect timeout (~21 s on Windows).

**Fixes, in order**:

1. The bundled [`vite.config.ts`](../frontend/vite.config.ts) already proxies via `localhost` (DNS-resolved) instead of `127.0.0.1`. If your edits regressed that, restore it.
2. Bind uvicorn to all interfaces:
   ```bash
   uvicorn card_tracker.main:app --reload --host 0.0.0.0 --port 8000
   ```
   This dodges any IPv4/IPv6 ambiguity in `localhost` resolution.
3. Confirm direct connectivity from the same machine:
   ```powershell
   curl http://127.0.0.1:8000/health
   ```
   If curl fails too, the issue is below the dev server — Windows Defender or corporate AV is dropping loopback. Whitelist Python or use a different port.

## First scan is slow

**Symptom**: the first commit after `yarn dev` / fresh clone takes 30+ seconds while the page just sits there.

**Cause**: one-time DINOv2-small weight download from Hugging Face into `data/models/` (~90 MB). The embedder is lazy-loaded so it doesn't hit on backend startup — it hits the first time you scan.

**Fix**: just wait. Subsequent commits embed in ~50 ms per crop on CPU. Pre-warm by running an embed manually if you want.

## `AutoImageProcessor requires the Torchvision library`

**Symptom**: `POST /api/scans/commit` returns 500. Backend log shows `ImportError: AutoImageProcessor requires the Torchvision library...` from inside `embeddings/dinov2.py`.

**Cause**: older versions of `embeddings/dinov2.py` used `transformers.AutoImageProcessor`, which pulls `torchvision` as a required backend.

**Fix (already applied)**: the embedder no longer uses `AutoImageProcessor`. Preprocessing (resize → center crop → ImageNet normalize → CHW) is matched inline with cv2 + numpy in `DinoV2SmallEmbedder._preprocess`. If you still hit this error, you're running stale code — restart uvicorn so the `--reload` watcher picks up the new module.

## iOS Safari reloads the scan page after taking a photo

**Symptom**: on iPhone, you tap "Capture page N", take the photo, see the polygon editor flash for a moment, then end up back on Home or the binder picker. Backend logs show `POST /api/scans/preview 200` and `GET /data/scans/<id>.jpg 200` followed by `/api/dashboard/stats` (or `/api/binders`), which means the upload succeeded but the page navigated away.

**Cause**: iOS Safari is allowed to evict tabs containing an `<input type="file">` while the camera is open, and it reloads the tab when the user returns. React state is wiped. The scan succeeded server-side but the new page instance has no memory of it.

**Mitigation in code**: [`routes/Scan.tsx`](../frontend/src/routes/Scan.tsx) persists the in-flight scan (preview response, slots, page number, savedPages, committed result) to `sessionStorage` under `card_tracker_scan_state_v1`. After Safari reloads `/scan?binder=<id>`, the binder hydration effect reads sessionStorage and restores you back onto the polygon editor or success card you were on. The persisted state is keyed by `binderId` and cleared on **Switch binder** and **Done**.

**If a user still loses progress**: the most likely cause is that they reloaded the `/scan` page without the `?binder=<id>` query param (e.g. via the nav tab). Restoration only triggers when the URL identifies the binder. Land back on the binder via Binders → Binder X → Scan a page.

## Detection misses cards on dense layouts (4×4 and up)

**Symptom**: 4×4 binder scans show many `refined: false` slots; the user has to drag every box manually.

**Cause**: the default detection thresholds (`min_cell_fill` 0.30, `min_hull_fill` 0.70) were tuned for 3×3 cell sizes. Smaller cells fail them.

**Fix**: the thresholds are tunable per binder via `binder.detector_config` — the create-binder dialog's **Advanced detection tuning** panel. Lower `min_cell_fill` (e.g. to 0.15) for dense layouts. See [detection.md](detection.md#per-binder-tunable-thresholds-detectionconfig). You can also always drag the boxes manually before commit — the polygon editor doesn't care whether boxes were auto-detected.

## "Page X already exists in binder Y"

**Symptom**: commit returns 422 with that message.

**Cause**: `placement.UNIQUE (binder_id, page_number)` constraint. You're trying to commit to a page number that already has a saved page.

**Fix**: in the scan wizard, **Switch binder** then re-pick the same binder — the page-number autoincrement re-reads `binder.page_count + 1` from the server. Or refresh `/scan?binder=<id>` directly.

## Schema changes need a DB rebuild

**Symptom**: backend starts fine but queries fail with "no such column", "no such table", etc.

**Cause**: there's no migration framework. Schema lives in [`db/schema.sql`](../backend/src/card_tracker/db/schema.sql) and is only applied via `init_db.py`.

**Fix**:
```bash
rm data/card_tracker.db          # Linux/macOS
del data\card_tracker.db          # Windows
python backend/scripts/init_db.py
```

Crops and scan images under `data/crops` / `data/scans` survive a DB wipe but become orphaned references — delete them too if you want a totally clean reset.

## Lucide icon error: `does not provide an export named 'Github'`

**Symptom**: browser console shows `Uncaught SyntaxError: ... does not provide an export named 'Github'` (or similar for `Youtube`, `Twitter`, etc.).

**Cause**: `lucide-react` v1 dropped brand icons. Anything importing `Github`, `Youtube`, `Twitter`, `Linkedin`, `Facebook`, etc. from `lucide-react` will fail.

**Fix**: inline the SVG. The About route shows the pattern — see [`frontend/src/routes/About.tsx`](../frontend/src/routes/About.tsx) for `GithubIcon`, `XIcon`, `DiscordIcon`, `YoutubeIcon`.

## Embeddings comparison returns nothing

**Symptom**: a placement that should match an existing CORE row gets `pending` review with zero candidates, or low similarities.

**Cause**: [`services/match.py::find_candidates`](../backend/src/card_tracker/services/match.py) filters CORE by `(embedder_name, embedder_version)`. If you changed the embedder identity in `config.py` after creating CORE rows, those rows are invisible to new placements.

**Fix**: either revert the embedder identity, or re-embed every CORE row under the new identity (no built-in tool — wipe + re-ingest is currently the only path).

## Blank `/binders/:id` or empty page thumbnails

**Symptom**: BinderDetail loads but page thumbnails are skeletons forever, or empty placeholder slots.

**Cause**: most likely `getPage` is returning null because the binder's `page_count` is ahead of actual `page` rows in the DB (e.g., `page_count` was inflated by a stale source). With current ingest, `page_count` is always derived from `SELECT COUNT(*) FROM page` so this shouldn't happen with backend-real data — but it can occur if you scan with a half-broken backend.

**Fix**: rebuild DB (see above). If it persists, hit `GET /api/binders/{id}/pages` directly to see what the backend says.
