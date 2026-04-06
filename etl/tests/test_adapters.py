import unittest
import json
import tempfile
from pathlib import Path

from etl.classly_etl.adapters.college_scorecard import (
    CollegeScorecardSchoolDirectoryAdapter,
)
from etl.classly_etl.adapters.public_json import PublicJsonAdapter
from etl.classly_etl.adapters.rmp import LiveRMPGraphQLAdapter, RMPRatingAdapter
from etl.classly_etl.adapters.tamu_catalog import (
    TAMUCourseCatalogAdapter,
    extract_course_codes,
    strip_course_codes_from_title,
)
from etl.classly_etl.adapters.tamu import TexasAMGradeDistributionAdapter
from etl.classly_etl.adapters.ut_austin import UTAustinTableauAdapter
from etl.classly_etl.matchers import (
    best_professor_match,
    build_match_audit_report,
    enrich_offerings_with_match_resolutions,
    resolve_professor_matches,
)
from etl.classly_etl.models import RMPRatingRecord
from etl.classly_etl.tamu_aggregate import aggregate_tamu_offerings


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
        self.assertEqual(len(records), 3)
        self.assertEqual(records[0].slug, "texas-a-m-university-college-station")
        self.assertEqual(records[1].state, "TX")
        self.assertEqual(records[2].slug, "university-of-michigan-ann-arbor")

    def test_professor_matching(self):
        match, score = best_professor_match(
            "Priya Venkataraman",
            ["Priya Venkataraman", "Daniel Park"],
        )
        self.assertEqual(match, "Priya Venkataraman")
        self.assertGreater(score, 0.95)

    def test_resolve_professor_matches_auto_links_exact_name(self):
        offerings = [
            {
                "schoolSlug": "ut-austin",
                "professorSlug": "priya-venkataraman",
                "professorName": "Priya Venkataraman",
                "department": "Mathematics",
                "courseCode": "M 408D",
                "coverageTier": "institutional_only",
                "sourceLabels": ["UT grade dashboard"],
                "matchConfidence": 100,
            }
        ]
        rmp_records = [
            RMPRatingRecord(
                school_slug="ut-austin",
                professor_name="Priya Venkataraman",
                rmp_id="321",
                rating=4.8,
                difficulty=2.1,
                review_count=84,
                tags=("Clear grading",),
            )
        ]

        resolutions, reviews = resolve_professor_matches(offerings, rmp_records)
        self.assertEqual(reviews, [])
        self.assertEqual(resolutions[0].status, "auto_linked")
        self.assertGreaterEqual(resolutions[0].confidence, 90)

        enriched = enrich_offerings_with_match_resolutions(offerings, resolutions)
        self.assertEqual(enriched[0]["coverageTier"], "institutional_plus_rmp")
        self.assertEqual(enriched[0]["rmpRating"], 4.8)
        self.assertIn("RMP GraphQL", enriched[0]["sourceLabels"])

    def test_resolve_professor_matches_queues_ambiguous_same_initial_surname(self):
        offerings = [
            {
                "schoolSlug": "texas-am",
                "professorSlug": "jacob-smith",
                "professorName": "Jacob Smith",
                "department": "Engineering",
                "courseCode": "ENGR 102",
                "coverageTier": "institutional_only",
                "sourceLabels": ["TAMU PDF"],
                "matchConfidence": 100,
            },
            {
                "schoolSlug": "texas-am",
                "professorSlug": "jordan-smith",
                "professorName": "Jordan Smith",
                "department": "Engineering",
                "courseCode": "ENGR 102",
                "coverageTier": "institutional_only",
                "sourceLabels": ["TAMU PDF"],
                "matchConfidence": 100,
            },
        ]
        rmp_records = [
            RMPRatingRecord(
                school_slug="texas-am",
                professor_name="Jason Smith",
                rmp_id="999",
                rating=4.1,
                difficulty=3.0,
                review_count=19,
            )
        ]

        resolutions, reviews = resolve_professor_matches(offerings, rmp_records)
        self.assertEqual(len(reviews), 1)
        self.assertIn("Smith", reviews[0].professor_name_raw)
        self.assertTrue(any(item.status == "review" for item in resolutions))

        audit = build_match_audit_report(resolutions, reviews, school_slug="texas-am")
        self.assertEqual(audit["pendingReviewCount"], 1)

    def test_auto_link_without_reviews_stays_institutional_only(self):
        offerings = [
            {
                "schoolSlug": "texas-am",
                "professorSlug": "alex-ramos",
                "professorName": "Alex Ramos",
                "department": "Engineering",
                "courseCode": "ENGR 102",
                "coverageTier": "institutional_only",
                "sourceLabels": ["TAMU PDF"],
                "matchConfidence": 100,
            }
        ]
        rmp_records = [
            RMPRatingRecord(
                school_slug="texas-am",
                professor_name="Alex Ramos",
                rmp_id="444",
                rating=0,
                difficulty=0,
                review_count=0,
                tags=(),
            )
        ]

        resolutions, _ = resolve_professor_matches(offerings, rmp_records)
        self.assertEqual(resolutions[0].status, "auto_linked")

        enriched = enrich_offerings_with_match_resolutions(offerings, resolutions)
        self.assertEqual(enriched[0]["coverageTier"], "institutional_only")
        self.assertEqual(enriched[0]["rmpRating"], None)
        self.assertEqual(enriched[0]["rmpDifficulty"], None)
        self.assertEqual(enriched[0]["tags"], [])
        self.assertNotIn("RMP GraphQL", enriched[0]["sourceLabels"])

    def test_resolve_professor_matches_leaves_unmatched_identity_when_no_rmp_candidate(self):
        offerings = [
            {
                "schoolSlug": "texas-am",
                "professorSlug": "a-cahill",
                "professorName": "A. Cahill",
                "department": "Engineering",
                "courseCode": "ENGR 102",
                "coverageTier": "institutional_plus_rmp",
                "sourceLabels": ["TAMU PDF", "Rate My Professors"],
                "matchConfidence": 88,
                "rmpRating": 4.3,
                "rmpDifficulty": 2.1,
                "tags": ["Clear grading"],
            }
        ]
        rmp_records = [
            RMPRatingRecord(
                school_slug="texas-am",
                professor_name="Morgan Blake",
                rmp_id="123",
                rating=4.0,
                difficulty=2.7,
                review_count=11,
            )
        ]

        resolutions, reviews = resolve_professor_matches(offerings, rmp_records)
        self.assertEqual(reviews, [])
        self.assertEqual(resolutions[0].status, "unmatched")
        self.assertEqual(resolutions[0].confidence, 100.0)

        enriched = enrich_offerings_with_match_resolutions(offerings, resolutions)
        self.assertEqual(enriched[0]["coverageTier"], "institutional_only")
        self.assertEqual(enriched[0]["rmpRating"], None)
        self.assertEqual(enriched[0]["rmpDifficulty"], None)
        self.assertEqual(enriched[0]["tags"], [])
        self.assertNotIn("Rate My Professors", enriched[0]["sourceLabels"])

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

    def test_tamu_catalog_title_parser(self):
        self.assertEqual(
            extract_course_codes("CSCE 222/ECEN 222 Discrete Structures for Computing"),
            ["CSCE 222", "ECEN 222"],
        )
        self.assertEqual(
            strip_course_codes_from_title("CSCE 222/ECEN 222 Discrete Structures for Computing"),
            "Discrete Structures for Computing",
        )

    def test_tamu_catalog_adapter_normalizes_course_blocks(self):
        html = """
        <div class="courseblock">
          <h2 class="courseblocktitle">CSCE 221 Data Structures and Algorithms</h2>
          <p class="courseblockdesc">Credits 4. Study of data structures.</p>
        </div>
        <div class="courseblock">
          <h2 class="courseblocktitle">CSCE 222/ECEN 222 Discrete Structures for Computing</h2>
          <p class="courseblockdesc">Credits 3. Discrete math foundations.</p>
        </div>
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            fixture_dir = Path(tmpdir)
            (fixture_dir / "csce.html").write_text(html, encoding="utf-8")
            adapter = TAMUCourseCatalogAdapter(
                subject_prefixes=["CSCE"],
                fixture_dir=fixture_dir,
            )
            records = list(adapter.normalize(adapter.fetch_raw()))

        self.assertEqual(records[0]["course_code"], "CSCE 221")
        self.assertEqual(records[0]["course_name"], "Data Structures and Algorithms")
        self.assertEqual(records[1]["course_code"], "CSCE 222")
        self.assertEqual(records[2]["course_code"], "ECEN 222")

    def test_tamu_aggregate_uses_catalog_course_names(self):
        adapter = TexasAMGradeDistributionAdapter(
            year=2025,
            term_code="C",
            college_code="EN",
            fixture_path=FIXTURES / "tamu_grade_report_excerpt.txt",
        )
        records = list(adapter.normalize(adapter.fetch_raw()))
        offerings = aggregate_tamu_offerings(
            records,
            course_catalog={
                "AERO 201": {
                    "course_name": "Aerospace Engineering Lab",
                    "description": "Official catalog description.",
                }
            },
        )
        aero = next(item for item in offerings if item["courseCode"] == "AERO 201")
        self.assertEqual(aero["courseName"], "Aerospace Engineering Lab")
        self.assertEqual(aero["courseSummary"], "Official catalog description.")


if __name__ == "__main__":
    unittest.main()
