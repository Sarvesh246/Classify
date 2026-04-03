import csv
import io
import re
from collections import defaultdict
from typing import Iterable

from etl.classly_etl.models import GradeDistributionRecord

UT_GRADE_POINTS = {
    "A": 4.0,
    "A-": 3.7,
    "B+": 3.3,
    "B": 3.0,
    "B-": 2.7,
    "C+": 2.3,
    "C": 2.0,
    "C-": 1.7,
    "D+": 1.3,
    "D": 1.0,
    "D-": 0.7,
    "F": 0.0,
}

TAMU_ROW_RE = re.compile(r"^([A-Z&]+-\d+[A-Z]?-?\d*-\d{3,4})\s+(\d+)$")
TAMU_SUMMARY_RE = re.compile(
    r"^(\d+)\s+([0-4]\.\d{3})\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)\s+(.+)$"
)


def slugify_school_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return re.sub(r"-{2,}", "-", normalized)


def format_tamu_term(year: int, term_code: str) -> str:
    labels = {"A": "Spring", "B": "Summer", "C": "Fall"}
    return f"{labels[term_code]} {year}"


def parse_ut_austin_dashboard_csv(csv_text: str) -> Iterable[GradeDistributionRecord]:
    grouped: dict[tuple[str, str, str, str, str], dict[str, object]] = {}
    reader = csv.DictReader(io.StringIO(csv_text))

    for row in reader:
      key = (
          row["Course Prefix"].strip(),
          row["Course Number"].strip(),
          row["Course Title"].strip(),
          row["Section Number"].strip(),
          row["Semester"].strip(),
      )
      bucket = grouped.setdefault(
          key,
          {
              "counts": defaultdict(int),
              "department": row["Department/Program"].strip(),
          },
      )
      letter_grade = row["Letter Grade"].strip()
      bucket["counts"][letter_grade] += int(row["Count of letter grade"])

    for (prefix, number, title, section_number, term), bucket in grouped.items():
      counts = bucket["counts"]
      sample_size = sum(
          count for grade, count in counts.items() if grade in UT_GRADE_POINTS
      )
      weighted = sum(
          UT_GRADE_POINTS[grade] * count
          for grade, count in counts.items()
          if grade in UT_GRADE_POINTS
      )
      avg_gpa = round(weighted / sample_size, 3) if sample_size else None
      a_pct = round(counts["A"] / sample_size * 100, 1) if sample_size else None
      yield GradeDistributionRecord(
          school_slug="ut-austin",
          course_code=f"{prefix} {number}",
          course_name=title,
          professor_name=None,
          term=term,
          avg_gpa=avg_gpa,
          a_pct=a_pct,
          sample_size=sample_size,
          source_key="ut_austin_tableau_csv",
          section_number=section_number,
          department=str(bucket["department"]),
          source_url=(
              "https://iq-analytics.austin.utexas.edu/views/"
              "Gradedistributiondashboard/Externaldashboard-Crosstab.csv?:showVizHome=no"
          ),
      )


def _next_nonempty(lines: list[str], start_index: int) -> str | None:
    for index in range(start_index, len(lines)):
      candidate = lines[index].strip()
      if candidate:
          return candidate
    return None


def parse_tamu_grade_report_text(
    report_text: str,
    *,
    year: int,
    term_code: str,
    college_code: str,
) -> Iterable[GradeDistributionRecord]:
    lines = [line.rstrip() for line in report_text.splitlines()]
    current_college = None
    current_department = None
    index = 0

    while index < len(lines):
      line = lines[index].strip()

      if line == "DEPARTMENT:":
          current_college = _next_nonempty(lines, index + 1)
          current_department = _next_nonempty(lines, index + 2)
      else:
          match = TAMU_ROW_RE.match(line)
          if match and not line.startswith("COURSE TOTAL"):
              section_token = match.group(1)
              counts = [int(match.group(2))]
              cursor = index + 1

              while cursor < len(lines) and len(counts) < 5:
                  candidate = lines[cursor].strip()
                  if not candidate or candidate.endswith("%"):
                      cursor += 1
                      continue
                  if re.fullmatch(r"\d+", candidate):
                      counts.append(int(candidate))
                  cursor += 1

              while cursor < len(lines):
                  summary_line = lines[cursor].strip()
                  summary = TAMU_SUMMARY_RE.match(summary_line)
                  if summary:
                      total_af = int(summary.group(1))
                      avg_gpa = float(summary.group(2))
                      instructor = summary.group(4).strip()
                      course_parts = section_token.split("-")
                      yield GradeDistributionRecord(
                          school_slug="texas-am",
                          course_code=f"{course_parts[0]} {course_parts[1]}",
                          course_name=f"{course_parts[0]} {course_parts[1]}",
                          professor_name=instructor,
                          term=format_tamu_term(year, term_code),
                          avg_gpa=avg_gpa,
                          a_pct=round(counts[0] / total_af * 100, 1) if total_af else None,
                          sample_size=total_af,
                          source_key="tamu_grade_report_pdf",
                          section_number=course_parts[-1],
                          department=current_department,
                          source_url=(
                              "https://web-as.tamu.edu/gradereports/Default.aspx"
                              f"?college={college_code}&year={year}&term={term_code}"
                          ),
                      )
                      index = cursor
                      break
                  cursor += 1

      index += 1
