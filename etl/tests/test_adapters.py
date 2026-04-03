import unittest
import json
import tempfile
from pathlib import Path

from etl.classly_etl.adapters.college_scorecard import (
    CollegeScorecardSchoolDirectoryAdapter,
)
from etl.classly_etl.adapters.public_json import PublicJsonAdapter
from etl.classly_etl.adapters.rmp import LiveRMPGraphQLAdapter, RMPRatingAdapter
from etl.classly_etl.adapters.tamu import TexasAMGradeDistributionAdapter
from etl.classly_etl.adapters.ut_austin import UTAustinTableauAdapter
from etl.classly_etl.matchers import best_professor_match


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class AdapterTests(unittest.TestCase):
    def test_ut_austin_adapter(self):
        adapter = UTAustinTableauAdapter(FIXTURES / "ut_austin_tableau.json")
        records = list(adapter.normalize(adapter.fetch_raw()))
        self.assertEqual(records[0].course_code, "M 408D")
        self.assertEqual(records[0].source_key, "ut_austin_tableau")
        self.assertEqual(records[0].professor_name, "Priya Venkataraman")

    def test_ut_austin_live_csv_fixture(self):
        adapter = UTAustinTableauAdapter(FIXTURES / "ut_austin_dashboard.csv")
        records = list(adapter.normalize(adapter.fetch_raw()))
        self.assertEqual(records[0].course_code, "M 408D")
        self.assertEqual(records[0].sample_size, 108)
        self.assertIsNone(records[0].professor_name)

    def test_public_json_adapter(self):
        adapter = PublicJsonAdapter(FIXTURES / "public_grade_feed.json", "georgia-tech")
        records = list(adapter.normalize(adapter.fetch_raw()))
        self.assertEqual(records[0].school_slug, "georgia-tech")
        self.assertEqual(records[0].sample_size, 202)

    def test_tamu_pdf_text_fixture(self):
        adapter = TexasAMGradeDistributionAdapter(
            year=2025,
            term_code="C",
            college_code="EN",
            fixture_path=FIXTURES / "tamu_grade_report_excerpt.txt",
        )
        records = list(adapter.normalize(adapter.fetch_raw()))
        self.assertEqual(records[0].course_code, "AERO 201")
        self.assertEqual(records[0].department, "AEROSPACE ENGINEERING")
        self.assertEqual(records[0].professor_name, "BHARGAVA D")

    def test_college_scorecard_fixture(self):
        adapter = CollegeScorecardSchoolDirectoryAdapter(
            fixture_path=FIXTURES / "college_scorecard_schools.json"
        )
        records = list(adapter.normalize(adapter.fetch_raw()))
        self.assertEqual(records[0].slug, "texas-a-m-university-college-station")
        self.assertEqual(records[1].state, "TX")

    def test_professor_matching(self):
        match, score = best_professor_match(
            "Priya Venkataraman",
            ["Priya Venkataraman", "Daniel Park"],
        )
        self.assertEqual(match, "Priya Venkataraman")
        self.assertGreater(score, 0.95)

    def test_rmp_adapter_normalizes_tags_and_id(self):
        payload = {
            "data": {
                "newSearch": {
                    "teachers": {
                        "edges": [
                            {
                                "node": {
                                    "id": "teacher-123",
                                    "legacyId": "321",
                                    "firstName": "Priya",
                                    "lastName": "Venkataraman",
                                    "avgRating": 4.8,
                                    "avgDifficulty": 2.1,
                                    "numRatings": 84,
                                    "school": {"slug": "ut-austin"},
                                    "teacherRatingTags": [
                                        {"tagName": "Clear grading", "tagCount": 14},
                                        {"tagName": "Tough exams", "tagCount": 6},
                                    ],
                                }
                            }
                        ]
                    }
                }
            }
        }

        records = list(RMPRatingAdapter(payload).normalize(payload))
        self.assertEqual(records[0].rmp_id, "321")
        self.assertEqual(records[0].tags, ("Clear grading", "Tough exams"))

    def test_live_rmp_fixture_passthrough(self):
        payload = {
            "data": {
                "newSearch": {
                    "teachers": {
                        "edges": [
                            {
                                "node": {
                                    "id": "teacher-999",
                                    "firstName": "Riley",
                                    "lastName": "Brooks",
                                    "avgRating": 4.2,
                                    "avgDifficulty": 3.1,
                                    "numRatings": 42,
                                    "school": {"slug": "ohio-state"},
                                    "teacherRatingTags": [{"tagName": "Helpful examples"}],
                                }
                            }
                        ],
                        "pageInfo": {"hasNextPage": False, "endCursor": None},
                    }
                }
            }
        }
        with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as handle:
            handle.write(json.dumps(payload))
            fixture_path = Path(handle.name)

        try:
            adapter = LiveRMPGraphQLAdapter(
                school_slug="ohio-state",
                endpoint="https://example.com/graphql",
                fixture_path=fixture_path,
            )
            records = list(adapter.normalize(adapter.fetch_raw()))
            self.assertEqual(records[0].school_slug, "ohio-state")
            self.assertEqual(records[0].review_count, 42)
        finally:
            fixture_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
