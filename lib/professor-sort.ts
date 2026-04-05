/**
 * Derive a case-insensitive sort key from a display name so lists order by family name.
 * Handles "W. Chu", "Jane Smith", "D. Van Poppel" / registrar-style strings.
 */
export function professorLastNameSortKey(displayName: string): string {
  const s = displayName.trim();
  if (!s) return "";

  const rest = s.replace(/^([A-Za-z]\.{0,1}\s+)+/, "").trim();
  const body = rest || s;
  const parts = body.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return body.toLowerCase();
  }

  const hadLeadingInitials = /^([A-Za-z]\.{0,1}\s+)+/.test(s);
  if (hadLeadingInitials) {
    return parts.join(" ").toLowerCase();
  }

  return (parts[parts.length - 1] ?? body).toLowerCase();
}
