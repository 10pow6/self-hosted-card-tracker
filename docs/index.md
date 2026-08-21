# Card Tracker docs

Project-internal reference. For the project pitch, screenshots, and quickstart see the top-level [README.md](../README.md).

## Map

| Topic | File |
|---|---|
| System layers, components, storage | [architecture.md](architecture.md) |
| Data model — CORE / binder / page / placement | [data-model.md](data-model.md) |
| Scan flow — capture → preview → adjust → commit | [scan-flow.md](scan-flow.md) |
| Page detection (OpenCV pipeline) | [detection.md](detection.md) |
| Embeddings & similarity (DINOv2, thresholds) | [embeddings.md](embeddings.md) |
| Review queue (states, defer, shortcuts) | [review-queue.md](review-queue.md) |
| Placement management (refine, move, promote, unmatch) | [placement-management.md](placement-management.md) |
| Metadata enrichment (Claude Code skill, allowlist, confidence rules) | [enrichment.md](enrichment.md) |
| PDF exports (collection, binder cards, binder pages) | [export.md](export.md) |
| Binder layouts (RxC parsing, supported sizes) | [layouts.md](layouts.md) |
| HTTP API reference | [api.md](api.md) |
| Design system — colors, type, decision-provenance language | [DESIGN.md](DESIGN.md) |
| Frontend UI architecture (routes, features, provenance system) | [frontend-ui.md](frontend-ui.md) |
| Install + first run | [setup.md](setup.md) |
| Troubleshooting | [troubleshooting.md](troubleshooting.md) |

## When to update which doc

- Schema or table change → [data-model.md](data-model.md).
- New API endpoint or shape change → [api.md](api.md).
- CV threshold or algorithm change → [detection.md](detection.md).
- New embedder or matching tweak → [embeddings.md](embeddings.md).
- New layout dimensions → [layouts.md](layouts.md).
- Enrichment guardrails / allowlist / skill template change → [enrichment.md](enrichment.md).
- PDF format / endpoint / page layout change → [export.md](export.md).
- Installation step or environment change → [setup.md](setup.md).
- Any new failure mode you've actually hit → [troubleshooting.md](troubleshooting.md).
- UI structure, shared component, or provenance-rule change → [frontend-ui.md](frontend-ui.md); look & feel tokens → [DESIGN.md](DESIGN.md).
