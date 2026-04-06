from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


EXCLUDED_UNIVERSITY_TOKENS = (
    "community college",
    "junior college",
    "technical college",
    "technical institute",
    "beauty school",
    "beauty college",
    "barber school",
    "barber college",
    "cosmetology",
    "seminary",
)


def is_university_scope_school(name: str) -> bool:
    normalized = " ".join(name.lower().split())
    return not any(token in normalized for token in EXCLUDED_UNIVERSITY_TOKENS)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_overrides(path: Path | None) -> dict[str, dict[str, Any]]:
    if path is None or not path.is_file():
        return {}
    payload = load_json(path)
    if isinstance(payload, dict):
        return {str(key): value for key, value in payload.items() if isinstance(value, dict)}
    if isinstance(payload, list):
        output: dict[str, dict[str, Any]] = {}
        for item in payload:
            if not isinstance(item, dict):
                continue
            slug = str(item.get("school_slug") or item.get("schoolSlug") or "").strip()
            if slug:
                output[slug] = item
        return output
    return {}


def _extract_rmp_school_legacy_id(raw_payload: dict[str, Any]) -> str | None:
    pages = raw_payload.get("pages")
    if isinstance(pages, list):
        for page in pages:
            school_id = _extract_rmp_school_legacy_id(page)
            if school_id:
                return school_id

    teachers = (
        raw_payload.get("data", {})
        .get("newSearch", {})
        .get("teachers", {})
    )
    edges = teachers.get("edges", [])
    for edge in edges:
        node = edge.get("node", {})
        school = node.get("school", {})
        school_id = school.get("id")
        if school_id:
            return str(school_id)
    return None


def _summarize_published_school(row: dict[str, Any]) -> dict[str, Any]:
    support = row.get("supportProfile") or {}
    return {
        "planner_readiness": support.get("plannerReadiness", "directory_ready"),
        "has_catalog": bool(support.get("hasCatalog", False)),
        "has_sections": bool(support.get("hasSections", False)),
        "has_instructor_directory": bool(support.get("hasInstructorDirectory", False)),
        "professor_coverage_level": support.get("professorCoverageLevel", "directory_only"),
        "has_official_grades": bool(support.get("hasOfficialGrades", False)),
        "has_rmp": bool(support.get("hasRmp", False)),
    }


def _rmp_status(*, enabled: bool, school_legacy_id: str | None, has_snapshot: bool) -> str:
    if not enabled:
        return "disabled"
    if has_snapshot:
        return "synced"
    if school_legacy_id:
        return "ready"
    return "pending_school_id"


def _iso_mtime(path: Path | None) -> str | None:
    if path is None or not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def _match_summary(path: Path | None) -> dict[str, int]:
    if path is None or not path.is_file():
        return {
            "auto_linked_count": 0,
            "review_count": 0,
            "unmatched_count": 0,
            "pending_review_count": 0,
        }
    payload = load_json(path)
    summary = payload.get("summary", {})
    return {
        "auto_linked_count": int(summary.get("autoLinkedCount", 0)),
        "review_count": int(summary.get("reviewCount", 0)),
        "unmatched_count": int(summary.get("unmatchedCount", 0)),
        "pending_review_count": int(summary.get("pendingReviewCount", 0)),
    }


def _directory_short_name(row: dict[str, Any]) -> str:
    alias = str(row.get("alias") or "").strip()
    if alias:
        return alias
    return str(row.get("name") or row.get("slug") or "").strip()


def _collect_rmp_paths(output_root: Path) -> tuple[dict[str, Path], dict[str, Path], dict[str, Path]]:
    normalized_by_slug: dict[str, Path] = {}
    raw_by_slug: dict[str, Path] = {}
    matches_by_slug: dict[str, Path] = {}

    if output_root.is_dir():
        for path in output_root.glob("rmp_*.json"):
            slug = path.stem.removeprefix("rmp_")
            normalized_by_slug[slug] = path

        raw_root = output_root / "raw"
        if raw_root.is_dir():
            for path in raw_root.glob("rmp_*.json"):
                slug = path.stem.removeprefix("rmp_")
                raw_by_slug[slug] = path

        matches_root = output_root / "matches"
        if matches_root.is_dir():
            for path in matches_root.glob("*.json"):
                if path.name.endswith("_reviews.json"):
                    continue
                matches_by_slug[path.stem] = path

    return normalized_by_slug, raw_by_slug, matches_by_slug


def build_school_source_registry(
    directory_rows: Iterable[dict[str, Any]],
    *,
    published_snapshot: dict[str, Any] | None = None,
    output_root: Path | None = None,
    overrides: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    overrides = overrides or {}
    published_by_slug = {
        str(row.get("slug")): _summarize_published_school(row)
        for row in (published_snapshot or {}).get("schools", [])
        if row.get("slug")
    }

    normalized_by_slug: dict[str, Path] = {}
    raw_by_slug: dict[str, Path] = {}
    matches_by_slug: dict[str, Path] = {}
    if output_root is not None:
        normalized_by_slug, raw_by_slug, matches_by_slug = _collect_rmp_paths(output_root)

    registry: list[dict[str, Any]] = []

    for row in directory_rows:
        slug = str(row.get("slug") or "").strip()
        if not slug:
            continue
        school_name = str(row.get("name") or slug).strip()
        short_name = _directory_short_name(row)
        override = overrides.get(slug, {})

        raw_path = raw_by_slug.get(slug)
        normalized_path = normalized_by_slug.get(slug)
        match_path = matches_by_slug.get(slug)

        school_legacy_id = (
            str(override.get("rmp_school_legacy_id") or "").strip() or None
        )
        if school_legacy_id is None and raw_path is not None:
            raw_payload = load_json(raw_path)
            school_legacy_id = _extract_rmp_school_legacy_id(raw_payload)

        record_count = 0
        if normalized_path is not None and normalized_path.is_file():
            normalized_payload = load_json(normalized_path)
            if isinstance(normalized_payload, list):
                record_count = len(normalized_payload)

        university_scope = bool(
            override.get("university_scope")
            if "university_scope" in override
            else is_university_scope_school(school_name)
        )
        rmp_enabled = bool(
            override.get("rmp_enabled")
            if "rmp_enabled" in override
            else university_scope
        )

        entry = {
            "school_slug": slug,
            "school_name": school_name,
            "short_name": short_name,
            "state": row.get("state"),
            "control": row.get("control"),
            "website": row.get("website"),
            "student_size": row.get("student_size"),
            "university_scope": university_scope,
            "sources": {
                "directory": {
                    "status": "live",
                },
                "official": {
                    "catalog_status": "live"
                    if published_by_slug.get(slug, {}).get("has_catalog")
                    else "pending",
                    "section_status": "live"
                    if published_by_slug.get(slug, {}).get("has_sections")
                    else "pending",
                    "grade_status": "live"
                    if published_by_slug.get(slug, {}).get("has_official_grades")
                    else "pending",
                },
                "rmp": {
                    "enabled": rmp_enabled,
                    "school_legacy_id": school_legacy_id,
                    "status": _rmp_status(
                        enabled=rmp_enabled,
                        school_legacy_id=school_legacy_id,
                        has_snapshot=normalized_path is not None,
                    ),
                    "normalized_path": str(normalized_path) if normalized_path else None,
                    "raw_path": str(raw_path) if raw_path else None,
                    "last_synced_at": _iso_mtime(normalized_path or raw_path),
                    "record_count": record_count,
                    **_match_summary(match_path),
                },
            },
            "published": published_by_slug.get(
                slug,
                {
                    "planner_readiness": "directory_ready",
                    "has_catalog": False,
                    "has_sections": False,
                    "has_instructor_directory": False,
                    "professor_coverage_level": "directory_only",
                    "has_official_grades": False,
                    "has_rmp": False,
                },
            ),
        }
        registry.append(entry)

    registry.sort(key=lambda item: (item["school_name"].lower(), item["school_slug"]))
    return registry
