import { NextRequest, NextResponse } from "next/server";
import {
  getSuggestedHits,
  searchDirectory,
} from "@/lib/server-directory";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const type =
    request.nextUrl.searchParams.get("type")?.trim() || undefined;
  const schoolSlug =
    request.nextUrl.searchParams.get("schoolSlug")?.trim() || undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const options = {
    limit: Number.isFinite(limit) ? limit : 12,
    type:
      type === "school" || type === "course" || type === "professor"
        ? type
        : "all",
    schoolSlug,
  } as const;

  const results = query
    ? await searchDirectory(query, options)
    : await getSuggestedHits(options);
  return NextResponse.json({ results });
}
