from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from etl.classly_etl.scorecard_canonical_slug import canonical_app_school_slug


def slugify_professor(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def load_school_names_by_directory_slug(directory_json: Path) -> dict[str, str]:
    if not directory_json.is_file():
        return {}
    rows = json.loads(directory_json.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        return {}
    out: dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        slug = str(row.get("slug") or "").strip()
        if not slug:
            continue
        alias = str(row.get("alias") or "").strip()
        name = str(row.get("name") or "").strip()
        out[slug] = alias or name or slug
    return out


# Default: do not overwrite curated lib/data seed rows. Pass --include-seed-slugs to replace with full RMP slices.
SEED_SKIP_MATERIALIZE = frozenset(
    {
        "texas-am",
        "ut-austin",
        "georgia-tech",
        "uc-berkeley",
        "uw-madison",
        "uiuc",
        "ohio-state",
        "unc-chapel-hill",
        "university-of-washington",
    }
)


def build_offering_from_rmp_row(
    *,
    school_slug: str,
    school_name: str,
    row: dict,
    used_prof_slugs: dict[str, int],
) -> dict | None:
    professor_name = str(row.get("professor_name") or "").strip()
    if not professor_name:
        return None
    review_count = int(row.get("review_count", 0) or 0)
    if review_count < 3:
        return None
    rating = row.get("rating")
    difficulty = row.get("difficulty")
    if rating is None and difficulty is None:
        return None

    base_slug = slugify_professor(professor_name)
    if not base_slug:
        return None
    prof_slug = base_slug
    if base_slug in used_prof_slugs:
        rid = str(row.get("rmp_id") or "").strip()
        suffix = rid or str(used_prof_slugs[base_slug])
        prof_slug = f"{base_slug}-{suffix}"
    used_prof_slugs[base_slug] = used_prof_slugs.get(base_slug, 0) + 1

    dept = str(row.get("department") or "General").strip() or "General"
    tags = list(row.get("tags") or [])
    if not isinstance(tags, list):
        tags = []
    tags = [str(t) for t in tags if t][:12]

    rmp_id = str(row.get("rmp_id") or "").strip()
    course_slug = f"rmp-profile-{prof_slug}"
    oid = f"{school_slug}-rmp-{prof_slug}"

    trend_point = {
        "term": "RMP snapshot",
        "avgGpa": None,
        "aPct": None,
        "rmpRating": float(rating) if rating is not None else None,
        "rmpDifficulty": float(difficulty) if difficulty is not None else None,
        "classifyScore": None,
    }

    return {
        "id": oid,
        "schoolSlug": school_slug,
        "schoolName": school_name,
        "professorSlug": prof_slug,
        "courseSlug": course_slug,
        "courseCode": "RMP",
        "courseName": "Instructor profile (RMP)",
        "professorName": professor_name,
        "department": dept,
        "classifyScore": None,
        "expectedGpa": None,
        "aRate": None,
        "rmpRating": float(rating) if rating is not None else None,
        "rmpDifficulty": float(difficulty) if difficulty is not None else None,
        "trendDelta": None,
        "confidence": 72,
        "sampleSize": review_count,
        "coverageTier": "rmp_only",
        "latestTerm": "RMP snapshot",
        "termCount": 1,
        "matchConfidence": 100,
        "tags": tags,
        "summary": f"Student-reported ratings on Rate My Professors for {school_name}.",
        "professorTitle": dept if dept != "General" else "Instructor",
        "professorSummary": "Profile materialized from school-scoped RMP export for search and compare.",
        "courseSummary": "Synthetic course row used to attach RMP evidence before full course catalog is ingested.",
        "freshness": "RMP snapshot",
        "sourceLabels": ["Rate My Professors", "RMP GraphQL"],
        "dataCompleteness": "rmp_only",
        "trend": [trend_point],
        "rankingMode": "ease_score",
        "hasSectionPlanning": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Build reconcile/{canonical}_enriched.json offerings from normalized "
            "etl/output/rmp_{directory_slug}.json snapshots so catalog:merge publishes RMP breadth."
        )
    )
    parser.add_argument(
        "--output-root",
        default="etl/output",
        help="Contains rmp_*.json and writes reconcile/*.json.",
    )
    parser.add_argument(
        "--directory-json",
        default="etl/output/college_scorecard_schools.json",
        help="Used to resolve display names by directory slug.",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--include-seed-slugs",
        action="store_true",
        help="Also materialize schools that have curated seed rows (replaces their offerings on merge).",
    )
    args = parser.parse_args()

    root = Path(args.output_root)
    names_by_dir = load_school_names_by_directory_slug(Path(args.directory_json))
    rmp_files = sorted(root.glob("rmp_*.json"))
    if not rmp_files:
        print("No rmp_*.json files found; run RMP sync first.")
        return

    reconcile_dir = root / "reconcile"
    reconcile_dir.mkdir(parents=True, exist_ok=True)
    total_written = 0
    total_offerings = 0

    for path in rmp_files:
        dir_slug = path.stem.removeprefix("rmp_")
        canon = canonical_app_school_slug(dir_slug)
        if not args.include_seed_slugs and canon in SEED_SKIP_MATERIALIZE:
            print(f"skip seed-curated {path.name} -> {canon}")
            continue

        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list) or not payload:
            print(f"skip empty or invalid {path.name}")
            continue

        school_name = names_by_dir.get(dir_slug, canon.replace("-", " ").title())
        used_slugs: dict[str, int] = {}
        offerings: list[dict] = []
        for row in payload:
            if not isinstance(row, dict):
                continue
            off = build_offering_from_rmp_row(
                school_slug=canon,
                school_name=school_name,
                row=row,
                used_prof_slugs=used_slugs,
            )
            if off is not None:
                offerings.append(off)

        if not offerings:
            print(f"skip no offerings {path.name}")
            continue

        out_path = reconcile_dir / f"{canon}_enriched.json"
        total_written += 1
        total_offerings += len(offerings)
        print(f"{path.name} -> {out_path.name} ({len(offerings)} offerings)")
        if not args.dry_run:
            out_path.write_text(json.dumps(offerings, indent=2), encoding="utf-8")

    print(
        f"Done. Wrote {total_written} enriched slices ({total_offerings} offerings)."
    )


if __name__ == "__main__":
    main()
