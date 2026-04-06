"""
Batch-fetch Texas A&M grade report PDFs for many colleges / one term / year.
Respects the source with sequential requests and optional delay.

Usage:
  python -m etl.scripts.fetch_tamu_batch --year 2025 --term C --delay 2
  python -m etl.scripts.fetch_tamu_batch --year 2025 --term C --colleges EN GE AG
  python -m etl.scripts.fetch_tamu_batch --year 2025 --term C --fixture etl/fixtures/tamu_grade_report_excerpt.txt
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict
from pathlib import Path

from etl.classly_etl.adapters.tamu import TexasAMGradeDistributionAdapter


def load_colleges(args: argparse.Namespace) -> list[str]:
    if args.colleges:
        return [c.strip().upper() for c in args.colleges.split(",") if c.strip()]
    path = Path(args.colleges_file)
    data = json.loads(path.read_text(encoding="utf8"))
    if isinstance(data, list):
        return [str(x).strip().upper() for x in data]
    raise ValueError("colleges file must be a JSON array of codes")


def _looks_like_pdf(payload) -> bool:
    return isinstance(payload, bytes) and payload.lstrip().startswith(b"%PDF")


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch TAMU grade report fetch + parse")
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--term", default="C", help="C=Fall, A=Spring, B=Summer")
    parser.add_argument("--colleges", default="", help="Comma-separated college codes")
    parser.add_argument(
        "--colleges-file",
        default="etl/fixtures/tamu_college_codes.json",
        help="JSON array of college codes",
    )
    parser.add_argument(
        "--output-dir",
        default="etl/output/raw/tamu",
        help="Directory for raw response bytes per college",
    )
    parser.add_argument(
        "--records-out",
        default="etl/output/tamu_records.json",
        help="Combined normalized GradeDistributionRecord JSON",
    )
    parser.add_argument("--delay", type=float, default=1.5, help="Seconds between live requests")
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument(
        "--fixture",
        default="",
        help="If set, parse this file once instead of network (debug)",
    )
    parser.add_argument("--max-colleges", type=int, default=0, help="0 = all")
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    records_path = Path(args.records_out)
    records_path.parent.mkdir(parents=True, exist_ok=True)

    all_records: list[dict] = []

    if args.fixture:
        fixture = Path(args.fixture)
        adapter = TexasAMGradeDistributionAdapter(
            year=args.year,
            term_code=args.term,
            college_code="FX",
            fixture_path=fixture,
        )
        payload = adapter.fetch_raw()
        normalized = list(adapter.normalize(payload))
        all_records.extend(asdict(r) for r in normalized)
    else:
        colleges = load_colleges(args)
        if args.max_colleges:
            colleges = colleges[: args.max_colleges]
        for i, code in enumerate(colleges):
            raw_path = out_dir / f"{args.year}_{args.term}_{code}.pdf"
            last_error: Exception | None = None
            for attempt in range(1, max(args.max_attempts, 1) + 1):
                try:
                    adapter = TexasAMGradeDistributionAdapter(
                        year=args.year,
                        term_code=args.term,
                        college_code=code,
                    )
                    payload = adapter.fetch_raw()
                    if isinstance(payload, bytes):
                        if not _looks_like_pdf(payload):
                            raise ValueError("Response was not a valid PDF payload")
                        raw_path.write_bytes(payload)
                    else:
                        raw_path = out_dir / f"{args.year}_{args.term}_{code}.txt"
                        raw_path.write_text(str(payload), encoding="utf8")
                    normalized = list(adapter.normalize(payload))
                    all_records.extend(asdict(r) for r in normalized)
                    last_error = None
                    break
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    if attempt < max(args.max_attempts, 1):
                        time.sleep(max(args.delay, 0.25))
            if last_error is not None:
                print(f"[warn] {code}: {last_error}")
            if i + 1 < len(colleges) and args.delay > 0:
                time.sleep(args.delay)

    records_path.write_text(json.dumps(all_records, indent=2), encoding="utf8")
    print(f"Wrote {len(all_records)} records to {records_path}")


if __name__ == "__main__":
    main()
