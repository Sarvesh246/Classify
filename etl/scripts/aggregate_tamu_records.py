"""Turn etl/output/tamu_records.json into etl/output/tamu_offerings.json (catalog rows)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from etl.classly_etl.tamu_aggregate import aggregate_tamu_offerings, records_from_json_rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="etl/output/tamu_records.json",
    )
    parser.add_argument(
        "--output",
        default="etl/output/tamu_offerings.json",
    )
    args = parser.parse_args()
    inp = Path(args.input)
    out = Path(args.output)
    if not inp.is_file():
        raise SystemExit(f"Missing {inp}; run fetch_tamu_batch first")
    rows = json.loads(inp.read_text(encoding="utf8"))
    records = records_from_json_rows(rows)
    offerings = aggregate_tamu_offerings(records)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(offerings, indent=2), encoding="utf8")
    print(f"Wrote {len(offerings)} offerings to {out}")


if __name__ == "__main__":
    main()
