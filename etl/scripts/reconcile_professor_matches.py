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


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Resolve school-scoped professor identities against normalized RMP rows and write enriched offerings."
    )
    parser.add_argument("--offerings-input", required=True)
    parser.add_argument("--rmp-input", required=True)
    parser.add_argument("--school-slug", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--matches-output")
    parser.add_argument("--reviews-output")
    args = parser.parse_args()

    offerings_input = Path(args.offerings_input)
    rmp_input = Path(args.rmp_input)
    output = Path(args.output)

    if not offerings_input.is_file():
        raise SystemExit(f"Missing offerings input: {offerings_input}")
    if not rmp_input.is_file():
        raise SystemExit(f"Missing normalized RMP input: {rmp_input}")

    offerings = _load_json(offerings_input)
    if not isinstance(offerings, list):
        raise SystemExit(f"Expected a list of offerings in {offerings_input}")

    rmp_records = load_normalized_rmp_records(rmp_input)
    resolutions, reviews = resolve_professor_matches(
        offerings,
        rmp_records,
        school_slug=args.school_slug,
    )
    enriched = enrich_offerings_with_match_resolutions(offerings, resolutions)
    audit = build_match_audit_report(resolutions, reviews, school_slug=args.school_slug)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(enriched, indent=2), encoding="utf-8")

    if args.matches_output:
        matches_output = Path(args.matches_output)
        matches_output.parent.mkdir(parents=True, exist_ok=True)
        matches_output.write_text(
            json.dumps(
                {
                    "summary": audit,
                    "resolutions": [asdict(item) for item in resolutions],
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    if args.reviews_output:
        reviews_output = Path(args.reviews_output)
        reviews_output.parent.mkdir(parents=True, exist_ok=True)
        reviews_output.write_text(
            json.dumps([asdict(item) for item in reviews], indent=2),
            encoding="utf-8",
        )

    print(
        f"Reconciled {audit['autoLinkedCount']} auto-links, "
        f"{audit['reviewCount']} review identities, "
        f"{audit['unmatchedCount']} unmatched identities for {args.school_slug}."
    )


if __name__ == "__main__":
    main()
