import json
import os
from pathlib import Path
from typing import Iterable

import requests

from etl.classly_etl.adapters.base import SourceAdapter
from etl.classly_etl.models import SchoolDirectoryRecord
from etl.classly_etl.parsers import slugify_school_name


class CollegeScorecardSchoolDirectoryAdapter(SourceAdapter):
    key = "college_scorecard_api"
    base_url = "https://api.data.gov/ed/collegescorecard/v1/schools"
    fields = ",".join(
        [
            "id",
            "school.name",
            "school.alias",
            "school.city",
            "school.state",
            "school.school_url",
            "school.ownership",
            "school.degrees_awarded.predominant",
            "latest.student.size",
        ]
    )

    def __init__(
        self,
        *,
        api_key: str | None = None,
        fixture_path: Path | None = None,
        per_page: int = 100,
        max_pages: int | None = None,
        ownership_values: tuple[int, ...] = (1, 2, 3),
        predominant_awards: tuple[int, ...] = (1, 2, 3, 4),
    ):
        self.api_key = api_key or os.getenv("COLLEGE_SCORECARD_API_KEY")
        self.fixture_path = fixture_path
        self.per_page = per_page
        self.max_pages = max_pages
        self.ownership_values = ownership_values
        self.predominant_awards = predominant_awards

    def fetch_raw(self):
        if self.fixture_path is not None:
            return json.loads(self.fixture_path.read_text())

        if not self.api_key:
            raise ValueError(
                "COLLEGE_SCORECARD_API_KEY is required for live school directory imports."
            )

        all_results = []
        page = 0
        while True:
            response = requests.get(
                self.base_url,
                params={
                    "api_key": self.api_key,
                    "fields": self.fields,
                    "per_page": self.per_page,
                    "page": page,
                    "school.ownership__range": f"{min(self.ownership_values)}..{max(self.ownership_values)}",
                    "school.degrees_awarded.predominant__range": f"{min(self.predominant_awards)}..{max(self.predominant_awards)}",
                },
                timeout=60,
            )
            response.raise_for_status()
            payload = response.json()
            all_results.extend(payload.get("results", []))

            metadata = payload.get("metadata", {})
            total = metadata.get("total", len(all_results))
            if len(all_results) >= total:
                break

            page += 1
            if self.max_pages is not None and page >= self.max_pages:
                break

        return {"results": all_results}

    def normalize(self, payload) -> Iterable[SchoolDirectoryRecord]:
        ownership_map = {
            1: "Public",
            2: "Private nonprofit",
            3: "Private for-profit",
        }

        for row in payload.get("results", []):
            ownership = row.get("school.ownership")
            predominant_award = row.get("school.degrees_awarded.predominant")
            if ownership is not None and ownership not in self.ownership_values:
                continue
            if (
                predominant_award is not None
                and predominant_award not in self.predominant_awards
            ):
                continue
            name = row["school.name"]
            yield SchoolDirectoryRecord(
                school_id=row["id"],
                slug=slugify_school_name(name),
                name=name,
                alias=row.get("school.alias"),
                city=row.get("school.city", ""),
                state=row.get("school.state", ""),
                website=row.get("school.school_url"),
                control=ownership_map.get(row.get("school.ownership")),
                student_size=row.get("latest.student.size"),
            )
