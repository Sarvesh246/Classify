import argparse
import json
from dataclasses import asdict
from pathlib import Path

from etl.classly_etl.adapters.college_scorecard import (
    CollegeScorecardSchoolDirectoryAdapter,
)

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "college_scorecard_schools.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="etl/output/college_scorecard_schools.json")
    parser.add_argument("--per-page", type=int, default=100)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument(
        "--ownership",
        default="1,2,3",
        help="College Scorecard ownership codes to include (default: public/private/for-profit).",
    )
    parser.add_argument(
        "--predominant-awards",
        default="1,2,3,4",
        help="Predominant award levels to include (default: undergraduate-serving institutions).",
    )
    parser.add_argument(
        "--fixture",
        action="store_true",
        help=f"Write normalized schools from {_FIXTURE_PATH.name} (no API key).",
    )
    args = parser.parse_args()

    fixture_path = _FIXTURE_PATH if args.fixture else None
    ownership_values = tuple(
        int(value.strip()) for value in args.ownership.split(",") if value.strip()
    )
    predominant_awards = tuple(
        int(value.strip())
        for value in args.predominant_awards.split(",")
        if value.strip()
    )

    adapter = CollegeScorecardSchoolDirectoryAdapter(
        fixture_path=fixture_path,
        per_page=args.per_page,
        max_pages=args.max_pages,
        ownership_values=ownership_values,
        predominant_awards=predominant_awards,
    )
    records = [asdict(record) for record in adapter.normalize(adapter.fetch_raw())]

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, indent=2))
    print(f"Wrote {len(records)} schools to {output_path}")


if __name__ == "__main__":
    main()
