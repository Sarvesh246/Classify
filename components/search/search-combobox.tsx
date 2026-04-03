"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  autoUpdate,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
} from "react";
import { Search, School, GraduationCap, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SearchHit, type SearchHitType } from "@/lib/types";
import { CoverageBadge } from "@/components/coverage-badge";

interface SearchComboboxProps {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  searchType?: SearchHitType | "all";
  schoolSlug?: string;
  limit?: number;
  emptyMessage?: string;
  clearOnSelect?: boolean;
  onSelect?: (item: SearchHit) => void;
  /** When true, Explore submits to `/search` with q, school, and type (page uses `school`; API still uses schoolSlug). */
  syncSearchUrl?: boolean;
}

const iconMap = {
  school: School,
  course: GraduationCap,
  professor: UserRound,
} as const;

export function SearchCombobox({
  initialQuery = "",
  placeholder = "Search schools, courses, or professors",
  className,
  inputClassName,
  searchType = "all",
  schoolSlug,
  limit = 12,
  emptyMessage = "No matches yet. Try a school like UT Austin, a course like CS 312, or a professor.",
  clearOnSelect = false,
  onSelect,
  syncSearchUrl = false,
}: SearchComboboxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
    placement: "bottom-start",
    middleware: [
      offset(12),
      shift({ padding: 16 }),
      size({
        padding: 16,
        apply({ availableHeight, elements, rects }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(rects.reference.width, 320)}px`,
            maxHeight: `${Math.min(availableHeight, 448)}px`,
          });
        },
      }),
    ],
  });
  const setPositionReferenceRef = useCallback(
    (node: HTMLFormElement | null) => {
      refs.setPositionReference(node);
    },
    [refs],
  );
  const setReferenceRef = useCallback(
    (node: HTMLInputElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );
  const dismiss = useDismiss(context, { outsidePressEvent: "mousedown" });
  const role = useRole(context, { role: "listbox" });
  const listNavigation = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
    virtual: true,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    dismiss,
    role,
    listNavigation,
  ]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (deferredQuery.trim()) {
      params.set("query", deferredQuery.trim());
    }
    if (searchType !== "all") {
      params.set("type", searchType);
    }
    if (schoolSlug) {
      params.set("schoolSlug", schoolSlug);
    }
    params.set("limit", String(limit));

    const endpoint = `/api/search?${params.toString()}`;

    setIsLoading(true);
    setFetchError(false);

    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`search ${response.status}`);
        }
        return response.json() as Promise<{ results?: SearchHit[] }>;
      })
      .then((payload) => {
        if (ignore) return;
        const next = Array.isArray(payload.results) ? payload.results : [];
        setResults(next);
        setActiveIndex(next.length ? 0 : null);
        setFetchError(false);
      })
      .catch(() => {
        if (!ignore) {
          setResults([]);
          setActiveIndex(null);
          setFetchError(true);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [deferredQuery, limit, schoolSlug, searchType, retryNonce]);

  const groupedSections = useMemo(() => {
    if (searchType !== "all") {
      return [
        {
          key: searchType,
          label:
            searchType === "school"
              ? "Schools"
              : searchType === "course"
                ? "Courses"
                : "Professors",
          items: results,
        },
      ];
    }

    return [
      {
        key: "school",
        label: "Schools",
        items: results.filter((result) => result.type === "school"),
      },
      {
        key: "course",
        label: "Courses",
        items: results.filter((result) => result.type === "course"),
      },
      {
        key: "professor",
        label: "Professors",
        items: results.filter((result) => result.type === "professor"),
      },
    ];
  }, [results, searchType]);

  function handleSelect(item: SearchHit) {
    setOpen(false);
    if (clearOnSelect) {
      setQuery("");
    } else {
      setQuery(item.label);
    }

    if (onSelect) {
      onSelect(item);
      return;
    }

    startTransition(() => {
      router.push(item.href);
    });
  }

  function handleSubmit() {
    if (onSelect) {
      const item = results[activeIndex ?? 0] ?? results[0];
      if (item) {
        handleSelect(item);
      }
      return;
    }

    if (fetchError) {
      setRetryNonce((n) => n + 1);
      setOpen(true);
      return;
    }

    startTransition(() => {
      if (syncSearchUrl) {
        const p = new URLSearchParams();
        if (query.trim()) p.set("q", query.trim());
        if (schoolSlug?.trim()) p.set("school", schoolSlug.trim());
        if (searchType !== "all") p.set("type", searchType);
        const qs = p.toString();
        router.push(qs ? `/search?${qs}` : "/search");
      } else {
        router.push(
          query.trim()
            ? `/search?q=${encodeURIComponent(query.trim())}`
            : "/search",
        );
      }
      setOpen(false);
    });
  }

  return (
    <div className={cn("relative w-full", className)}>
      <form
        ref={setPositionReferenceRef}
        className="soft-panel flex items-center gap-3 rounded-[26px] p-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-deep-ink text-ivory">
          <Search className="h-5 w-5" />
        </div>
        <input
          ref={setReferenceRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-busy={isLoading}
          aria-invalid={fetchError}
          className={cn(
            "h-12 flex-1 bg-transparent pr-2 text-base text-ink outline-none placeholder:text-muted/75 sm:text-lg",
            inputClassName,
          )}
          {...getReferenceProps()}
        />
        <button
          type="submit"
          className="rounded-full bg-deep-ink px-5 py-3 text-sm font-medium text-ivory transition hover:bg-[#0f2237]"
        >
          {isPending || isLoading
            ? "Searching..."
            : fetchError
              ? "Retry"
              : onSelect
                ? "Add"
                : "Explore"}
        </button>
      </form>

      {open ? (
        <FloatingPortal>
          <div
            ref={setFloatingRef}
            style={floatingStyles}
            className="overlay-layer"
            {...getFloatingProps()}
          >
            <div className="soft-panel overflow-hidden rounded-[28px]">
              <div className="max-h-[28rem] overflow-y-auto p-3">
                {groupedSections.map((section) =>
                  section.items.length ? (
                    <div key={section.key} className="mb-4 last:mb-0">
                      <div className="px-3 pb-2 pt-1 text-[0.72rem] uppercase tracking-[0.18em] text-muted">
                        {query.trim()
                          ? section.label
                          : `Suggested ${section.label.toLowerCase()}`}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const index = results.findIndex(
                            (candidate) => candidate.id === item.id,
                          );
                          const Icon = iconMap[item.type];
                          const active = index === activeIndex;

                          return onSelect ? (
                            <button
                              key={item.id}
                              ref={(node) => {
                                listRef.current[index] = node;
                              }}
                              type="button"
                              className={cn(
                                "group flex w-full items-start gap-3 rounded-[22px] px-3 py-3 text-left transition",
                                active ? "bg-white" : "hover:bg-white/78",
                              )}
                              {...getItemProps({
                                onMouseEnter: () => setActiveIndex(index),
                                onClick: () => handleSelect(item),
                              })}
                            >
                              <ResultContent item={item} Icon={Icon} />
                            </button>
                          ) : (
                            <Link
                              key={item.id}
                              ref={(node) => {
                                listRef.current[index] = node;
                              }}
                              href={item.href}
                              className={cn(
                                "group flex items-start gap-3 rounded-[22px] px-3 py-3 transition",
                                active ? "bg-white" : "hover:bg-white/78",
                              )}
                              {...getItemProps({
                                onMouseEnter: () => setActiveIndex(index),
                                onClick: () => setOpen(false),
                              })}
                            >
                              <ResultContent item={item} Icon={Icon} />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
                {fetchError ? (
                  <div className="rounded-[24px] border border-copper/40 bg-copper/10 px-4 py-6 text-center text-sm text-ink">
                    Couldn&apos;t load suggestions. Check your connection and try again.
                  </div>
                ) : !results.length ? (
                  <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                    {emptyMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
}

function ResultContent({
  item,
  Icon,
}: {
  item: SearchHit;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-deep-ink/8 text-deep-ink">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{item.label}</span>
          <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
        </div>
        <p className="mt-1 text-sm text-muted">{item.school}</p>
        <p className="mt-1 line-clamp-1 text-sm text-ink/78">{item.highlight}</p>
        {item.rankHints?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.rankHints.map((hint) => (
              <span
                key={hint}
                className="rounded-full border border-border/70 bg-deep-ink/[0.06] px-2 py-0.5 text-[0.65rem] text-muted"
              >
                {hint}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          {item.secondaryMetrics.map((metric) => (
            <span
              key={metric}
              className="rounded-full border border-border/80 bg-white/70 px-2.5 py-1"
            >
              {metric}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
