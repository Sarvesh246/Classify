import unittest

from etl.classly_etl.models import GradeDistributionRecord
from etl.classly_etl.tamu_aggregate import dedupe_same_term_sections


class TamuDedupeTests(unittest.TestCase):
    def test_merges_duplicate_sections_same_term_key(self):
        """Two PDF rows for the same instructor/course/dept/term merge to one logical row."""
        base = dict(
            school_slug="texas-am",
            course_code="CSCE 221",
            course_name="Data Structures",
            professor_name="DOE J",
            term="Fall 2025",
            avg_gpa=3.5,
            a_pct=0.4,
            sample_size=40,
            source_key="pdf",
            section_number="501",
            department="CSCE",
        )
        r1 = GradeDistributionRecord(**base)
        r2 = GradeDistributionRecord(**{**base, "section_number": "502", "sample_size": 10})
        merged = dedupe_same_term_sections([r1, r2])
        self.assertEqual(len(merged), 1)
        self.assertGreater(merged[0][0].sample_size, 40)


if __name__ == "__main__":
    unittest.main()
