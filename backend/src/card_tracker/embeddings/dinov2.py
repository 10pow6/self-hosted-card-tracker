from __future__ import annotations

import os
import threading
from typing import Optional

import numpy as np

from card_tracker.config import settings


class DinoV2SmallEmbedder:
    """DINOv2-small image embedder. CPU-friendly, ~21M params, dim=384.

    Loads `facebook/dinov2-small` via `transformers`, runs the vision backbone,
    and returns the CLS token as a unit-normalized float32 vector.

    First instantiation triggers a one-time model download to `data/models/`.
    Afterwards everything runs offline.
    """

    name = "dinov2-small"
    version = "facebook/dinov2-small@v1"
    dim = 384

    def __init__(self) -> None:
        # Pin HuggingFace cache to the repo's data/models so users don't pollute ~/.cache.
        os.environ.setdefault("HF_HOME", str(settings.models_dir))
        settings.models_dir.mkdir(parents=True, exist_ok=True)

        # Heavy imports kept inside __init__ so module-level imports are cheap.
        import torch
        from transformers import AutoImageProcessor, AutoModel

        self._torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
        self.model = AutoModel.from_pretrained("facebook/dinov2-small").to(self.device)
        self.model.eval()

    def embed(self, image_rgb: np.ndarray) -> np.ndarray:
        """Embed a single card crop (HxWx3, uint8 RGB) → float32[384], L2-normalized."""
        if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
            raise ValueError(f"Expected HxWx3 RGB image, got shape {image_rgb.shape}")
        inputs = self.processor(images=image_rgb, return_tensors="pt").to(self.device)
        with self._torch.no_grad():
            outputs = self.model(**inputs)
        cls = outputs.last_hidden_state[0, 0].cpu().numpy().astype(np.float32)
        norm = float(np.linalg.norm(cls))
        return cls / norm if norm > 0 else cls


# ---- Singleton accessor ----

_embedder: Optional[DinoV2SmallEmbedder] = None
_embedder_lock = threading.Lock()


def get_embedder() -> DinoV2SmallEmbedder:
    """Return the process-wide DINOv2-small embedder, loading on first call."""
    global _embedder
    if _embedder is None:
        with _embedder_lock:
            if _embedder is None:
                _embedder = DinoV2SmallEmbedder()
    return _embedder
