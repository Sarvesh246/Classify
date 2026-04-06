import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPrefetch =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("x-middleware-prefetch");

  // Keep auth-refresh work off most routes to reduce request latency.
  const needsAuthRefresh =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/me/");

  if (isPrefetch || !needsAuthRefresh) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
