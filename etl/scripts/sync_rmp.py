import argparse
import json
import os
from pathlib import Path

from etl.classly_etl.adapters.rmp import LiveRMPGraphQLAdapter


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Rate My Professors GraphQL data for a school and write raw + normalized snapshots."
    )
    parser.add_argument("--school-slug", required=True)
    parser.add_argument("--school-legacy-id")
    parser.add_argument("--search-text", default="")
    parser.add_argument("--output-dir", default="etl/output")
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=10)
    args = parser.parse_args()

    endpoint = os.environ.get("RMP_GRAPHQL_ENDPOINT")
    if not endpoint:
        raise SystemExit("RMP_GRAPHQL_ENDPOINT is required to run the live RMP sync.")

    adapter = LiveRMPGraphQLAdapter(
        school_slug=args.school_slug,
        school_legacy_id=args.school_legacy_id,
        search_text=args.search_text,
        endpoint=endpoint,
        page_size=args.page_size,
        max_pages=args.max_pages,
    )
    payload = adapter.fetch_raw()
    records = list(adapter.normalize(payload))

    output_dir = Path(args.output_dir)
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_path = raw_dir / f"rmp_{args.school_slug}.json"
    normalized_path = output_dir / f"rmp_{args.school_slug}.json"

    raw_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    normalized_path.write_text(
        json.dumps([record.__dict__ for record in records], indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {len(records)} RMP records to {normalized_path}")


if __name__ == "__main__":
    main()
