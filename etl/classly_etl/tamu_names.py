"""
Normalize Texas A&M registrar instructor strings to a consistent display form.

Reports typically use ALL CAPS and either:
  - FAMILY GIVEN_INITIAL (e.g. BHARGAVA D, VAN POPPEL B)
  - GIVEN_INITIAL FAMILY (e.g. W CHU)
  - FAMILY, GIVEN (optional comma form)
"""

from __future__ import annotations

import re
from typing import Tuple

_NAME_TOKEN = re.compile(r"^[A-Z][A-Z'\-]*$")


def _title_word(word: str) -> str:
    lowered = word.lower()
    if lowered.startswith("mc") and len(word) > 2:
        return "Mc" + _title_word(word[2:])
    if lowered.startswith("mac") and len(word) > 3:
        return "Mac" + _title_word(word[3:])
    if "'" in word:
        return "'".join(part.capitalize() for part in word.split("'"))
    if "-" in word:
        return "-".join(part.capitalize() for part in word.split("-"))
    return word.capitalize()


def _title_parts(tokens: list[str]) -> str:
    return " ".join(_title_word(t) for t in tokens if t)


def slug_key(value: str) -> str:
    s = value.lower().strip().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "unknown"


def normalize_tamu_instructor(raw: str | None) -> Tuple[str, str]:
    """
    Return (display_name, canonical_key).

    Display format: given-initial(s) then family — e.g. "D. Bhargava", "B. Van Poppel", "W. Chu".
    canonical_key groups equivalent raw strings (CHU W vs W CHU).
    """
    if raw is None or not str(raw).strip():
        return "Unknown instructor", "unknown"

    s = " ".join(str(raw).strip().split())

    if "," in s:
        left, right = [p.strip() for p in s.split(",", 1)]
        family_tokens = left.split()
        given_tokens = right.split()
        family = _title_parts(family_tokens)
        if not given_tokens:
            return family or s.title(), slug_key(left)
        g0 = given_tokens[0]
        if len(given_tokens) == 1 and len(g0) <= 2 and g0.isalpha():
            initials = g0.upper()
            display = f"{initials[0]}. {family}" if len(initials) == 1 else f"{initials[0]}.{initials[1]}. {family}"
            canon = slug_key(f"{'-'.join(family_tokens)}-{initials}")
            return display, canon
        given = _title_parts(given_tokens)
        display = f"{given} {family}"
        canon = slug_key(f"{'-'.join(family_tokens)}-{'-'.join(given_tokens)}")
        return display, canon

    tokens = s.split()
    if len(tokens) == 1:
        return _title_parts(tokens), slug_key(tokens[0])

    last = tokens[-1]
    first = tokens[0]

    def looks_like_name_parts(parts: list[str]) -> bool:
        return bool(parts) and all(_NAME_TOKEN.fullmatch(p) for p in parts)

    # FAMILY ... INITIAL(S) — last token is 1–2 letters, earlier tokens are LAST name parts
    if (
        len(last) <= 2
        and last.isalpha()
        and last.isupper()
        and looks_like_name_parts(tokens[:-1])
    ):
        family_raw = tokens[:-1]
        initials = last
        family = _title_parts(family_raw)
        if len(initials) == 1:
            display = f"{initials[0]}. {family}"
        else:
            display = f"{initials[0]}.{initials[1]}. {family}"
        canon = slug_key(f"{'-'.join(family_raw)}-{initials}")
        return display, canon

    # INITIAL(S) FAMILY — first token 1–2 letters, rest is surname phrase
    if (
        len(first) <= 2
        and first.isalpha()
        and first.isupper()
        and looks_like_name_parts(tokens[1:])
    ):
        rest_raw = tokens[1:]
        family = _title_parts(rest_raw)
        if len(first) == 1:
            display = f"{first[0]}. {family}"
        else:
            display = f"{first[0]}.{first[1]}. {family}"
        canon = slug_key(f"{'-'.join(rest_raw)}-{first}")
        return display, canon

    # Fallback: title-case tokens
    display = _title_parts(tokens)
    return display, slug_key(s)
