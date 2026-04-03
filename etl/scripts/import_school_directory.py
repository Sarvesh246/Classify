import argparse
import json
from dataclasses import asdict
from pathlib import Path

from etl.classly_etl.adapters.college_scorecard import (
    CollegeScorecardSchoolDirectoryAdapter,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="etl/output/college_scorecard_schools.json")
    parser.add_argument("--per-page", type=int, default=100)
    parser.add_argument("--max-pages", type=int)
    args = parser.parse_args()

    adapter = CollegeScorecardSchoolDirectoryAdapter(
        per_page=args.per_page,
        max_pages=args.max_pages,
    )
    records = [asdict(record) for record in adapter.normalize(adapter.fetch_raw())]

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, indent=2))
    print(f"Wrote {len(records)} schools to {output_path}")


if __name__ == "__main__":
    main()
