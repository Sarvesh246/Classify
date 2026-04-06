from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup
from requests import HTTPError

from etl.classly_etl.adapters.base import SourceAdapter


COURSE_CODE_RE = re.compile(r"([A-Z]{2,5})\s*(\d{3}[A-Z]?)")


def normalize_tamu_catalog_code(code: str) -> str:
    return re.sub(r"\s+", " ", code.strip().upper())


def extract_course_codes(title_text: str) -> list[str]:
    seen: list[str] = []
    for subject, number in COURSE_CODE_RE.findall(title_text.replace("\xa0", " ")):
        code = f"{subject} {number}"
        if code not in seen:
            seen.append(code)
    return seen


def strip_course_codes_from_title(title_text: str) -> str:
    normalized = title_text.replace("\xa0", " ")
    names_only = COURSE_CODE_RE.sub("", normalized)
    names_only = re.sub(r"\s*/\s*", " ", names_only)
    names_only = re.sub(r"\s{2,}", " ", names_only)
    return names_only.strip(" -")


class TAMUCourseCatalogAdapter(SourceAdapter):
    key = "tamu_course_catalog"
    base_url = "https://catalog.tamu.edu/undergraduate/course-descriptions/{subject}/"

    def __init__(
        self,
        *,
        subject_prefixes: list[str],
        fixture_dir: Path | None = None,
        pause_seconds: float = 0.2,
        timeout_seconds: int = 30,
    ):
        self.subject_prefixes = [prefix.strip().lower() for prefix in subject_prefixes if prefix.strip()]
        self.fixture_dir = fixture_dir
        self.pause_seconds = pause_seconds
        self.timeout_seconds = timeout_seconds

    def fetch_raw(self):
        payload: dict[str, str] = {}
        for index, subject in enumerate(self.subject_prefixes):
            if self.fixture_dir is not None:
                fixture_path = self.fixture_dir / f"{subject}.html"
                if not fixture_path.is_file():
                    continue
                payload[subject] = fixture_path.read_text(encoding="utf-8")
            else:
                try:
                    response = requests.get(
                        self.base_url.format(subject=subject),
                        timeout=self.timeout_seconds,
                    )
                    response.raise_for_status()
                except HTTPError as exc:
                    if exc.response is not None and exc.response.status_code == 404:
                        continue
                    raise
                payload[subject] = response.text
                if index + 1 < len(self.subject_prefixes) and self.pause_seconds > 0:
                    time.sleep(self.pause_seconds)
        return payload

    def normalize(self, payload) -> Iterable[dict]:
        for subject, html in payload.items():
            soup = BeautifulSoup(html, "html.parser")
            for block in soup.select(".courseblock"):
                title = block.select_one(".courseblocktitle")
                desc = block.select_one(".courseblockdesc")
                if title is None:
                    continue

                title_text = title.get_text(" ", strip=True)
                course_codes = extract_course_codes(title_text)
                course_name = strip_course_codes_from_title(title_text)
                if not course_codes or not course_name:
                    continue

                description = desc.get_text(" ", strip=True) if desc else ""
                source_url = self.base_url.format(subject=subject)

                for code in course_codes:
                    yield {
                        "course_code": normalize_tamu_catalog_code(code),
                        "course_name": course_name,
                        "description": description,
                        "subject_prefix": subject.upper(),
                        "source_url": source_url,
                    }


def load_tamu_course_catalog(path: str | Path) -> dict[str, dict]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(payload, list):
        out: dict[str, dict] = {}
        for row in payload:
            code = normalize_tamu_catalog_code(str(row.get("course_code") or ""))
            if not code:
                continue
            out[code] = row
        return out
    if isinstance(payload, dict):
        return {
            normalize_tamu_catalog_code(str(code)): value
            for code, value in payload.items()
            if str(code).strip()
        }
    raise ValueError(f"Unsupported TAMU course catalog payload shape in {path}")
