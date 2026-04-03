import argparse
import json
from dataclasses import asdict
from pathlib import Path

from etl.classly_etl.adapters.tamu import TexasAMGradeDistributionAdapter
from etl.classly_etl.adapters.ut_austin import UTAustinTableauAdapter


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--school", choices=["ut-austin", "texas-am"], required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--term", default="C")
    parser.add_argument("--college", default="EN")
    args = parser.parse_args()

    if args.school == "ut-austin":
        adapter = UTAustinTableauAdapter()
    else:
        adapter = TexasAMGradeDistributionAdapter(
            year=args.year,
            term_code=args.term,
            college_code=args.college,
        )

    records = [asdict(record) for record in adapter.normalize(adapter.fetch_raw())]
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, indent=2))
    print(f"Wrote {len(records)} records to {output_path}")


if __name__ == "__main__":
    main()
