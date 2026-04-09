from __future__ import annotations

import argparse
import json
from pathlib import Path

from etl.classly_etl.expansion_priority import load_expansion_priority_manifest


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "List Phase 3 expansion targets vs reconciled enriched payloads under etl/output/reconcile/."
        )
    )
    parser.add_argument(
        "--reconcile-dir",
        default="etl/output/reconcile",
        help="Directory containing *_enriched.json slices from the merge pipeline.",
    )
    args = parser.parse_args()

    manifest = load_expansion_priority_manifest()
    reconcile_root = Path(args.reconcile_dir)
    enriched = set()
    if reconcile_root.is_dir():
        for path in reconcile_root.glob("*_enriched.json"):
            enriched.add(path.stem.removesuffix("_enriched"))

    rows = []
    for row in manifest.get("schools") or []:
        if not isinstance(row, dict):
            continue
        slug = str(row.get("slug") or "").strip()
        if not slug:
            continue
        rows.append(
            {
                "slug": slug,
                "in_manifest": True,
                "has_reconcile_enriched": slug in enriched,
                "targets": row,
            }
        )

    print(json.dumps({"manifest_version": manifest.get("version"), "schools": rows}, indent=2))


if __name__ == "__main__":
    main()
