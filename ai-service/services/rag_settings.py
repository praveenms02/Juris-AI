"""
RAG tuning via environment variables (no code change required to adjust retrieval).
"""

from __future__ import annotations

import os

_DEFAULT_TOP_K = 5
_DEFAULT_DISTANCE_THRESHOLD = 0.75


def get_rag_top_k() -> int:
    """
    Max chunks to retrieve per query.

    Reads RAG_TOP_K (default 3). Clamped to 1–10 for safety.
    """
    raw = os.getenv("RAG_TOP_K", str(_DEFAULT_TOP_K))
    try:
        value = int(raw)
    except ValueError:
        return _DEFAULT_TOP_K
    return max(1, min(value, 10))


def get_rag_distance_threshold() -> float:
    """
    Maximum Chroma cosine distance to keep a retrieved chunk.

    Reads RAG_DISTANCE_THRESHOLD (default 0.75).
    """
    raw = os.getenv("RAG_DISTANCE_THRESHOLD", str(_DEFAULT_DISTANCE_THRESHOLD))
    try:
        return float(raw)
    except ValueError:
        return _DEFAULT_DISTANCE_THRESHOLD
