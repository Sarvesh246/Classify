from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from etl.classly_etl.adapters.rmp import LiveRMPGraphQLAdapter
from etl.classly_etl.source_registry import load_json


def _load_registry(path: Path) -> list[dict]:
    payload = load_json(path)
    if not isinstance(payload, list):
        raise SystemExit(f"Expected a list of registry rows in {path}")
    return payload


def _write_registry(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=2), encoding="utf-8")


def _school_slug(entry: dict) -> str:
    return str(entry.get("school_slug") or "").strip()


def _can_sync(entry: dict, *, only_missing: bool) -> bool:
    rmp = (entry.get("sources") or {}).get("rmp") or {}
    if not rmp.get("enabled"):
        return False
    if only_missing and rmp.get("normalized_path"):
        return False
    return bool(rmp.get("school_legacy_id"))


def _sync_one(
    entry: dict,
    *,
    endpoint: str,
    output_dir: Path,
    page_size: int,
    max_pages: int,
) -> tuple[bool, str]:
    slug = _school_slug(entry)
    rmp = entry.setdefault("sources", {}).setdefault("rmp", {})
    legacy_id = rmp.get("school_legacy_id")
    if not legacy_id:
        rmp["status"] = "pending_school_id"
        return False, f"{slug}: missing RMP school legacy id"

    adapter = LiveRMPGraphQLAdapter(
        school_slug=slug,
        school_legacy_id=str(legacy_id),
        endpoint=endpoint,
        page_size=page_size,
        max_pages=max_pages,
    )
    payload = adapter.fetch_raw()
    records = list(adapter.normalize(payload))

    raw_dir = output_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_path = raw_dir / f"rmp_{slug}.json"
    normalized_path = output_dir / f"rmp_{slug}.json"
    raw_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    normalized_path.write_text(
        json.dumps([record.__dict__ for record in records], indent=2),
        encoding="utf-8",
    )

    rmp["status"] = "synced"
    rmp["raw_path"] = str(raw_path)
    rmp["normalized_path"] = str(normalized_path)
    rmp["record_count"] = len(records)
    rmp["last_synced_at"] = datetime.now(timezone.utc).isoformat()
    rmp.pop("last_error", None)
    return True, f"{slug}: synced {len(records)} RMP rows"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk-sync school-scoped RMP professor data using the school source registry."
    )
    parser.add_argument(
        "--registry",
        default="etl/output/school_source_registry.json",
    )
    parser.add_argument(
        "--output-dir",
        default="etl/output",
    )
    parser.add_argument("--school-slug")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=10)
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Skip schools that already have normalized RMP output paths in the registry.",
    )
    args = parser.parse_args()

    endpoint = os.environ.get("RMP_GRAPHQL_ENDPOINT")
    if not endpoint:
        raise SystemExit("RMP_GRAPHQL_ENDPOINT is required to run the bulk RMP sync.")

    registry_path = Path(args.registry)
    rows = _load_registry(registry_path)
    candidates = rows
    if args.school_slug:
        candidates = [entry for entry in candidates if _school_slug(entry) == args.school_slug]

    candidates = [entry for entry in candidates if _can_sync(entry, only_missing=args.only_missing)]
    if args.limit is not None:
        candidates = candidates[: max(args.limit, 0)]

    success_count = 0
    failure_count = 0
    output_dir = Path(args.output_dir)

    for entry in candidates:
        rmp = entry.setdefault("sources", {}).setdefault("rmp", {})
        try:
            ok, message = _sync_one(
                entry,
                endpoint=endpoint,
                output_dir=output_dir,
                page_size=args.page_size,
                max_pages=args.max_pages,
            )
            if ok:
                success_count += 1
            else:
                failure_count += 1
            print(message)
        except Exception as exc:  # pragma: no cover - defensive orchestration path
            failure_count += 1
            rmp["status"] = "failed"
            rmp["last_error"] = str(exc)
            print(f"{_school_slug(entry)}: failed ({exc})")

    _write_registry(registry_path, rows)
    print(
        f"Bulk RMP sync complete. Attempted {len(candidates)} schools; "
        f"{success_count} succeeded, {failure_count} failed."
    )


if __name__ == "__main__":
    main()
