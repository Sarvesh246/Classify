from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GradeDistributionRecord:
    school_slug: str
    course_code: str
    course_name: str
    professor_name: Optional[str]
    term: str
    avg_gpa: Optional[float]
    a_pct: Optional[float]
    sample_size: int
    source_key: str
    section_number: Optional[str] = None
    department: Optional[str] = None
    source_url: Optional[str] = None


@dataclass(frozen=True)
class SchoolDirectoryRecord:
    school_id: int
    slug: str
    name: str
    alias: Optional[str]
    city: str
    state: str
    website: Optional[str]
    control: Optional[str]
    student_size: Optional[int]


@dataclass(frozen=True)
class RMPRatingRecord:
    school_slug: str
    professor_name: str
    rmp_id: Optional[str]
    rating: Optional[float]
    difficulty: Optional[float]
    review_count: int
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class DepartmentAggregateRecord:
    school_slug: str
    department_slug: str
    department_name: str
    avg_classify_score: Optional[float]
    avg_expected_gpa: Optional[float]
    avg_a_rate: Optional[float]
    professor_count: int
    course_count: int
    sample_size: int


@dataclass(frozen=True)
class PublishedGradeDistributionRecord:
    school_slug: str
    course_code: str
    professor_name: Optional[str]
    term: str
    sample_size: int
    avg_gpa: Optional[float]
    source_label: Optional[str]
    estimated: bool
    a_count: int
    b_count: int
    c_count: int
    d_count: int
    f_count: int
