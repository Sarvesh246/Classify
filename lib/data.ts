import {
  type CourseGroup,
  type DataCompleteness,
  type ProfessorCourseSummary,
  type ProfessorDirectoryRow,
  type ProfessorProfile,
  type School,
  type SearchHit,
} from "@/lib/types";
import { enrichSummary } from "@/lib/scoring";

const schools: School[] = [
  {
    id: "ut",
    slug: "ut-austin",
    name: "The University of Texas at Austin",
    shortName: "UT Austin",
    city: "Austin",
    state: "TX",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["UT", "University of Texas", "Texas Austin"],
    directoryCount: 524,
    sourceStatus: {
      primary: "Official grade dashboard",
      fallback: "Rate My Professors",
      freshness: "Spring 2026",
      note: "Tableau-backed section history normalized per term.",
    },
    descriptor: "Launch school with full course intelligence.",
    programs: ["Computer Science", "Mathematics", "Economics"],
  },
  {
    id: "gt",
    slug: "georgia-tech",
    name: "Georgia Institute of Technology",
    shortName: "Georgia Tech",
    city: "Atlanta",
    state: "GA",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["GT", "Georgia Institute", "Georgia Tech"],
    directoryCount: 401,
    sourceStatus: {
      primary: "Institutional export adapter",
      fallback: "Rate My Professors",
      freshness: "Spring 2026",
      note: "Structured term snapshots support trend views.",
    },
    descriptor: "Engineering-heavy school with enough history to show difficulty shifts.",
    programs: ["Computing", "Math", "Engineering"],
  },
  {
    id: "wisc",
    slug: "uw-madison",
    name: "University of Wisconsin-Madison",
    shortName: "UW-Madison",
    city: "Madison",
    state: "WI",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["Wisconsin", "UW Madison", "Madison"],
    directoryCount: 448,
    sourceStatus: {
      primary: "Public data extract",
      fallback: "Rate My Professors",
      freshness: "Spring 2026",
      note: "High-volume intro courses have section history first.",
    },
    descriptor: "Wide-enrollment economics and stats coverage with trends.",
    programs: ["Economics", "Data Science", "Statistics"],
  },
  {
    id: "berkeley",
    slug: "uc-berkeley",
    name: "University of California, Berkeley",
    shortName: "UC Berkeley",
    city: "Berkeley",
    state: "CA",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["Berkeley", "Cal"],
    directoryCount: 392,
    sourceStatus: {
      primary: "Academic analytics export",
      fallback: "Rate My Professors",
      freshness: "Spring 2026",
      note: "Historical distributions are available for gateway courses.",
    },
    descriptor: "Data science flagship view with strong trend contrast.",
    programs: ["Data Science", "Statistics", "Economics"],
  },
  {
    id: "tamu",
    slug: "texas-am",
    name: "Texas A&M University",
    shortName: "Texas A&M",
    city: "College Station",
    state: "TX",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["TAMU", "Texas A&M", "A&M"],
    directoryCount: 468,
    sourceStatus: {
      primary: "Official registrar grade distribution PDFs",
      fallback: "Rate My Professors",
      freshness: "Fall 2025 and Fall 2024",
      note: "Engineering coverage is now seeded from official registrar grade-report PDFs with instructor lines and section-level counts.",
    },
    descriptor: "Native Texas A&M engineering coverage sourced from official registrar reports.",
    programs: ["Engineering", "Computer Science", "Aerospace Engineering"],
  },
  {
    id: "uiuc",
    slug: "uiuc",
    name: "University of Illinois Urbana-Champaign",
    shortName: "UIUC",
    city: "Urbana-Champaign",
    state: "IL",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: ["Illinois", "U of I"],
    directoryCount: 418,
    sourceStatus: {
      primary: "School directory only",
      fallback: "Rate My Professors",
      freshness: "RMP snapshot",
      note: "Institutional grade parsing is still pending.",
    },
    descriptor: "Searchable now with transparent fallback labeling.",
    programs: ["Computer Science", "Math", "Physics"],
  },
  {
    id: "osu",
    slug: "ohio-state",
    name: "The Ohio State University",
    shortName: "Ohio State",
    city: "Columbus",
    state: "OH",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: ["OSU", "Ohio State"],
    directoryCount: 512,
    sourceStatus: {
      primary: "School directory only",
      fallback: "Rate My Professors",
      freshness: "RMP snapshot",
      note: "Full course intelligence lands once grade feeds are normalized.",
    },
    descriptor: "Fallback-only campus that still supports search and compare.",
    programs: ["Computer Science", "Finance", "Statistics"],
  },
  {
    id: "unc",
    slug: "unc-chapel-hill",
    name: "University of North Carolina at Chapel Hill",
    shortName: "UNC",
    city: "Chapel Hill",
    state: "NC",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: ["UNC", "Carolina"],
    directoryCount: 366,
    sourceStatus: {
      primary: "School directory only",
      fallback: "Rate My Professors",
      freshness: "RMP snapshot",
      note: "Trend history is unavailable until institutional data is parsed.",
    },
    descriptor: "Represents the nationwide fallback footprint.",
    programs: ["Statistics", "Business", "Computer Science"],
  },
  {
    id: "uw",
    slug: "university-of-washington",
    name: "University of Washington",
    shortName: "University of Washington",
    city: "Seattle",
    state: "WA",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: ["UW", "Washington Seattle"],
    directoryCount: 389,
    sourceStatus: {
      primary: "School directory only",
      fallback: "Rate My Professors",
      freshness: "RMP snapshot",
      note: "The school remains fully discoverable before grade ingestion.",
    },
    descriptor: "A live directory entry with transparent fallback mode.",
    programs: ["Computer Science", "Informatics", "Statistics"],
  },
];

const rawOfferings = [
  {
    id: "ut-m408d-priya-venkataraman",
    schoolSlug: "ut-austin",
    professorSlug: "priya-venkataraman",
    courseSlug: "m-408d-calculus-i",
    courseCode: "M 408D",
    courseName: "Calculus I",
    professorName: "Priya Venkataraman",
    department: "Mathematics",
    expectedGpa: 3.71,
    aRate: 76,
    rmpRating: 4.8,
    rmpDifficulty: 1.9,
    sampleSize: 208,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 6,
    matchConfidence: 96,
    tags: ["Clear reviews", "Predictable exams", "Fast pace"],
    summary: "The strongest seeded Calculus I profile.",
    professorTitle: "Senior Lecturer",
    professorSummary: "Fast, clear, and unusually stable across terms.",
    courseSummary: "Gateway calculus with enough section volume to compare instructors.",
    trend: [
      { term: "Fall 2023", avgGpa: 3.48, aPct: 67, rmpRating: 4.8, rmpDifficulty: 1.9 },
      { term: "Spring 2024", avgGpa: 3.55, aPct: 70, rmpRating: 4.8, rmpDifficulty: 1.9 },
      { term: "Fall 2024", avgGpa: 3.63, aPct: 73, rmpRating: 4.8, rmpDifficulty: 1.9 },
      { term: "Spring 2025", avgGpa: 3.68, aPct: 74, rmpRating: 4.8, rmpDifficulty: 1.9 },
      { term: "Fall 2025", avgGpa: 3.7, aPct: 75, rmpRating: 4.8, rmpDifficulty: 1.9 },
      { term: "Spring 2026", avgGpa: 3.71, aPct: 76, rmpRating: 4.8, rmpDifficulty: 1.9 },
    ],
  },
  {
    id: "ut-m408d-elena-ruiz",
    schoolSlug: "ut-austin",
    professorSlug: "elena-ruiz",
    courseSlug: "m-408d-calculus-i",
    courseCode: "M 408D",
    courseName: "Calculus I",
    professorName: "Elena Ruiz",
    department: "Mathematics",
    expectedGpa: 3.56,
    aRate: 68,
    rmpRating: 4.3,
    rmpDifficulty: 2.1,
    sampleSize: 194,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 6,
    matchConfidence: 95,
    tags: ["Fair grading", "Strong review sheets"],
    summary: "A dependable high-floor calculus option.",
    professorTitle: "Lecturer",
    professorSummary: "Structured lectures with consistently strong outcomes.",
    courseSummary: "Gateway calculus with enough section volume to compare instructors.",
    trend: [
      { term: "Fall 2023", avgGpa: 3.44, aPct: 64, rmpRating: 4.3, rmpDifficulty: 2.2 },
      { term: "Spring 2024", avgGpa: 3.48, aPct: 65, rmpRating: 4.3, rmpDifficulty: 2.2 },
      { term: "Fall 2024", avgGpa: 3.5, aPct: 66, rmpRating: 4.3, rmpDifficulty: 2.1 },
      { term: "Spring 2025", avgGpa: 3.53, aPct: 67, rmpRating: 4.3, rmpDifficulty: 2.1 },
      { term: "Fall 2025", avgGpa: 3.54, aPct: 68, rmpRating: 4.3, rmpDifficulty: 2.1 },
      { term: "Spring 2026", avgGpa: 3.56, aPct: 68, rmpRating: 4.3, rmpDifficulty: 2.1 },
    ],
  },
  {
    id: "ut-cs312-daniel-park",
    schoolSlug: "ut-austin",
    professorSlug: "daniel-park",
    courseSlug: "cs-312-intro-programming",
    courseCode: "CS 312",
    courseName: "Introduction to Programming",
    professorName: "Daniel Park",
    department: "Computer Science",
    expectedGpa: 3.34,
    aRate: 57,
    rmpRating: 4.5,
    rmpDifficulty: 2.8,
    sampleSize: 246,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 5,
    matchConfidence: 94,
    tags: ["Project-heavy", "Practical examples", "Helpful staff"],
    summary: "A CS gateway class with better outcomes than its reputation suggests.",
    professorTitle: "Associate Professor of Instruction",
    professorSummary: "High teaching quality with surprisingly manageable outcomes.",
    courseSummary: "Core CS gateway where section choice changes the distribution materially.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.18, aPct: 50, rmpRating: 4.4, rmpDifficulty: 2.9 },
      { term: "Spring 2025", avgGpa: 3.24, aPct: 53, rmpRating: 4.4, rmpDifficulty: 2.8 },
      { term: "Summer 2025", avgGpa: 3.3, aPct: 55, rmpRating: 4.5, rmpDifficulty: 2.8 },
      { term: "Fall 2025", avgGpa: 3.32, aPct: 56, rmpRating: 4.5, rmpDifficulty: 2.8 },
      { term: "Spring 2026", avgGpa: 3.34, aPct: 57, rmpRating: 4.5, rmpDifficulty: 2.8 },
    ],
  },
  {
    id: "ut-cs312-nia-thompson",
    schoolSlug: "ut-austin",
    professorSlug: "nia-thompson",
    courseSlug: "cs-312-intro-programming",
    courseCode: "CS 312",
    courseName: "Introduction to Programming",
    professorName: "Nia Thompson",
    department: "Computer Science",
    expectedGpa: 3.11,
    aRate: 46,
    rmpRating: 4,
    rmpDifficulty: 3.4,
    sampleSize: 188,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 5,
    matchConfidence: 91,
    tags: ["Hard projects", "Fast pace"],
    summary: "Good teaching, tougher outcomes.",
    professorTitle: "Assistant Professor",
    professorSummary: "Well-rated for rigor, but clearly harder on grade outcomes.",
    courseSummary: "Core CS gateway where section choice changes the distribution materially.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.22, aPct: 52, rmpRating: 4, rmpDifficulty: 3.2 },
      { term: "Spring 2025", avgGpa: 3.19, aPct: 50, rmpRating: 4, rmpDifficulty: 3.3 },
      { term: "Summer 2025", avgGpa: 3.15, aPct: 48, rmpRating: 4, rmpDifficulty: 3.3 },
      { term: "Fall 2025", avgGpa: 3.12, aPct: 47, rmpRating: 4, rmpDifficulty: 3.4 },
      { term: "Spring 2026", avgGpa: 3.11, aPct: 46, rmpRating: 4, rmpDifficulty: 3.4 },
    ],
  },
  {
    id: "gt-cs1331-jordan-banks",
    schoolSlug: "georgia-tech",
    professorSlug: "jordan-banks",
    courseSlug: "cs-1331-oo-programming",
    courseCode: "CS 1331",
    courseName: "Object-Oriented Programming",
    professorName: "Jordan Banks",
    department: "Computer Science",
    expectedGpa: 3.58,
    aRate: 63,
    rmpRating: 4.7,
    rmpDifficulty: 2.2,
    sampleSize: 202,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 6,
    matchConfidence: 95,
    tags: ["Helpful office hours", "Clear projects"],
    summary: "The strongest CS 1331 combination of quality and outcomes.",
    professorTitle: "Senior Lecturer",
    professorSummary: "A rigorous but controlled path through the Java gateway.",
    courseSummary: "A foundational computing class where grade distributions vary sharply.",
    trend: [
      { term: "Fall 2023", avgGpa: 3.39, aPct: 56, rmpRating: 4.7, rmpDifficulty: 2.3 },
      { term: "Spring 2024", avgGpa: 3.45, aPct: 58, rmpRating: 4.7, rmpDifficulty: 2.2 },
      { term: "Fall 2024", avgGpa: 3.48, aPct: 59, rmpRating: 4.7, rmpDifficulty: 2.2 },
      { term: "Spring 2025", avgGpa: 3.52, aPct: 60, rmpRating: 4.7, rmpDifficulty: 2.2 },
      { term: "Fall 2025", avgGpa: 3.55, aPct: 62, rmpRating: 4.7, rmpDifficulty: 2.2 },
      { term: "Spring 2026", avgGpa: 3.58, aPct: 63, rmpRating: 4.7, rmpDifficulty: 2.2 },
    ],
  },
  {
    id: "gt-math1554-sofia-patel",
    schoolSlug: "georgia-tech",
    professorSlug: "sofia-patel",
    courseSlug: "math-1554-linear-algebra",
    courseCode: "MATH 1554",
    courseName: "Linear Algebra",
    professorName: "Sofia Patel",
    department: "Mathematics",
    expectedGpa: 3.14,
    aRate: 42,
    rmpRating: 4.1,
    rmpDifficulty: 3.5,
    sampleSize: 214,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 6,
    matchConfidence: 92,
    tags: ["Intense homework", "Clear recitations"],
    summary: "A clean example of a class getting harder over time.",
    professorTitle: "Professor",
    professorSummary: "Steady RMP sentiment hides a worsening grade trend.",
    courseSummary: "A requirement where recent-term difficulty matters more than old anecdotes.",
    trend: [
      { term: "Fall 2023", avgGpa: 3.29, aPct: 48, rmpRating: 4, rmpDifficulty: 3.3 },
      { term: "Spring 2024", avgGpa: 3.24, aPct: 46, rmpRating: 4, rmpDifficulty: 3.4 },
      { term: "Fall 2024", avgGpa: 3.2, aPct: 44, rmpRating: 4.1, rmpDifficulty: 3.4 },
      { term: "Spring 2025", avgGpa: 3.18, aPct: 43, rmpRating: 4.1, rmpDifficulty: 3.5 },
      { term: "Fall 2025", avgGpa: 3.15, aPct: 42, rmpRating: 4.1, rmpDifficulty: 3.5 },
      { term: "Spring 2026", avgGpa: 3.14, aPct: 42, rmpRating: 4.1, rmpDifficulty: 3.5 },
    ],
  },
  {
    id: "wisc-econ101-leah-foster",
    schoolSlug: "uw-madison",
    professorSlug: "leah-foster",
    courseSlug: "econ-101-principles",
    courseCode: "ECON 101",
    courseName: "Principles of Microeconomics",
    professorName: "Leah Foster",
    department: "Economics",
    expectedGpa: 3.62,
    aRate: 70,
    rmpRating: 4.4,
    rmpDifficulty: 2.3,
    sampleSize: 271,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 6,
    matchConfidence: 95,
    tags: ["Clear pacing", "Practice-heavy"],
    summary: "A near-ideal intro econ pick.",
    professorTitle: "Teaching Faculty",
    professorSummary: "High marks from grade data and student ratings.",
    courseSummary: "A high-enrollment course where section selection is worth real GPA.",
    trend: [
      { term: "Fall 2023", avgGpa: 3.41, aPct: 62, rmpRating: 4.4, rmpDifficulty: 2.4 },
      { term: "Spring 2024", avgGpa: 3.48, aPct: 64, rmpRating: 4.4, rmpDifficulty: 2.4 },
      { term: "Fall 2024", avgGpa: 3.53, aPct: 66, rmpRating: 4.4, rmpDifficulty: 2.3 },
      { term: "Spring 2025", avgGpa: 3.56, aPct: 67, rmpRating: 4.4, rmpDifficulty: 2.3 },
      { term: "Fall 2025", avgGpa: 3.59, aPct: 69, rmpRating: 4.4, rmpDifficulty: 2.3 },
      { term: "Spring 2026", avgGpa: 3.62, aPct: 70, rmpRating: 4.4, rmpDifficulty: 2.3 },
    ],
  },
  {
    id: "berkeley-datac8-maya-goldberg",
    schoolSlug: "uc-berkeley",
    professorSlug: "maya-goldberg",
    courseSlug: "data-c8-foundations",
    courseCode: "DATA C8",
    courseName: "Foundations of Data Science",
    professorName: "Maya Goldberg",
    department: "Data Science",
    expectedGpa: 3.48,
    aRate: 60,
    rmpRating: 4.6,
    rmpDifficulty: 2.5,
    sampleSize: 324,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Spring 2026",
    termCount: 5,
    matchConfidence: 94,
    tags: ["Fair projects", "Excellent explanations"],
    summary: "A trendline that keeps moving in the right direction.",
    professorTitle: "Teaching Professor",
    professorSummary: "The class is getting more manageable rather than harder.",
    courseSummary: "Berkeley's high-volume data science gateway benefits from trend data.",
    trend: [
      { term: "Spring 2024", avgGpa: 3.29, aPct: 53, rmpRating: 4.5, rmpDifficulty: 2.6 },
      { term: "Summer 2024", avgGpa: 3.34, aPct: 55, rmpRating: 4.5, rmpDifficulty: 2.6 },
      { term: "Fall 2024", avgGpa: 3.39, aPct: 57, rmpRating: 4.6, rmpDifficulty: 2.5 },
      { term: "Fall 2025", avgGpa: 3.43, aPct: 58, rmpRating: 4.6, rmpDifficulty: 2.5 },
      { term: "Spring 2026", avgGpa: 3.48, aPct: 60, rmpRating: 4.6, rmpDifficulty: 2.5 },
    ],
  },
  {
    id: "tamu-engr102-cahill",
    schoolSlug: "texas-am",
    professorSlug: "a-cahill",
    courseSlug: "engr-102-engineering-lab-i-computation",
    courseCode: "ENGR 102",
    courseName: "Engineering Lab I - Computation",
    professorName: "A. Cahill",
    department: "Engineering",
    expectedGpa: 3.505,
    aRate: 61.2,
    rmpRating: 4.4,
    rmpDifficulty: 2.8,
    sampleSize: 162,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Fall 2025",
    termCount: 2,
    matchConfidence: 91,
    tags: ["Clear labs", "Improving outcomes", "Organized instruction"],
    summary: "One of the strongest native ENGR 102 options in the Texas A&M seed.",
    professorTitle: "Instructor",
    professorSummary: "Official TAMU grade reports show this ENGR 102 path getting easier over time instead of harder.",
    courseSummary: "A first-year engineering gateway where section choice meaningfully changes the grade distribution.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.35, aPct: 50.6, rmpRating: 4.4, rmpDifficulty: 2.9 },
      { term: "Fall 2025", avgGpa: 3.505, aPct: 61.2, rmpRating: 4.4, rmpDifficulty: 2.8 },
    ],
  },
  {
    id: "tamu-engr102-elms",
    schoolSlug: "texas-am",
    professorSlug: "r-elms",
    courseSlug: "engr-102-engineering-lab-i-computation",
    courseCode: "ENGR 102",
    courseName: "Engineering Lab I - Computation",
    professorName: "R. Elms",
    department: "Engineering",
    expectedGpa: 3.46,
    aRate: 61.3,
    rmpRating: 4.2,
    rmpDifficulty: 3.0,
    sampleSize: 322,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Fall 2025",
    termCount: 2,
    matchConfidence: 90,
    tags: ["Stable sections", "Strong floor", "Consistent grading"],
    summary: "A high-volume ENGR 102 option with steady, above-average outcomes.",
    professorTitle: "Instructor",
    professorSummary: "This is the steadier Texas A&M ENGR 102 path: large section volume with consistent grade results year to year.",
    courseSummary: "A first-year engineering gateway where section choice meaningfully changes the grade distribution.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.406, aPct: 57.6, rmpRating: 4.2, rmpDifficulty: 3.1 },
      { term: "Fall 2025", avgGpa: 3.46, aPct: 61.3, rmpRating: 4.2, rmpDifficulty: 3.0 },
    ],
  },
  {
    id: "tamu-engr102-spears",
    schoolSlug: "texas-am",
    professorSlug: "c-spears",
    courseSlug: "engr-102-engineering-lab-i-computation",
    courseCode: "ENGR 102",
    courseName: "Engineering Lab I - Computation",
    professorName: "C. Spears",
    department: "Engineering",
    expectedGpa: 3.238,
    aRate: 44.0,
    rmpRating: 3.9,
    rmpDifficulty: 3.5,
    sampleSize: 520,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Fall 2025",
    termCount: 2,
    matchConfidence: 88,
    tags: ["Tougher grading", "Heavy workload"],
    summary: "A useful contrast case inside the same TAMU gateway course.",
    professorTitle: "Instructor",
    professorSummary: "The quality signal is still decent, but the grade distribution is materially tougher than the best ENGR 102 alternatives.",
    courseSummary: "A first-year engineering gateway where section choice meaningfully changes the grade distribution.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.242, aPct: 47.2, rmpRating: 3.9, rmpDifficulty: 3.4 },
      { term: "Fall 2025", avgGpa: 3.238, aPct: 44.0, rmpRating: 3.9, rmpDifficulty: 3.5 },
    ],
  },
  {
    id: "tamu-csce222-lupoli",
    schoolSlug: "texas-am",
    professorSlug: "s-lupoli",
    courseSlug: "csce-222-discrete-structures-for-computing",
    courseCode: "CSCE 222",
    courseName: "Discrete Structures for Computing",
    professorName: "S. Lupoli",
    department: "Computer Science",
    expectedGpa: 3.854,
    aRate: 89.6,
    rmpRating: 4.6,
    rmpDifficulty: 2.3,
    sampleSize: 292,
    coverageTier: "institutional_plus_rmp" as const,
    latestTerm: "Fall 2025",
    termCount: 2,
    matchConfidence: 93,
    tags: ["Elite outcomes", "Clear explanations", "High confidence"],
    summary: "A standout TAMU CS profile with both native grade strength and a strong rating signal.",
    professorTitle: "Instructor",
    professorSummary: "Native grade reports make this one easy to recommend: unusually high GPA and A-rate in a core computing requirement.",
    courseSummary: "A required CS theory class that benefits from outcomes being shown at the professor-course level.",
    trend: [
      { term: "Fall 2024", avgGpa: 3.877, aPct: 89.8, rmpRating: 4.6, rmpDifficulty: 2.4 },
      { term: "Fall 2025", avgGpa: 3.854, aPct: 89.6, rmpRating: 4.6, rmpDifficulty: 2.3 },
    ],
  },
  {
    id: "uiuc-cs225-omar-hassan",
    schoolSlug: "uiuc",
    professorSlug: "omar-hassan",
    courseSlug: "cs-225-data-structures",
    courseCode: "CS 225",
    courseName: "Data Structures",
    professorName: "Omar Hassan",
    department: "Computer Science",
    expectedGpa: null,
    aRate: null,
    rmpRating: 4.6,
    rmpDifficulty: 3.1,
    sampleSize: 122,
    coverageTier: "rmp_only" as const,
    latestTerm: "RMP snapshot",
    termCount: 1,
    matchConfidence: 86,
    tags: ["Organized", "Readable slides"],
    summary: "A high-quality RMP fallback option.",
    professorTitle: "Clinical Assistant Professor",
    professorSummary: "Useful even before institutional grade data is online.",
    courseSummary: "Shows how the product stays useful at schools without distributions yet.",
    trend: [{ term: "RMP", avgGpa: null, aPct: null, rmpRating: 4.6, rmpDifficulty: 3.1 }],
  },
  {
    id: "osu-cse2221-riley-brooks",
    schoolSlug: "ohio-state",
    professorSlug: "riley-brooks",
    courseSlug: "cse-2221-software-i",
    courseCode: "CSE 2221",
    courseName: "Software I",
    professorName: "Riley Brooks",
    department: "Computer Science",
    expectedGpa: null,
    aRate: null,
    rmpRating: 4.3,
    rmpDifficulty: 3.2,
    sampleSize: 104,
    coverageTier: "rmp_only" as const,
    latestTerm: "RMP snapshot",
    termCount: 1,
    matchConfidence: 81,
    tags: ["Project-oriented", "Helpful examples"],
    summary: "Nationwide fallback coverage in a core CS sequence.",
    professorTitle: "Lecturer",
    professorSummary: "Search, compare, and confidence labeling still work here.",
    courseSummary: "Software I is discoverable even before official grade data is online.",
    trend: [{ term: "RMP", avgGpa: null, aPct: null, rmpRating: 4.3, rmpDifficulty: 3.2 }],
  },
  {
    id: "unc-stor155-claire-morgan",
    schoolSlug: "unc-chapel-hill",
    professorSlug: "claire-morgan",
    courseSlug: "stor-155-intro-statistics",
    courseCode: "STOR 155",
    courseName: "Introduction to Statistics",
    professorName: "Claire Morgan",
    department: "Statistics",
    expectedGpa: null,
    aRate: null,
    rmpRating: 4.5,
    rmpDifficulty: 2.7,
    sampleSize: 118,
    coverageTier: "rmp_only" as const,
    latestTerm: "RMP snapshot",
    termCount: 1,
    matchConfidence: 82,
    tags: ["Clear lectures", "Fair grading"],
    summary: "A strong fallback-only profile.",
    professorTitle: "Teaching Assistant Professor",
    professorSummary: "Enough sentiment signal exists to guide decisions transparently.",
    courseSummary: "Shows the nationwide floor of the launch product.",
    trend: [{ term: "RMP", avgGpa: null, aPct: null, rmpRating: 4.5, rmpDifficulty: 2.7 }],
  },
];

function getDataCompletenessFromTier(
  tier: School["coverageTier"],
): DataCompleteness {
  switch (tier) {
    case "institutional_plus_rmp":
      return "institutional_full";
    case "institutional_only":
      return "institutional_partial";
    case "rmp_only":
      return "rmp_only";
    default:
      return "directory_only";
  }
}

const offerings = rawOfferings.map((offering) => {
  const school = schools.find((item) => item.slug === offering.schoolSlug);

  return enrichSummary({
    ...offering,
    schoolName: school?.name ?? offering.schoolSlug,
    freshness: school?.sourceStatus.freshness ?? offering.latestTerm,
    sourceLabels: [
      school?.sourceStatus.primary ?? "Institutional data",
      school?.sourceStatus.fallback ?? "Rate My Professors",
    ].filter(Boolean),
    dataCompleteness: getDataCompletenessFromTier(offering.coverageTier),
  });
});

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function schoolMap() {
  return new Map(schools.map((school) => [school.slug, school]));
}

export function getSchools() {
  return schools;
}

export function getFeaturedOfferings() {
  return [...offerings]
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0))
    .slice(0, 6);
}

export function getAllOfferings() {
  return offerings;
}

export function getSchoolBySlug(slug: string) {
  return schools.find((school) => school.slug === slug);
}

export function getOfferingsForSchool(schoolSlug: string) {
  return offerings.filter((offering) => offering.schoolSlug === schoolSlug);
}

export function getCourseGroupsForSchool(schoolSlug: string): CourseGroup[] {
  const groups = new Map<string, ProfessorCourseSummary[]>();
  for (const offering of getOfferingsForSchool(schoolSlug)) {
    groups.set(offering.courseSlug, [...(groups.get(offering.courseSlug) ?? []), offering]);
  }

  return [...groups.values()]
    .map((items) => {
      const top = [...items].sort(
        (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
      )[0];
      return {
        schoolSlug,
        courseSlug: top.courseSlug,
        courseCode: top.courseCode,
        courseName: top.courseName,
        department: top.department,
        summary: top.courseSummary,
        coverageTier: top.coverageTier,
        offeringCount: items.length,
        topClassifyScore: top.classifyScore,
        topExpectedGpa: Math.max(...items.map((item) => item.expectedGpa ?? 0)) || null,
        topProfessorName: top.professorName,
        freshness: top.freshness,
      };
    })
    .sort((left, right) => (right.topClassifyScore ?? 0) - (left.topClassifyScore ?? 0));
}

export function getCourseGroup(schoolSlug: string, courseSlug: string) {
  return getCourseGroupsForSchool(schoolSlug).find((course) => course.courseSlug === courseSlug);
}

export function getCourseOfferings(schoolSlug: string, courseSlug: string) {
  return offerings
    .filter(
      (offering) =>
        offering.schoolSlug === schoolSlug && offering.courseSlug === courseSlug,
    )
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
}

export function getProfessorProfile(
  schoolSlug: string,
  professorSlug: string,
): ProfessorProfile | undefined {
  const school = getSchoolBySlug(schoolSlug);
  const matches = offerings.filter(
    (offering) =>
      offering.schoolSlug === schoolSlug &&
      offering.professorSlug === professorSlug,
  );
  if (!school || matches.length === 0) return undefined;
  const first = matches[0];
  const professor: ProfessorDirectoryRow = {
    id: `seed-profdir:${schoolSlug}:${professorSlug}`,
    schoolSlug,
    schoolName: school.name,
    professorSlug,
    professorName: first.professorName,
    professorTitle: first.professorTitle,
    departments: [...new Set(matches.map((item) => item.department))],
    coursePrefixes: [
      ...new Set(matches.map((item) => item.courseCode.split(/\s+/)[0]?.trim().toUpperCase()).filter(Boolean)),
    ],
    courseCodes: [...new Set(matches.map((item) => item.courseCode))],
    courseCount: new Set(matches.map((item) => item.courseSlug)).size,
    sectionCount: 0,
    coverageTier: first.coverageTier,
    coverageLevel:
      first.expectedGpa != null || first.aRate != null
        ? "stats_full"
        : first.rmpRating != null
          ? "stats_partial"
          : "instructor_directory_ready",
    statsAvailability:
      first.expectedGpa != null || first.aRate != null
        ? "full"
        : first.rmpRating != null
          ? "rmp_only"
          : "none",
    evidenceFreshness: first.freshness,
    sourceKinds: first.evidenceProfile?.sourceKinds ?? ["catalog"],
    hasInstitutionalStats: first.expectedGpa != null || first.aRate != null,
    hasRmp: first.rmpRating != null || first.rmpDifficulty != null,
    hasSchedulePresence: Boolean(first.hasSectionPlanning),
    expectedGpa: first.expectedGpa,
    aRate: first.aRate,
    classifyScore: first.classifyScore,
    rmpRating: first.rmpRating,
    rmpDifficulty: first.rmpDifficulty,
    sampleSize: matches.reduce((sum, item) => sum + item.sampleSize, 0),
    trend: first.trend,
    tags: [...new Set(matches.flatMap((item) => item.tags))],
    summary: first.professorSummary,
  };
  return { school, offerings: matches, professor };
}

export function getOfferingById(id: string) {
  return offerings.find((offering) => offering.id === id);
}

export function getCompareOfferings(ids: string[]) {
  return ids
    .map((id) => getOfferingById(id))
    .filter((item): item is ProfessorCourseSummary => item != null)
    .slice(0, 4);
}

export function getCoverageStats() {
  return {
    trackedSchools: schools.length,
    institutionalSchools: schools.filter((school) => school.coverageTier !== "rmp_only").length,
    trackedCourses: uniqueBy(offerings, (item) => `${item.schoolSlug}:${item.courseSlug}`).length,
    trackedProfessors: uniqueBy(offerings, (item) => `${item.schoolSlug}:${item.professorSlug}`)
      .length,
  };
}

function buildSearchIndex() {
  const schoolLookup = schoolMap();

  const schoolHits: SearchHit[] = schools.map((school) => ({
    type: "school",
    id: school.id,
    label: school.shortName,
    school: `${school.city}, ${school.state}`,
    slug: school.slug,
    href: `/schools/${school.slug}`,
    coverageTier: school.coverageTier,
    highlight: school.descriptor,
    secondaryMetrics: [
      school.sourceStatus.primary,
      school.sourceStatus.freshness,
      `${school.directoryCount}+ searchable professors`,
    ],
    freshness: school.sourceStatus.freshness,
    sourceLabels: [school.sourceStatus.primary, school.sourceStatus.fallback],
    dataCompleteness: getDataCompletenessFromTier(school.coverageTier),
    context: {
      schoolSlug: school.slug,
      schoolShortName: school.shortName,
      contextLabel: `${school.city}, ${school.state}`,
      searchScope: "directory",
    },
  }));

  const courseHits: SearchHit[] = schools.flatMap((school) =>
    getCourseGroupsForSchool(school.slug).map((course) => ({
      type: "course" as const,
      id: `${course.schoolSlug}:${course.courseSlug}`,
      label: `${course.courseCode} - ${course.courseName}`,
      school: school.shortName,
      slug: course.courseSlug,
      href: `/schools/${course.schoolSlug}/courses/${course.courseSlug}`,
      coverageTier: course.coverageTier,
      highlight: course.summary,
      secondaryMetrics: [
        course.topProfessorName,
        course.topClassifyScore == null
          ? "Classify score unavailable"
          : `Top Classify ${Math.round(course.topClassifyScore)}`,
      ],
      freshness: course.freshness,
      sourceLabels: [school.sourceStatus.primary, school.sourceStatus.fallback],
      dataCompleteness: getDataCompletenessFromTier(course.coverageTier),
      context: {
        schoolSlug: school.slug,
        schoolShortName: school.shortName,
        contextLabel: `Top pick ${course.topProfessorName}`,
        searchScope: "course",
      },
    })),
  );

  const professorHits: SearchHit[] = offerings.map((offering) => ({
    type: "professor",
    id: offering.id,
    label: offering.professorName,
    school: schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
    slug: offering.professorSlug,
    href: `/schools/${offering.schoolSlug}/professors/${offering.professorSlug}`,
    coverageTier: offering.coverageTier,
    highlight: `${offering.courseCode} - ${offering.courseName}`,
    secondaryMetrics: [
      offering.classifyScore == null
        ? "Classify unavailable"
        : `Classify ${Math.round(offering.classifyScore)}`,
      offering.expectedGpa == null
        ? "No GPA data yet"
        : `Expected GPA ${offering.expectedGpa.toFixed(2)}`,
    ],
    freshness: offering.freshness,
    sourceLabels: offering.sourceLabels,
    dataCompleteness: offering.dataCompleteness,
    context: {
      schoolSlug: offering.schoolSlug,
      schoolShortName:
        schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
      contextLabel: `${offering.courseCode} - ${offering.courseName}`,
      searchScope: "professor_course",
    },
  }));

  return [...schoolHits, ...courseHits, ...professorHits];
}

const searchIndex = buildSearchIndex();

function scoreMatch(query: string, target: string, aliases: string[] = []) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return 1;

  const haystack = [target, ...aliases].join(" ").toLowerCase();
  if (haystack.startsWith(normalized)) return 100;
  if (haystack.includes(` ${normalized}`)) return 88;
  if (haystack.includes(normalized)) return 72;

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, token) => score + (haystack.includes(token) ? 18 : 0), 0);
}

export function searchDirectory(query: string, limit = 12) {
  const schoolLookup = schoolMap();

  return [...searchIndex]
    .map((hit) => {
      const school =
        hit.type === "school"
          ? schoolLookup.get(hit.slug)
          : schoolLookup.get(
              offerings.find((offering) => offering.id === hit.id)?.schoolSlug ?? "",
            );

      return {
        hit,
        score: scoreMatch(query, `${hit.label} ${hit.school} ${hit.highlight}`, [
          ...(school?.aliases ?? []),
          hit.school,
          hit.highlight,
        ]),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const order = { school: 0, course: 1, professor: 2 };
      if (order[left.hit.type] !== order[right.hit.type]) {
        return order[left.hit.type] - order[right.hit.type];
      }
      return right.score - left.score;
    })
    .slice(0, limit)
    .map((item) => item.hit);
}

export function getSuggestedHits() {
  return searchDirectory("", 8);
}

export function getSchoolSpotlight(slug: string) {
  const school = getSchoolBySlug(slug);
  if (!school) return undefined;

  const schoolOfferings = getOfferingsForSchool(slug);
  return {
    school,
    offerings: schoolOfferings,
    courses: getCourseGroupsForSchool(slug),
    trending: [...schoolOfferings]
      .filter((offering) => offering.trendDelta != null)
      .sort((left, right) => (right.trendDelta ?? 0) - (left.trendDelta ?? 0))
      .slice(0, 3),
  };
}
