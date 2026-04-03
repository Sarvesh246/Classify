from pathlib import Path
from io import BytesIO
from typing import Iterable

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

from etl.classly_etl.adapters.base import SourceAdapter
from etl.classly_etl.models import GradeDistributionRecord
from etl.classly_etl.parsers import parse_tamu_grade_report_text


class TexasAMGradeDistributionAdapter(SourceAdapter):
    key = "tamu_grade_report_pdf"
    report_url = "https://web-as.tamu.edu/gradereports/Default.aspx"

    def __init__(
        self,
        *,
        year: int,
        term_code: str = "C",
        college_code: str = "EN",
        fixture_path: Path | None = None,
    ):
        self.year = year
        self.term_code = term_code
        self.college_code = college_code
        self.fixture_path = fixture_path

    def fetch_raw(self):
        if self.fixture_path is not None:
            if self.fixture_path.suffix.lower() == ".txt":
                return self.fixture_path.read_text()
            return self.fixture_path.read_bytes()

        session = requests.Session()
        page = session.get(self.report_url, timeout=60)
        page.raise_for_status()
        soup = BeautifulSoup(page.text, "html.parser")

        fields = {
            name: soup.select_one(f'input[name="{name}"]')["value"]
            for name in ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]
        }
        fields.update(
            {
                "ctl00$plcMain$lstGradYear": str(self.year),
                "ctl00$plcMain$lstGradTerm": self.term_code,
                "ctl00$plcMain$lstGradCollege": self.college_code,
                "ctl00$plcMain$btnGrade": "Grade Distribution",
                "ctl00$plcMain$Type": "Grad",
            }
        )

        response = session.post(self.report_url, data=fields, timeout=60)
        response.raise_for_status()
        return response.content

    def normalize(self, payload) -> Iterable[GradeDistributionRecord]:
        if isinstance(payload, str):
            report_text = payload
        else:
            reader = (
                PdfReader(BytesIO(payload))
                if isinstance(payload, bytes)
                else PdfReader(str(payload))
            )
            report_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        yield from parse_tamu_grade_report_text(
            report_text,
            year=self.year,
            term_code=self.term_code,
            college_code=self.college_code,
        )
