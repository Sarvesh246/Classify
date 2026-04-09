from __future__ import annotations

import json
from pathlib import Path
def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_rmp_school_legacy_by_directory_slug(root: Path | None = None) -> dict[str, str]:
    path = (root or repo_root()) / "data" / "rmp_school_legacy_ids.json"
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw = payload.get("by_directory_slug")
    if not isinstance(raw, dict):
        return {}
    return {
        str(k).strip(): str(v).strip()
        for k, v in raw.items()
        if str(k).strip() and str(v).strip() and not str(k).startswith("_")
    }
