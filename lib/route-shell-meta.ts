export type RouteShellMeta = {
  kind: "tab" | "deep";
  title: string;
  subtitle: string;
  backHref?: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: "search" | "filters";
};

function schoolRootFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "schools" && parts[1]) {
    return `/schools/${parts[1]}`;
  }
  return "/search";
}

export function getRouteShellMeta(pathname: string): RouteShellMeta {
  if (pathname === "/") {
    return {
      kind: "tab",
      title: "Home",
      subtitle: "Launch your next decision fast.",
      actionHref: "/search",
      actionLabel: "Search",
      actionIcon: "search",
    };
  }

  if (pathname === "/search") {
    return {
      kind: "tab",
      title: "Search",
      subtitle: "Schools, courses, and professors together.",
      actionHref: "/compare",
      actionLabel: "Compare",
      actionIcon: "filters",
    };
  }

  if (pathname === "/compare") {
    return {
      kind: "tab",
      title: "Compare",
      subtitle: "Build a smarter shortlist.",
      actionHref: "/search",
      actionLabel: "Add",
      actionIcon: "search",
    };
  }

  if (pathname === "/saved") {
    return {
      kind: "tab",
      title: "Saved",
      subtitle: "Your academic workspace.",
      actionHref: "/search",
      actionLabel: "Browse",
      actionIcon: "search",
    };
  }

  if (pathname === "/methodology") {
    return {
      kind: "deep",
      title: "Methodology",
      subtitle: "How Classify earns trust.",
      backHref: "/search",
    };
  }

  if (pathname === "/login") {
    return {
      kind: "deep",
      title: "Sign in",
      subtitle: "Google or email link.",
      backHref: "/search",
    };
  }

  if (pathname === "/profile") {
    return {
      kind: "deep",
      title: "Profile",
      subtitle: "Your account.",
      backHref: "/search",
    };
  }

  if (pathname.startsWith("/schools/")) {
    const schoolRoot = schoolRootFromPath(pathname);
    if (pathname.includes("/my-courses")) {
      return {
        kind: "deep",
        title: "Planner",
        subtitle: "Shortlist and build your term.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/courses/")) {
      return {
        kind: "deep",
        title: "Course",
        subtitle: "Compare instructors and outcomes fast.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/professors/")) {
      return {
        kind: "deep",
        title: "Professor",
        subtitle: "Evidence, trends, and fit at a glance.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/departments/")) {
      return {
        kind: "deep",
        title: "Department",
        subtitle: "Ranked by outcomes and difficulty.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/instructors")) {
      return {
        kind: "deep",
        title: "Instructors",
        subtitle: "Browse the full school directory.",
        backHref: schoolRoot,
      };
    }
    return {
      kind: "deep",
      title: "School",
      subtitle: "Courses, instructors, and planning.",
      backHref: "/search",
    };
  }

  return {
    kind: "deep",
    title: "Classify",
    subtitle: "Course intelligence for your next move.",
    backHref: "/search",
  };
}
