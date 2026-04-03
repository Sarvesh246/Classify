import json
from pathlib import Path
from typing import Iterable

import requests

from etl.classly_etl.adapters.base import SourceAdapter
from etl.classly_etl.models import GradeDistributionRecord
from etl.classly_etl.parsers import parse_ut_austin_dashboard_csv


class UTAustinTableauAdapter(SourceAdapter):
    key = "ut_austin_tableau"
    csv_export_url = (
        "https://iq-analytics.austin.utexas.edu/views/"
        "Gradedistributiondashboard/Externaldashboard-Crosstab.csv?:showVizHome=no"
    )

    def __init__(self, fixture_path: Path | None = None):
        self.fixture_path = fixture_path

    def fetch_raw(self):
        if self.fixture_path is not None:
            if self.fixture_path.suffix.lower() == ".json":
                return json.loads(self.fixture_path.read_text())
            return self.fixture_path.read_text()

        response = requests.get(self.csv_export_url, timeout=60)
        response.raise_for_status()
        return response.text

    def normalize(self, payload) -> Iterable[GradeDistributionRecord]:
        if isinstance(payload, str):
            yield from parse_ut_austin_dashboard_csv(payload)
            return

        for row in payload["rows"]:
            yield GradeDistributionRecord(
                school_slug="ut-austin",
                course_code=row["course_code"],
                course_name=row["course_name"],
                professor_name=row["professor_name"],
                term=row["term"],
                avg_gpa=row["avg_gpa"],
                a_pct=row["a_pct"],
                sample_size=row["enrollment"],
                source_key=self.key,
            )
