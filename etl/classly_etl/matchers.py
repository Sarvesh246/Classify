from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, replace
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
from typing import Iterable, Mapping, Optional

from etl.classly_etl.models import (
    ProfessorIdentityRecord,
    ProfessorMatchCandidate,
    ProfessorMatchResolution,
    ProfessorMatchReviewRecord,
    RMPRatingRecord,
)

AUTO_LINK_THRESHOLD = 90.0
AUTO_LINK_WITH_HINT_THRESHOLD = 80.0
REVIEW_THRESHOLD = 65.0
AUTO_LINK_MARGIN = 12.0
UNMATCHED_IDENTITY_CONFIDENCE = 100.0

HIGH_COLLISION_SURNAMES = frozenset(
    {
        "smith",
        "lee",
        "wang",
        "zhang",
        "kim",
        "nguyen",
        "patel",
        "jones",
        "garcia",
        "martinez",
        "johnson",
        "brown",
        "davis",
        "miller",
        "lopez",
        "gonzalez",
        "hernandez",
        "rodriguez",
        "wilson",
        "anderson",
        "taylor",
        "thomas",
    },
)

_HONORIFICS = {
    "dr",
    "drs",
    "mr",
    "mrs",
    "ms",
    "miss",
    "prof",
    "professor",
}


def _clean_name_tokens(name: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s'-]+", " ", name.lower())
    tokens = [token for token in cleaned.split() if token and token not in _HONORIFICS]
    return tokens


def normalize_professor_name(name: str) -> str:
    return " ".join(_clean_name_tokens(name))


def _first_token(tokens: list[str]) -> str:
    if not tokens:
        return ""
    if len(tokens) == 1:
        return tokens[0]
    return tokens[0]


def _surname(tokens: list[str]) -> str:
    return tokens[-1] if tokens else ""


def _first_initial(token: str) -> str:
    return token[:1] if token else ""


def _course_prefix(course_code: str | None) -> str:
    if not course_code:
        return ""
    match = re.match(r"([A-Za-z&]+)", course_code.strip())
    return (match.group(1).lower() if match else "").replace("&", "and")


def _name_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalize_professor_name(left), normalize_professor_name(right)).ratio()


def best_professor_match(name: str, candidates: Iterable[str]) -> tuple[Optional[str], float]:
    normalized_name = normalize_professor_name(name)
    best_candidate = None
    best_score = 0.0

    for candidate in candidates:
        score = SequenceMatcher(
            None,
            normalized_name,
            normalize_professor_name(candidate),
        ).ratio()
        if score > best_score:
            best_candidate = candidate
            best_score = score

    return best_candidate, round(best_score, 3)


def build_professor_identities(
    offerings: Iterable[Mapping[str, object]],
) -> list[ProfessorIdentityRecord]:
    grouped: dict[tuple[str, str], dict[str, object]] = {}

    for row in offerings:
        school_slug = str(row.get("schoolSlug") or row.get("school_slug") or "").strip()
        professor_slug = str(
            row.get("professorSlug")
            or row.get("professor_slug")
            or normalize_professor_name(str(row.get("professorName") or row.get("professor_name") or ""))
        ).strip()
        professor_name = str(row.get("professorName") or row.get("professor_name") or "").strip()

        if not school_slug or not professor_slug or not professor_name:
            continue

        key = (school_slug, professor_slug)
        current = grouped.get(
            key,
            {
                "professor_name": professor_name,
                "departments": set(),
                "course_prefixes": set(),
            },
        )

        if len(professor_name) > len(str(current["professor_name"])):
            current["professor_name"] = professor_name

        department = str(row.get("department") or "").strip()
        if department:
            current["departments"].add(department)

        prefix = _course_prefix(str(row.get("courseCode") or row.get("course_code") or ""))
        if prefix:
            current["course_prefixes"].add(prefix)

        grouped[key] = current

    identities: list[ProfessorIdentityRecord] = []
    per_school_surnames: dict[str, list[str]] = defaultdict(list)
    per_school_initial_keys: dict[str, list[str]] = defaultdict(list)

    for (school_slug, professor_slug), current in grouped.items():
        professor_name = str(current["professor_name"])
        tokens = _clean_name_tokens(professor_name)
        surname = _surname(tokens)
        first_token = _first_token(tokens)
        first_initial = _first_initial(first_token)

        identities.append(
            ProfessorIdentityRecord(
                school_slug=school_slug,
                professor_slug=professor_slug,
                professor_name=professor_name,
                normalized_name=normalize_professor_name(professor_name),
                surname=surname,
                first_token=first_token,
                first_initial=first_initial,
                departments=tuple(sorted(current["departments"])),
                course_prefixes=tuple(sorted(current["course_prefixes"])),
            )
        )
        if surname:
            per_school_surnames[school_slug].append(surname)
        if surname and first_initial:
            per_school_initial_keys[school_slug].append(f"{first_initial}:{surname}")

    surname_counts = {
        school_slug: {
            surname: values.count(surname)
            for surname in set(values)
        }
        for school_slug, values in per_school_surnames.items()
    }
    initial_counts = {
        school_slug: {
            key: values.count(key)
            for key in set(values)
        }
        for school_slug, values in per_school_initial_keys.items()
    }

    return [
        replace(
            identity,
            unique_surname=bool(
                identity.surname
                and surname_counts.get(identity.school_slug, {}).get(identity.surname, 0) == 1
            ),
            unique_initial_surname=bool(
                identity.surname
                and identity.first_initial
                and initial_counts.get(identity.school_slug, {}).get(
                    f"{identity.first_initial}:{identity.surname}",
                    0,
                )
                == 1
            ),
        )
        for identity in identities
    ]


def _department_token_hit(left: str, right: str) -> bool:
    left_tokens = {t for t in normalize_professor_name(left).split() if len(t) >= 4}
    right_tokens = {t for t in normalize_professor_name(right).split() if len(t) >= 4}
    return bool(left_tokens & right_tokens)


def _department_overlap(
    identity: ProfessorIdentityRecord,
    rmp_department: str | None,
) -> bool:
    if not rmp_department:
        return False
    normalized_rmp = normalize_professor_name(rmp_department)
    for dept in identity.departments:
        normalized_dept = normalize_professor_name(dept)
        if normalized_dept == normalized_rmp:
            return True
        if _department_token_hit(dept, rmp_department):
            return True
    return False


def score_professor_candidate(
    identity: ProfessorIdentityRecord,
    rmp_record: RMPRatingRecord,
) -> Optional[ProfessorMatchCandidate]:
    candidate_name = rmp_record.professor_name.strip()
    if not candidate_name:
        return None

    rmp_tokens = _clean_name_tokens(candidate_name)
    if not rmp_tokens:
        return None

    rmp_first = _first_token(rmp_tokens)
    rmp_surname = _surname(rmp_tokens)
    rmp_initial = _first_initial(rmp_first)
    similarity = _name_similarity(identity.professor_name, candidate_name)

    if not rmp_surname:
        return None

    surname_exact = identity.surname == rmp_surname
    if not surname_exact and similarity < 0.88:
        return None

    score = 0.0
    reasons: list[str] = []

    if identity.normalized_name == normalize_professor_name(candidate_name):
        score += 35
        reasons.append("exact normalized name")

    if surname_exact:
        score += 30
        reasons.append("exact surname")

    if identity.first_token and rmp_first and identity.first_token == rmp_first:
        score += 20
        reasons.append("exact first token")
    elif identity.first_initial and rmp_initial and identity.first_initial == rmp_initial:
        score += 18
        reasons.append("first initial match")
    elif identity.first_token and rmp_first and (
        identity.first_token.startswith(rmp_first) or rmp_first.startswith(identity.first_token)
    ):
        score += 12
        reasons.append("first token prefix match")

    score += round(similarity * 20, 1)
    if similarity >= 0.94:
        reasons.append("very close spelling")
    elif similarity >= 0.82:
        reasons.append("close spelling")

    token_overlap = len(set(identity.normalized_name.split()) & set(normalize_professor_name(candidate_name).split()))
    if token_overlap >= 2:
        score += 8
        reasons.append("multi-token overlap")
    elif token_overlap == 1:
        score += 4
        reasons.append("single-token overlap")

    if identity.unique_surname:
        score += 8
        reasons.append("unique surname at school")

    if identity.unique_initial_surname:
        score += 12
        reasons.append("unique initial+surname at school")

    department_overlap = _department_overlap(identity, rmp_record.department)
    if department_overlap:
        score += 8
        reasons.append("department overlap")

    if identity.course_prefixes and rmp_record.department:
        dept_norm = normalize_professor_name(rmp_record.department)
        if any(prefix and prefix in dept_norm for prefix in identity.course_prefixes):
            score += 4
            reasons.append("course prefix in RMP department")

    if (
        identity.surname.lower() in HIGH_COLLISION_SURNAMES
        and not identity.unique_surname
        and not identity.unique_initial_surname
    ):
        score = max(0.0, score - 5.0)
        reasons.append("common surname caution")

    confidence = round(min(score, 100.0), 1)
    structural_hint = identity.unique_surname or identity.unique_initial_surname or department_overlap

    return ProfessorMatchCandidate(
        school_slug=identity.school_slug,
        professor_slug=identity.professor_slug,
        professor_name=identity.professor_name,
        rmp_id=rmp_record.rmp_id,
        rmp_professor_name=candidate_name,
        confidence=confidence,
        margin_to_runner_up=0.0,
        reasons=tuple(reasons),
        structural_hint=structural_hint,
        review_count=rmp_record.review_count,
        rating=rmp_record.rating,
        difficulty=rmp_record.difficulty,
        tags=rmp_record.tags,
    )


def _resolution_status(
    confidence: float,
    margin: float,
    structural_hint: bool,
) -> str:
    if confidence >= AUTO_LINK_THRESHOLD:
        return "auto_linked"
    if confidence >= AUTO_LINK_WITH_HINT_THRESHOLD and margin >= AUTO_LINK_MARGIN and structural_hint:
        return "auto_linked"
    if confidence >= REVIEW_THRESHOLD:
        return "review"
    return "unmatched"


def resolve_professor_matches(
    offerings: Iterable[Mapping[str, object]],
    rmp_records: Iterable[RMPRatingRecord],
    *,
    school_slug: Optional[str] = None,
) -> tuple[list[ProfessorMatchResolution], list[ProfessorMatchReviewRecord]]:
    identities = build_professor_identities(offerings)
    if school_slug:
        identities = [identity for identity in identities if identity.school_slug == school_slug]

    identities_by_school: dict[str, list[ProfessorIdentityRecord]] = defaultdict(list)
    for identity in identities:
        identities_by_school[identity.school_slug].append(identity)

    records = [
        record
        for record in rmp_records
        if not school_slug or record.school_slug == school_slug
    ]

    provisional: list[dict[str, object]] = []
    for record in records:
        school_identities = identities_by_school.get(record.school_slug, [])
        if not school_identities:
            continue

        candidates = [
            candidate
            for identity in school_identities
            if (candidate := score_professor_candidate(identity, record)) is not None
        ]
        if not candidates:
            continue

        candidates.sort(key=lambda item: (item.confidence, item.review_count), reverse=True)
        best = candidates[0]
        runner_up = candidates[1] if len(candidates) > 1 else None
        margin = round(
            best.confidence - (runner_up.confidence if runner_up else 0.0),
            1,
        )
        best = replace(best, margin_to_runner_up=margin)
        status = _resolution_status(best.confidence, margin, best.structural_hint)
        provisional.append(
            {
                "best": best,
                "runner_up": runner_up,
                "status": status,
            }
        )

    assigned_professors: dict[str, ProfessorMatchResolution] = {}
    reviews: list[ProfessorMatchReviewRecord] = []
    competing_reviews: dict[str, ProfessorMatchResolution] = {}

    auto_candidates = sorted(
        [item for item in provisional if item["status"] == "auto_linked"],
        key=lambda item: (
            item["best"].confidence,
            item["best"].review_count,
            item["best"].margin_to_runner_up,
        ),
        reverse=True,
    )

    for item in auto_candidates:
        best: ProfessorMatchCandidate = item["best"]
        runner_up: Optional[ProfessorMatchCandidate] = item["runner_up"]
        existing = assigned_professors.get(best.professor_slug)
        if existing is not None:
            notes = "Conflicts with a higher-confidence auto-linked RMP record."
            reviews.append(
                ProfessorMatchReviewRecord(
                    school_slug=best.school_slug,
                    professor_name_raw=best.rmp_professor_name,
                    rmp_id=best.rmp_id,
                    proposed_professor_slug=best.professor_slug,
                    proposed_professor_name=best.professor_name,
                    confidence=best.confidence,
                    status="pending",
                    notes=notes,
                    runner_up_professor_slug=runner_up.professor_slug if runner_up else None,
                    runner_up_professor_name=runner_up.professor_name if runner_up else None,
                    runner_up_confidence=runner_up.confidence if runner_up else None,
                )
            )
            continue

        assigned_professors[best.professor_slug] = ProfessorMatchResolution(
            school_slug=best.school_slug,
            professor_slug=best.professor_slug,
            professor_name=best.professor_name,
            status="auto_linked",
            confidence=best.confidence,
            reason=", ".join(best.reasons),
            margin_to_runner_up=best.margin_to_runner_up,
            rmp_id=best.rmp_id,
            rmp_professor_name=best.rmp_professor_name,
            rating=best.rating,
            difficulty=best.difficulty,
            review_count=best.review_count,
            tags=best.tags,
        )

    for item in provisional:
        if item["status"] == "auto_linked":
            continue
        best: ProfessorMatchCandidate = item["best"]
        runner_up: Optional[ProfessorMatchCandidate] = item["runner_up"]
        if item["status"] == "review":
            review_notes = ", ".join(best.reasons) or "Ambiguous school-scoped professor match."
            reviews.append(
                ProfessorMatchReviewRecord(
                    school_slug=best.school_slug,
                    professor_name_raw=best.rmp_professor_name,
                    rmp_id=best.rmp_id,
                    proposed_professor_slug=best.professor_slug,
                    proposed_professor_name=best.professor_name,
                    confidence=best.confidence,
                    status="pending",
                    notes=review_notes,
                    runner_up_professor_slug=runner_up.professor_slug if runner_up else None,
                    runner_up_professor_name=runner_up.professor_name if runner_up else None,
                    runner_up_confidence=runner_up.confidence if runner_up else None,
                )
            )
            current = competing_reviews.get(best.professor_slug)
            if current is None or best.confidence > current.confidence:
                competing_reviews[best.professor_slug] = ProfessorMatchResolution(
                    school_slug=best.school_slug,
                    professor_slug=best.professor_slug,
                    professor_name=best.professor_name,
                    status="review",
                    confidence=best.confidence,
                    reason=review_notes,
                    margin_to_runner_up=best.margin_to_runner_up,
                    rmp_id=best.rmp_id,
                    rmp_professor_name=best.rmp_professor_name,
                    rating=best.rating,
                    difficulty=best.difficulty,
                    review_count=best.review_count,
                    tags=best.tags,
                )

    resolutions: list[ProfessorMatchResolution] = []
    for identity in identities:
        if identity.professor_slug in assigned_professors:
            resolutions.append(assigned_professors[identity.professor_slug])
            continue
        if identity.professor_slug in competing_reviews:
            resolutions.append(competing_reviews[identity.professor_slug])
            continue

        resolutions.append(
            ProfessorMatchResolution(
                school_slug=identity.school_slug,
                professor_slug=identity.professor_slug,
                professor_name=identity.professor_name,
                status="unmatched",
                confidence=UNMATCHED_IDENTITY_CONFIDENCE,
                reason="No eligible RMP match found for this school-scoped professor identity.",
            )
        )

    resolutions.sort(key=lambda item: (item.school_slug, item.professor_slug))
    reviews.sort(
        key=lambda item: (
            item.school_slug,
            -item.confidence,
            item.professor_name_raw.lower(),
        )
    )
    return resolutions, reviews


def enrich_offerings_with_match_resolutions(
    offerings: Iterable[Mapping[str, object]],
    resolutions: Iterable[ProfessorMatchResolution],
) -> list[dict[str, object]]:
    lookup = {
        (item.school_slug, item.professor_slug): item
        for item in resolutions
    }
    enriched: list[dict[str, object]] = []

    for row in offerings:
        copy = dict(row)
        school_slug = str(copy.get("schoolSlug") or copy.get("school_slug") or "").strip()
        professor_slug = str(copy.get("professorSlug") or copy.get("professor_slug") or "").strip()
        resolution = lookup.get((school_slug, professor_slug))
        if resolution is None:
            enriched.append(copy)
            continue

        copy["matchConfidence"] = round(resolution.confidence, 1)
        source_labels = [
            label
            for label in list(copy.get("sourceLabels") or [])
            if label not in {"RMP GraphQL", "Rate My Professors"}
        ]

        has_rmp_signal = bool(
            resolution.review_count > 0
            or (resolution.rating is not None and resolution.rating > 0)
            or (resolution.difficulty is not None and resolution.difficulty > 0)
            or resolution.tags
        )

        if resolution.status == "auto_linked" and has_rmp_signal:
            copy["rmpRating"] = resolution.rating
            copy["rmpDifficulty"] = resolution.difficulty
            copy["tags"] = list(resolution.tags)
            if "RMP GraphQL" not in source_labels:
                source_labels.append("RMP GraphQL")
            if str(copy.get("coverageTier")) == "institutional_only":
                copy["coverageTier"] = "institutional_plus_rmp"
        else:
            copy["rmpRating"] = None
            copy["rmpDifficulty"] = None
            copy["tags"] = []
            if str(copy.get("coverageTier")) == "institutional_plus_rmp":
                copy["coverageTier"] = "institutional_only"

        copy["sourceLabels"] = source_labels

        enriched.append(copy)

    return enriched


def build_match_audit_report(
    resolutions: Iterable[ProfessorMatchResolution],
    reviews: Iterable[ProfessorMatchReviewRecord],
    *,
    school_slug: str,
) -> dict[str, object]:
    resolution_list = [item for item in resolutions if item.school_slug == school_slug]
    review_list = [item for item in reviews if item.school_slug == school_slug]

    return {
        "schoolSlug": school_slug,
        "autoLinkedCount": sum(item.status == "auto_linked" for item in resolution_list),
        "reviewCount": sum(item.status == "review" for item in resolution_list),
        "unmatchedCount": sum(item.status == "unmatched" for item in resolution_list),
        "pendingReviewCount": len(review_list),
        "riskyCases": [
            asdict(item)
            for item in review_list[:20]
        ],
    }


def load_normalized_rmp_records(path: str | Path) -> list[RMPRatingRecord]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Expected a list of normalized RMP rows in {path}")

    records: list[RMPRatingRecord] = []
    for row in payload:
        records.append(
            RMPRatingRecord(
                school_slug=row["school_slug"],
                professor_name=row["professor_name"],
                rmp_id=row.get("rmp_id"),
                rating=row.get("rating"),
                difficulty=row.get("difficulty"),
                review_count=int(row.get("review_count", 0)),
                department=row.get("department"),
                tags=tuple(row.get("tags", [])),
            )
        )
    return records
