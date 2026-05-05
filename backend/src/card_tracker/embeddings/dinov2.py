from __future__ import annotations

import os
import threading
from typing import Optional

import cv2
import numpy as np

from card_tracker.config import settings


class DinoV2SmallEmbedder:
    """DINOv2-small image embedder. CPU-friendly, ~21M params, dim=384.

    Loads `facebook/dinov2-small` via `transformers` and runs the vision backbone.
    Preprocessing (resize → center crop → ImageNet normalize → CHW) is done
    inline with cv2 + numpy so we don't pull in torchvision just for the
    `AutoImageProcessor`.

    First instantiation triggers a one-time model download to `data/models/`.
    Afterwards everything runs offline.
    """

    name = "dinov2-small"
    version = "facebook/dinov2-small@v1"
    dim = 384

    # Standard DINOv2 preprocessing constants (matches `facebook/dinov2-small`'s
    # AutoImageProcessor config).
    INPUT_SIZE = 224          # final HxW after center crop
    SHORTEST_EDGE = 256       # resize target for the shorter side
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __init__(self) -> None:
        # Pin HuggingFace cache to the repo's data/models so users don't pollute ~/.cache.
        os.environ.setdefault("HF_HOME", str(settings.models_dir))
        settings.models_dir.mkdir(parents=True, exist_ok=True)

        # Heavy imports kept inside __init__ so module-level imports stay cheap.
        import torch
        from transformers import AutoModel

        self._torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = AutoModel.from_pretrained("facebook/dinov2-small").to(self.device)
        self.model.eval()

    def _preprocess(self, image_rgb: np.ndarray) -> "np.ndarray":
        """Match the `facebook/dinov2-small` image-processor pipeline.

        Steps:
            1. Resize shortest edge to 256 (bicubic).
            2. Center crop to 224x224.
            3. Float32, scale to [0,1], ImageNet mean/std normalize.
            4. HWC → CHW, add batch dim.
        Returns a contiguous float32 array of shape (1, 3, 224, 224).
        """
        h, w = image_rgb.shape[:2]
        scale = self.SHORTEST_EDGE / float(min(h, w))
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        resized = cv2.resize(image_rgb, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        cy = max(0, (new_h - self.INPUT_SIZE) // 2)
        cx = max(0, (new_w - self.INPUT_SIZE) // 2)
        cropped = resized[cy : cy + self.INPUT_SIZE, cx : cx + self.INPUT_SIZE]

        arr = cropped.astype(np.float32) / 255.0
        arr = (arr - self.MEAN) / self.STD
        arr = np.ascontiguousarray(arr.transpose(2, 0, 1))  # HWC → CHW
        return arr[np.newaxis, ...]                          # add batch dim

    def embed(self, image_rgb: np.ndarray) -> np.ndarray:
        """Embed a single card crop (HxWx3, uint8 RGB) → float32[384], L2-normalized."""
        if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
            raise ValueError(f"Expected HxWx3 RGB image, got shape {image_rgb.shape}")
        batch = self._preprocess(image_rgb)
        tensor = self._torch.from_numpy(batch).to(self.device)
        with self._torch.no_grad():
            outputs = self.model(pixel_values=tensor)
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
