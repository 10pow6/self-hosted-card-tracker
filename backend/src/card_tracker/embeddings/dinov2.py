import numpy as np


class DinoV2SmallEmbedder:
    """DINOv2-small image embedder. CPU-friendly, ~21M params, dim=384.

    Stub — will load `facebook/dinov2-small` via transformers, run the
    vision backbone, and return the CLS token as a unit-normalized
    float32 vector.
    """

    name = "dinov2-small"
    version = "facebook/dinov2-small@v1"
    dim = 384

    def __init__(self) -> None:
        raise NotImplementedError

    def embed(self, image: np.ndarray) -> np.ndarray:
        """Embed a single card crop (HxWx3, uint8 RGB) → float32[384], L2-normalized."""
        raise NotImplementedError
