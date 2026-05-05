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
| Binder layouts (RxC parsing, supported sizes) | [layouts.md](layouts.md) |
| HTTP API reference | [api.md](api.md) |
| Install + first run | [setup.md](setup.md) |
| Troubleshooting | [troubleshooting.md](troubleshooting.md) |

## When to update which doc

- Schema or table change → [data-model.md](data-model.md).
- New API endpoint or shape change → [api.md](api.md).
- CV threshold or algorithm change → [detection.md](detection.md).
- New embedder or matching tweak → [embeddings.md](embeddings.md).
- New layout dimensions → [layouts.md](layouts.md).
- Installation step or environment change → [setup.md](setup.md).
- Any new failure mode you've actually hit → [troubleshooting.md](troubleshooting.md).
