from difflib import SequenceMatcher
from typing import Iterable, Optional


def normalize_professor_name(name: str) -> str:
    return " ".join(name.lower().replace(".", "").split())


def best_professor_match(name: str, candidates: Iterable[str]) -> tuple[Optional[str], float]:
    normalized_name = normalize_professor_name(name)
    best_candidate = None
    best_score = 0.0

    for candidate in candidates:
      score = SequenceMatcher(None, normalized_name, normalize_professor_name(candidate)).ratio()
      if score > best_score:
          best_candidate = candidate
          best_score = score

    return best_candidate, round(best_score, 3)
