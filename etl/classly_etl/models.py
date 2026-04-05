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
    department: Optional[str] = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProfessorIdentityRecord:
    school_slug: str
    professor_slug: str
    professor_name: str
    normalized_name: str
    surname: str
    first_token: str
    first_initial: str
    departments: tuple[str, ...] = ()
    course_prefixes: tuple[str, ...] = ()
    unique_surname: bool = False
    unique_initial_surname: bool = False


@dataclass(frozen=True)
class ProfessorMatchCandidate:
    school_slug: str
    professor_slug: str
    professor_name: str
    rmp_id: Optional[str]
    rmp_professor_name: str
    confidence: float
    margin_to_runner_up: float
    reasons: tuple[str, ...] = ()
    structural_hint: bool = False
    review_count: int = 0
    rating: Optional[float] = None
    difficulty: Optional[float] = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProfessorMatchResolution:
    school_slug: str
    professor_slug: str
    professor_name: str
    status: str
    confidence: float
    reason: str
    margin_to_runner_up: float = 0.0
    rmp_id: Optional[str] = None
    rmp_professor_name: Optional[str] = None
    rating: Optional[float] = None
    difficulty: Optional[float] = None
    review_count: int = 0
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProfessorMatchReviewRecord:
    school_slug: str
    professor_name_raw: str
    rmp_id: Optional[str]
    proposed_professor_slug: Optional[str]
    proposed_professor_name: Optional[str]
    confidence: float
    status: str
    notes: str
    runner_up_professor_slug: Optional[str] = None
    runner_up_professor_name: Optional[str] = None
    runner_up_confidence: Optional[float] = None


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


@dataclass(frozen=True)
class CatalogRecord:
    school_slug: str
    course_slug: str
    course_code: str
    course_name: str
    department: Optional[str]
    summary: Optional[str] = None


@dataclass(frozen=True)
class SectionMeetingRecord:
    section_id: str
    school_slug: str
    course_slug: str
    term: str
    days: tuple[str, ...] = ()
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    instructor_name: Optional[str] = None
    source_key: Optional[str] = None


@dataclass(frozen=True)
class EvidenceProfile:
    source_kinds: tuple[str, ...]
    confidence_label: str
    has_official_grades: bool
    has_schedule_data: bool
    has_rmp: bool
    has_community_evidence: bool
    has_syllabus_evidence: bool


@dataclass(frozen=True)
class SectionRecord:
    section_id: str
    school_slug: str
    course_slug: str
    course_code: str
    course_name: str
    professor_slug: Optional[str]
    professor_name: Optional[str]
    term: str
    ranking_mode: str
    evidence_profile: EvidenceProfile
    days: tuple[str, ...] = ()
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    has_meeting_time: bool = False
    source_key: Optional[str] = None
    supporting_offering_id: Optional[str] = None


@dataclass(frozen=True)
class PublishedPlannerSchoolSnapshot:
    school_slug: str
    planner_readiness: str
    updated_at: str
    instructor_count: int
    course_count: int
