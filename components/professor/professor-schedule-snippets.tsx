import Link from "next/link";
import type { SectionMeeting, SectionRecord } from "@/lib/types";

function formatMeetingTime(start: string | null, end: string | null): string {
  if (!start && !end) {
    return "Time TBA";
  }
  if (start && end) {
    return `${start}–${end}`;
  }
  return start ?? end ?? "Time TBA";
}

export function ProfessorScheduleSnippets({
  sections,
  meetings,
  schoolSlug,
}: {
  sections: SectionRecord[];
  meetings: SectionMeeting[];
  schoolSlug: string;
}) {
  if (!sections.length && !meetings.length) {
    return null;
  }

  const meetingBySection = new Map<string, SectionMeeting>();
  for (const m of meetings) {
    if (!meetingBySection.has(m.sectionId)) {
      meetingBySection.set(m.sectionId, m);
    }
  }

  const rows = [...sections]
    .sort((a, b) => b.term.localeCompare(a.term))
    .slice(0, 14)
    .map((section) => {
      const meeting = meetingBySection.get(section.id);
      const days =
        section.days?.length
          ? section.days.join(", ")
          : meeting?.days?.length
            ? meeting.days.join(", ")
            : "Days TBA";
      const time = section.hasMeetingTime
        ? formatMeetingTime(section.startTime, section.endTime)
        : meeting
          ? formatMeetingTime(meeting.startTime, meeting.endTime)
          : "Time TBA";
      const location = section.location ?? meeting?.location ?? "—";
      return { section, days, time, location };
    });

  return (
    <section className="soft-panel rounded-[30px] p-5 sm:p-6">
      <p className="eyebrow">Schedule snippets</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Published sections and meeting patterns</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Rows come from the published catalog snapshot (registrar or adapter feeds). Offerings without section
        timing won’t appear here.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Course</th>
              <th className="pb-3 pr-3 font-medium">Term</th>
              <th className="pb-3 pr-3 font-medium">When</th>
              <th className="pb-3 font-medium">Where</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ section, days, time, location }) => (
              <tr key={section.id} className="border-b border-border/60 align-top">
                <td className="py-3 pr-3">
                  <Link
                    href={`/schools/${schoolSlug}/courses/${section.courseSlug}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {section.courseCode}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">{section.courseName}</p>
                </td>
                <td className="py-3 pr-3 text-muted">{section.term}</td>
                <td className="py-3 pr-3">
                  <span className="text-ink">{days}</span>
                  <span className="mt-0.5 block text-xs text-muted">{time}</span>
                </td>
                <td className="py-3 text-muted">{location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
