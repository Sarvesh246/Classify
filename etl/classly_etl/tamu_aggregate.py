"""Aggregate TAMU GradeDistributionRecord rows into catalog-ready offering dicts."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import replace
from typing import Any, Iterable, Mapping

from etl.classly_etl.models import GradeDistributionRecord
from etl.classly_etl.adapters.tamu_catalog import normalize_tamu_catalog_code
from etl.classly_etl.tamu_names import normalize_tamu_instructor

TERM_ORDER = {"Spring": 1, "Summer": 2, "Fall": 3}


def slugify(value: str) -> str:
    s = value.lower().strip().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "unknown"


def course_slug(code: str, department: str | None) -> str:
    base = slugify(code.replace(" ", "-"))
    if department:
        return f"{base}-{slugify(department)}"
    return base


def term_sort_key(term: str) -> tuple[int, int]:
    parts = term.strip().split()
    if len(parts) >= 2:
        season, year_s = parts[0], parts[1]
        try:
            year = int(year_s)
        except ValueError:
            year = 0
        return (year, TERM_ORDER.get(season, 0))
    return (0, 0)


def records_from_json_rows(rows: list[dict]) -> list[GradeDistributionRecord]:
    out: list[GradeDistributionRecord] = []
    for r in rows:
        out.append(
            GradeDistributionRecord(
                school_slug=r["school_slug"],
                course_code=r["course_code"],
                course_name=r["course_name"],
                professor_name=r.get("professor_name"),
                term=r["term"],
                avg_gpa=r.get("avg_gpa"),
                a_pct=r.get("a_pct"),
                sample_size=int(r["sample_size"]),
                source_key=r["source_key"],
                section_number=r.get("section_number"),
                department=r.get("department"),
                source_url=r.get("source_url"),
            )
        )
    return out


def normalize_course_code(code: str) -> str:
    return re.sub(r"\s+", " ", code.strip().upper())


def _merge_term_rows(rows: list[GradeDistributionRecord], display_name: str) -> GradeDistributionRecord:
    """Enrollment-weighted merge of section rows for the same instructor/course/term."""
    if len(rows) == 1:
        return replace(rows[0], professor_name=display_name)
    total_n = sum(r.sample_size for r in rows)
    gpa_num = sum((r.avg_gpa or 0) * r.sample_size for r in rows if r.avg_gpa is not None)
    gpa_den = sum(r.sample_size for r in rows if r.avg_gpa is not None)
    avg_gpa = round(gpa_num / gpa_den, 3) if gpa_den else rows[-1].avg_gpa
    ar_num = sum((r.a_pct or 0) * r.sample_size for r in rows if r.a_pct is not None)
    ar_den = sum(r.sample_size for r in rows if r.a_pct is not None)
    a_pct = round(ar_num / ar_den, 1) if ar_den else rows[-1].a_pct
    base = rows[0]
    return replace(
        base,
        professor_name=display_name,
        sample_size=total_n,
        avg_gpa=avg_gpa,
        a_pct=a_pct,
        section_number=None,
    )


def dedupe_same_term_sections(
    records: list[GradeDistributionRecord],
) -> list[tuple[GradeDistributionRecord, str]]:
    """
    Combine duplicate PDF rows (multiple sections) sharing instructor, course, department, and term.
    Returns (record, canonical_professor_key) — key must stay stable from raw registrar strings.
    """
    bucket: dict[tuple[str, str, str | None, str], list[tuple[GradeDistributionRecord, str, str]]] = (
        defaultdict(list)
    )
    for r in records:
        if r.school_slug != "texas-am":
            continue
        display, canon = normalize_tamu_instructor(r.professor_name)
        cc = normalize_course_code(r.course_code)
        key = (canon, cc, r.department, r.term)
        bucket[key].append((r, display, canon))

    merged: list[tuple[GradeDistributionRecord, str]] = []
    for items in bucket.values():
        rows = [t[0] for t in items]
        displays = sorted({t[1] for t in items})
        canons = {t[2] for t in items}
        canon_key = sorted(canons)[0]
        display_name = displays[0] if len(displays) == 1 else max(displays, key=len)
        merged.append((_merge_term_rows(rows, display_name), canon_key))
    return merged


def aggregate_tamu_offerings(
    records: Iterable[GradeDistributionRecord],
    *,
    school_name: str = "Texas A&M University",
    coverage_tier: str = "institutional_only",
    course_catalog: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Group by professor + course + department; build trend + headline stats."""
    raw_list = [r for r in records if r.school_slug == "texas-am"]
    section_pairs = dedupe_same_term_sections(raw_list)

    groups: dict[tuple[str, str, str | None], list[GradeDistributionRecord]] = defaultdict(list)
    for rec, prof_canon in section_pairs:
        cc = normalize_course_code(rec.course_code)
        key = (prof_canon, cc, rec.department)
        groups[key].append(rec)

    offerings: list[dict[str, Any]] = []
    for (prof_canon, course_code, department), term_rows in groups.items():
        term_rows.sort(key=lambda r: term_sort_key(r.term))
        trend_raw: list[dict[str, Any]] = []
        for r in term_rows:
            trend_raw.append(
                {
                    "term": r.term,
                    "avgGpa": r.avg_gpa,
                    "aPct": r.a_pct,
                    "rmpRating": None,
                    "rmpDifficulty": None,
                }
            )
        latest = term_rows[-1]
        prof_display = latest.professor_name or "Unknown instructor"
        total_n = sum(r.sample_size for r in term_rows)
        # Weighted GPA / A-rate across terms for headline
        gpa_num = sum((r.avg_gpa or 0) * r.sample_size for r in term_rows if r.avg_gpa is not None)
        gpa_den = sum(r.sample_size for r in term_rows if r.avg_gpa is not None)
        expected_gpa = round(gpa_num / gpa_den, 3) if gpa_den else latest.avg_gpa
        ar_num = sum((r.a_pct or 0) * r.sample_size for r in term_rows if r.a_pct is not None)
        ar_den = sum(r.sample_size for r in term_rows if r.a_pct is not None)
        a_rate = round(ar_num / ar_den, 1) if ar_den else latest.a_pct

        normalized_course_code = normalize_tamu_catalog_code(course_code)
        cslug = course_slug(normalized_course_code, department)
        pslug = prof_canon
        oid = f"texas-am-{cslug}-{pslug}"
        course_meta = (course_catalog or {}).get(normalized_course_code, {})
        official_course_name = str(course_meta.get("course_name") or "").strip()
        course_name = official_course_name or latest.course_name or course_code
        course_description = str(course_meta.get("description") or "").strip()

        dept_label = department or "General"
        offerings.append(
            {
                "id": oid,
                "schoolSlug": "texas-am",
                "schoolName": school_name,
                "professorSlug": pslug,
                "courseSlug": cslug,
                "courseCode": normalized_course_code,
                "courseName": course_name,
                "professorName": prof_display,
                "department": dept_label,
                "expectedGpa": expected_gpa,
                "aRate": a_rate,
                "rmpRating": None,
                "rmpDifficulty": None,
                "coverageTier": coverage_tier,
                "latestTerm": latest.term,
                "termCount": len(term_rows),
                "matchConfidence": 100,
                "tags": [],
                "summary": f"Aggregated from TAMU registrar grade reports for {normalized_course_code} with {len(term_rows)} term(s) on record.",
                "professorTitle": "Instructor",
                "professorSummary": (
                    f"Official TAMU grade distributions for {prof_display} in {course_name}."
                ),
                "courseSummary": (
                    course_description
                    if course_description
                    else f"TAMU {normalized_course_code} outcomes in {dept_label} from published grade reports."
                ),
                "freshness": latest.term,
                "sourceLabels": ["TAMU Grade Report"],
                "dataCompleteness": "institutional_full",
                "sampleSize": max(total_n, latest.sample_size),
                "trend": trend_raw,
            }
        )
    return offerings


def load_records_from_output_json(path: str) -> list[GradeDistributionRecord]:
    raw = json.loads(open(path, encoding="utf8").read())
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        if "school_slug" in raw[0]:
            return records_from_json_rows(raw)
    raise ValueError(f"Unsupported JSON shape in {path}")
