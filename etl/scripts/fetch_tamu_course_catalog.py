from __future__ import annotations

import argparse
import json
from pathlib import Path

from etl.classly_etl.adapters.tamu_catalog import TAMUCourseCatalogAdapter


def _load_prefixes_from_records(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    prefixes = sorted(
        {
            str(row.get("course_code", "")).split()[0].strip().upper()
            for row in payload
            if str(row.get("course_code", "")).strip()
        }
    )
    return [prefix for prefix in prefixes if prefix]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch official TAMU undergraduate course catalog titles/descriptions by subject prefix."
    )
    parser.add_argument(
        "--records-input",
        default="etl/output/tamu_records.json",
    )
    parser.add_argument(
        "--prefixes",
        default="",
        help="Comma-separated subject prefixes. Defaults to prefixes discovered from --records-input.",
    )
    parser.add_argument(
        "--output",
        default="etl/output/tamu_course_catalog.json",
    )
    parser.add_argument("--pause", type=float, default=0.2)
    args = parser.parse_args()

    if args.prefixes.strip():
        prefixes = [prefix.strip().upper() for prefix in args.prefixes.split(",") if prefix.strip()]
    else:
        records_input = Path(args.records_input)
        if not records_input.is_file():
            raise SystemExit(
                f"Missing records input: {records_input}. Provide --prefixes or run fetch_tamu_batch first."
            )
        prefixes = _load_prefixes_from_records(records_input)

    adapter = TAMUCourseCatalogAdapter(
        subject_prefixes=prefixes,
        pause_seconds=args.pause,
    )
    payload = adapter.fetch_raw()
    records = list(adapter.normalize(payload))
    deduped = {row["course_code"]: row for row in records}

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(deduped, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Wrote {len(deduped)} TAMU catalog course rows to {output}")


if __name__ == "__main__":
    main()
