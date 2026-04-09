from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def repo_root_from_here() -> Path:
    return Path(__file__).resolve().parents[2]


def default_manifest_path(repo_root: Path | None = None) -> Path:
    root = repo_root or repo_root_from_here()
    return root / "data" / "expansion-priority.json"


def load_expansion_priority_manifest(repo_root: Path | None = None) -> dict[str, Any]:
    path = default_manifest_path(repo_root)
    if not path.is_file():
        return {"version": 1, "schools": []}
    return json.loads(path.read_text(encoding="utf-8"))


def expansion_priority_index(manifest: dict[str, Any]) -> dict[str, int]:
    schools = manifest.get("schools") or []
    out: dict[str, int] = {}
    for idx, row in enumerate(schools):
        if not isinstance(row, dict):
            continue
        slug = str(row.get("slug") or "").strip()
        if slug:
            out[slug] = idx
    return out


def expansion_targets_for_slug(manifest: dict[str, Any], slug: str) -> dict[str, Any] | None:
    for row in manifest.get("schools") or []:
        if isinstance(row, dict) and str(row.get("slug") or "").strip() == slug:
            return row
    return None
