export function TagCloud({
  tags,
  title = "Tag cloud",
}: {
  tags: string[];
  title?: string;
}) {
  if (!tags.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-border px-4 py-10 text-sm text-muted">
        No tag distribution is available yet for this professor.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-border/70 bg-white/72 p-4">
      <p className="eyebrow">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="rounded-full border border-border bg-background px-3 py-2 text-sm text-ink"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
