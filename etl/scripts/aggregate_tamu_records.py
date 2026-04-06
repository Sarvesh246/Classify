"""Turn etl/output/tamu_records.json into etl/output/tamu_offerings.json (catalog rows)."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path

from etl.classly_etl.matchers import (
    build_match_audit_report,
    enrich_offerings_with_match_resolutions,
    load_normalized_rmp_records,
    resolve_professor_matches,
)
from etl.classly_etl.adapters.tamu_catalog import load_tamu_course_catalog
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
    parser.add_argument(
        "--rmp-input",
        default="etl/output/rmp_texas-am.json",
    )
    parser.add_argument(
        "--matches-output",
        default="etl/output/matches/texas-am.json",
    )
    parser.add_argument(
        "--reviews-output",
        default="etl/output/matches/texas-am_reviews.json",
    )
    parser.add_argument(
        "--catalog-input",
        default="etl/output/tamu_course_catalog.json",
    )
    args = parser.parse_args()
    inp = Path(args.input)
    out = Path(args.output)
    if not inp.is_file():
        raise SystemExit(f"Missing {inp}; run fetch_tamu_batch first")
    rows = json.loads(inp.read_text(encoding="utf8"))
    records = records_from_json_rows(rows)
    course_catalog = {}
    catalog_input = Path(args.catalog_input)
    if catalog_input.is_file():
        course_catalog = load_tamu_course_catalog(catalog_input)

    offerings = aggregate_tamu_offerings(records, course_catalog=course_catalog)

    rmp_input = Path(args.rmp_input)
    if rmp_input.is_file():
        rmp_records = load_normalized_rmp_records(rmp_input)
        resolutions, reviews = resolve_professor_matches(
            offerings,
            rmp_records,
            school_slug="texas-am",
        )
        offerings = enrich_offerings_with_match_resolutions(offerings, resolutions)

        matches_output = Path(args.matches_output)
        reviews_output = Path(args.reviews_output)
        matches_output.parent.mkdir(parents=True, exist_ok=True)
        reviews_output.parent.mkdir(parents=True, exist_ok=True)
        audit = build_match_audit_report(resolutions, reviews, school_slug="texas-am")
        matches_output.write_text(
            json.dumps(
                {
                    "summary": audit,
                    "resolutions": [asdict(item) for item in resolutions],
                },
                indent=2,
            ),
            encoding="utf8",
        )
        reviews_output.write_text(
            json.dumps([asdict(item) for item in reviews], indent=2),
            encoding="utf8",
        )

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(offerings, indent=2), encoding="utf8")
    print(f"Wrote {len(offerings)} offerings to {out}")


if __name__ == "__main__":
    main()
