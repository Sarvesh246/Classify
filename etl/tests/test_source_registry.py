import json
import tempfile
import unittest
from pathlib import Path

from etl.classly_etl.source_registry import (
    build_school_source_registry,
    is_university_scope_school,
)


class SourceRegistryTests(unittest.TestCase):
    def test_university_scope_excludes_community_colleges(self):
        self.assertFalse(is_university_scope_school("Austin Community College District"))
        self.assertTrue(is_university_scope_school("University of Texas at Austin"))

    def test_build_school_source_registry_uses_published_and_rmp_signals(self):
        directory_rows = [
            {
                "school_id": 1,
                "slug": "ut-austin",
                "name": "The University of Texas at Austin",
                "alias": "UT Austin",
                "state": "TX",
                "control": "Public",
                "website": "https://utexas.edu",
                "student_size": 50000,
            },
            {
                "school_id": 2,
                "slug": "example-community-college",
                "name": "Example Community College",
                "alias": "ECC",
                "state": "TX",
                "control": "Public",
                "website": "https://example.edu",
                "student_size": 5000,
            },
        ]
        published_snapshot = {
            "schools": [
                {
                    "slug": "ut-austin",
                    "supportProfile": {
                        "plannerReadiness": "catalog_ready",
                        "hasCatalog": True,
                        "hasSections": False,
                        "hasInstructorDirectory": True,
                        "professorCoverageLevel": "stats_partial",
                        "hasOfficialGrades": True,
                        "hasRmp": True,
                    },
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "raw").mkdir(parents=True, exist_ok=True)
            (root / "matches").mkdir(parents=True, exist_ok=True)

            (root / "rmp_ut-austin.json").write_text(
                json.dumps(
                    [
                        {
                            "school_slug": "ut-austin",
                            "professor_name": "Priya Venkataraman",
                            "rating": 4.8,
                            "difficulty": 2.1,
                            "review_count": 84,
                        }
                    ]
                ),
                encoding="utf-8",
            )
            (root / "raw" / "rmp_ut-austin.json").write_text(
                json.dumps(
                    {
                        "pages": [
                            {
                                "data": {
                                    "newSearch": {
                                        "teachers": {
                                            "edges": [
                                                {
                                                    "node": {
                                                        "school": {"id": "19"}
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (root / "matches" / "ut-austin.json").write_text(
                json.dumps(
                    {
                        "summary": {
                            "autoLinkedCount": 5,
                            "reviewCount": 2,
                            "unmatchedCount": 1,
                            "pendingReviewCount": 2,
                        }
                    }
                ),
                encoding="utf-8",
            )

            registry = build_school_source_registry(
                directory_rows,
                published_snapshot=published_snapshot,
                output_root=root,
                overrides={
                    "example-community-college": {
                        "rmp_enabled": False,
                    }
                },
            )

        ut = next(item for item in registry if item["school_slug"] == "ut-austin")
        community = next(
            item for item in registry if item["school_slug"] == "example-community-college"
        )

        self.assertEqual(ut["published"]["professor_coverage_level"], "stats_partial")
        self.assertEqual(ut["sources"]["rmp"]["status"], "synced")
        self.assertEqual(ut["sources"]["rmp"]["school_legacy_id"], "19")
        self.assertEqual(ut["sources"]["rmp"]["record_count"], 1)
        self.assertEqual(ut["sources"]["rmp"]["auto_linked_count"], 5)

        self.assertFalse(community["university_scope"])
        self.assertEqual(community["sources"]["rmp"]["status"], "disabled")


if __name__ == "__main__":
    unittest.main()
