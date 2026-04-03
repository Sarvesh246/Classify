import json
import time
from pathlib import Path
from typing import Iterable, Optional

import requests

from etl.classly_etl.adapters.base import SourceAdapter
from etl.classly_etl.models import RMPRatingRecord


DEFAULT_RMP_QUERY = """
query SearchTeachers($query: TeacherSearchQuery!, $first: Int!, $after: String) {
  newSearch {
    teachers(query: $query, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          legacyId
          firstName
          lastName
          avgRating
          avgDifficulty
          numRatings
          school {
            slug
          }
          teacherRatingTags {
            tagName
            tagCount
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
""".strip()


def _extract_edges(payload) -> list[dict]:
    data = payload.get("data", {})
    teachers = (
        data.get("newSearch", {}).get("teachers")
        or data.get("teachers")
        or {}
    )
    return teachers.get("edges", [])


def _extract_page_info(payload) -> dict:
    data = payload.get("data", {})
    teachers = (
        data.get("newSearch", {}).get("teachers")
        or data.get("teachers")
        or {}
    )
    return teachers.get("pageInfo", {})


def _extract_tags(item: dict) -> tuple[str, ...]:
    raw_tags = item.get("teacherRatingTags") or item.get("tags") or []
    tags: list[str] = []

    for entry in raw_tags:
        if isinstance(entry, str):
            tags.append(entry.strip())
            continue

        if isinstance(entry, dict):
            label = (
                entry.get("tagName")
                or entry.get("name")
                or entry.get("tag")
                or ""
            )
            if label:
                tags.append(str(label).strip())

    return tuple(tag for tag in tags if tag)


class RMPRatingAdapter(SourceAdapter):
    key = "rmp_graphql"

    def __init__(self, payload):
        self.payload = payload

    def fetch_raw(self):
        return self.payload

    def normalize(self, payload) -> Iterable[RMPRatingRecord]:
        for node in _extract_edges(payload):
            item = node["node"]
            school = item.get("school", {})
            first_name = item.get("firstName", "").strip()
            last_name = item.get("lastName", "").strip()
            professor_name = " ".join(part for part in [first_name, last_name] if part)

            yield RMPRatingRecord(
                school_slug=school.get("slug", ""),
                professor_name=professor_name,
                rmp_id=str(item.get("legacyId") or item.get("id") or ""),
                rating=item.get("avgRating"),
                difficulty=item.get("avgDifficulty"),
                review_count=item.get("numRatings", 0),
                tags=_extract_tags(item),
            )


class LiveRMPGraphQLAdapter(SourceAdapter):
    key = "rmp_graphql_live"

    def __init__(
        self,
        school_slug: str,
        endpoint: str,
        *,
        school_legacy_id: Optional[str] = None,
        search_text: str = "",
        page_size: int = 100,
        max_pages: int = 10,
        pause_seconds: float = 0.2,
        query_text: str = DEFAULT_RMP_QUERY,
        fixture_path: Optional[Path] = None,
        session: Optional[requests.Session] = None,
        timeout_seconds: int = 20,
    ):
        self.school_slug = school_slug
        self.school_legacy_id = school_legacy_id
        self.endpoint = endpoint
        self.search_text = search_text
        self.page_size = page_size
        self.max_pages = max_pages
        self.pause_seconds = pause_seconds
        self.query_text = query_text
        self.fixture_path = fixture_path
        self.session = session or requests.Session()
        self.timeout_seconds = timeout_seconds

    def _build_variables(self, cursor: Optional[str]) -> dict:
        query_filter = {"text": self.search_text}

        if self.school_legacy_id:
            query_filter["schoolID"] = self.school_legacy_id

        if self.school_slug:
            query_filter["schoolSlug"] = self.school_slug

        return {
            "query": query_filter,
            "first": self.page_size,
            "after": cursor,
        }

    def fetch_raw(self):
        if self.fixture_path is not None:
            return json.loads(Path(self.fixture_path).read_text(encoding="utf-8"))

        pages: list[dict] = []
        cursor: Optional[str] = None

        for page_number in range(self.max_pages):
            response = self.session.post(
                self.endpoint,
                json={
                    "query": self.query_text,
                    "variables": self._build_variables(cursor),
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            pages.append(payload)

            page_info = _extract_page_info(payload)
            if not page_info.get("hasNextPage"):
                break

            cursor = page_info.get("endCursor")
            if not cursor:
                break

            if page_number < self.max_pages - 1:
                time.sleep(self.pause_seconds)

        return {"pages": pages}

    def normalize(self, payload) -> Iterable[RMPRatingRecord]:
        if isinstance(payload, dict) and "pages" in payload:
            pages = payload.get("pages", [])
        else:
            pages = [payload]
        for page in pages:
            yield from RMPRatingAdapter(page).normalize(page)
