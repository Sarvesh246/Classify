import unittest

from etl.classly_etl.scoring import true_difficulty


class ScoringTests(unittest.TestCase):
    def test_full_signal_score(self):
        score = true_difficulty(3.6, 70, 2.0, 4.5)
        self.assertAlmostEqual(score, 0.77, places=2)

    def test_missing_signal_renormalizes(self):
        score = true_difficulty(None, None, 3.0, 4.0)
        self.assertAlmostEqual(score, 0.5333, places=3)


if __name__ == "__main__":
    unittest.main()
