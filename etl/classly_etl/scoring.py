from typing import Optional


def true_difficulty(
    avg_gpa: Optional[float],
    a_pct: Optional[float],
    rmp_difficulty: Optional[float],
    rmp_rating: Optional[float],
) -> Optional[float]:
    weighted = []

    if avg_gpa is not None:
        weighted.append((avg_gpa / 4.0, 0.35))
    if a_pct is not None:
        weighted.append((a_pct / 100.0, 0.35))
    if rmp_difficulty is not None:
        weighted.append((1 - (rmp_difficulty / 5.0), 0.20))
    if rmp_rating is not None:
        weighted.append((rmp_rating / 5.0, 0.10))

    if not weighted:
        return None

    total_weight = sum(weight for _, weight in weighted)
    score = sum(value * (weight / total_weight) for value, weight in weighted)
    return round(score, 4)
