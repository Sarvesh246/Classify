from __future__ import annotations

import argparse
import json
from pathlib import Path

from etl.classly_etl.source_registry import (
    build_school_source_registry,
    load_json,
    load_overrides,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a nationwide school source registry for professor coverage, RMP sync readiness, and published-depth status."
    )
    parser.add_argument(
        "--directory-input",
        default="etl/output/college_scorecard_schools.json",
    )
    parser.add_argument(
        "--published-input",
        default="etl/output/published_catalog.json",
    )
    parser.add_argument(
        "--output",
        default="etl/output/school_source_registry.json",
    )
    parser.add_argument(
        "--output-root",
        default="etl/output",
        help="Directory that contains rmp_*.json, raw/rmp_*.json, and matches/*.json files.",
    )
    parser.add_argument(
        "--overrides",
        default="etl/output/school_source_registry_overrides.json",
    )
    args = parser.parse_args()

    directory_input = Path(args.directory_input)
    if not directory_input.is_file():
        raise SystemExit(f"Missing directory input: {directory_input}")

    published_input = Path(args.published_input)
    published_snapshot = load_json(published_input) if published_input.is_file() else None

    registry = build_school_source_registry(
        load_json(directory_input),
        published_snapshot=published_snapshot,
        output_root=Path(args.output_root),
        overrides=load_overrides(Path(args.overrides)),
    )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(registry, indent=2), encoding="utf-8")

    print(
        f"Wrote {len(registry)} school source registry rows to {output}"
    )


if __name__ == "__main__":
    main()
