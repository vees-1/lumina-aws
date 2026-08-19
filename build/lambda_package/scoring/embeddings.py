from __future__ import annotations

import json
from pathlib import Path

_CACHE_PATH = Path(__file__).parent / "hpo_embeddings.json"


class HPOEmbedder:
    """Semantic fuzzy matcher: free text -> nearest HPO terms."""

    def __init__(self):
        self._model = None
        self._hpo_ids: list[str] = []
        self._hpo_names: list[str] = []
        self._embeddings = None  # numpy array shape (N, dim)

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError:
            self._model = None

    def build_index(self, hpo_vocab: list[tuple[str, str]]) -> None:
        """Pre-compute embeddings for all HPO terms. Call once at startup."""
        try:
            import numpy as np  # noqa: F401
        except ImportError:
            return
        if self._model is None:
            self._load_model()
        if self._model is None:
            return
        self._hpo_ids = [v[0] for v in hpo_vocab]
        self._hpo_names = [v[1] for v in hpo_vocab]
        self._embeddings = self._model.encode(
            self._hpo_names, batch_size=64, show_progress_bar=False
        )
        # cache to disk
        _CACHE_PATH.write_text(
            json.dumps(
                {
                    "ids": self._hpo_ids,
                    "names": self._hpo_names,
                    "embeddings": self._embeddings.tolist(),
                }
            )
        )

    def load_index(self) -> bool:
        """Load pre-built index from cache. Returns True if loaded."""
        if not _CACHE_PATH.exists():
            return False
        try:
            import numpy as np
        except ImportError:
            return False
        data = json.loads(_CACHE_PATH.read_text())
        self._hpo_ids = data["ids"]
        self._hpo_names = data["names"]
        self._embeddings = np.array(data["embeddings"])
        if self._model is None:
            self._load_model()
        return self._model is not None

    def match(
        self, text: str, top_k: int = 5, threshold: float = 0.72
    ) -> list[tuple[str, str, float]]:
        """Match free text to HPO terms. Returns [(hpo_id, name, score)]."""
        if self._embeddings is None:
            return []
        try:
            import numpy as np
        except ImportError:
            return []
        if self._model is None:
            return []
        query_emb = self._model.encode([text])[0]
        scores = (self._embeddings @ query_emb) / (
            np.linalg.norm(self._embeddings, axis=1) * np.linalg.norm(query_emb) + 1e-8
        )
        top_idx = np.argsort(scores)[::-1][:top_k]
        return [
            (self._hpo_ids[i], self._hpo_names[i], float(scores[i]))
            for i in top_idx
            if scores[i] >= threshold
        ]


_embedder = HPOEmbedder()
