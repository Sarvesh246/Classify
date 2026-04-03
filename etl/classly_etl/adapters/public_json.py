import json
from pathlib import Path
from typing import Iterable

from etl.classly_etl.adapters.base import SourceAdapter
from etl.classly_etl.models import GradeDistributionRecord


class PublicJsonAdapter(SourceAdapter):
    key = "public_json_feed"

    def __init__(self, fixture_path: Path, school_slug: str):
        self.fixture_path = fixture_path
        self.school_slug = school_slug

    def fetch_raw(self):
        return json.loads(self.fixture_path.read_text())

    def normalize(self, payload) -> Iterable[GradeDistributionRecord]:
        for row in payload["sections"]:
            yield GradeDistributionRecord(
                school_slug=self.school_slug,
                course_code=row["course_code"],
                course_name=row["course_name"],
                professor_name=row["professor_name"],
                term=row["term"],
                avg_gpa=row.get("avg_gpa"),
                a_pct=row.get("a_pct"),
                sample_size=row["sample_size"],
                source_key=self.key,
            )
