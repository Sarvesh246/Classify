import unittest

from etl.classly_etl.tamu_names import normalize_tamu_instructor


class TamuNamesTests(unittest.TestCase):
    def test_family_initial(self):
        d, k = normalize_tamu_instructor("BHARGAVA D")
        self.assertEqual(d, "D. Bhargava")
        self.assertEqual(k, "bhargava-d")

    def test_multi_word_family_initial(self):
        d, k = normalize_tamu_instructor("VAN POPPEL B")
        self.assertEqual(d, "B. Van Poppel")
        self.assertEqual(k, "van-poppel-b")

    def test_initial_family_synonym(self):
        d1, k1 = normalize_tamu_instructor("CHU W")
        d2, k2 = normalize_tamu_instructor("W CHU")
        self.assertEqual(d1, "W. Chu")
        self.assertEqual(d2, "W. Chu")
        self.assertEqual(k1, k2)

    def test_fixture_prof(self):
        d, k = normalize_tamu_instructor("BHARGAVA D")
        self.assertIn("Bhargava", d)

    def test_comma_form(self):
        d, k = normalize_tamu_instructor("SMITH, J")
        self.assertEqual(d, "J. Smith")
        self.assertEqual(k, "smith-j")


if __name__ == "__main__":
    unittest.main()
