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
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type MutableRefObject,
} from "react";
import { Search, School, GraduationCap, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { runDeferredNavigation } from "@/lib/deferred-navigation";
import { type SearchHit, type SearchHitType } from "@/lib/types";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { CoverageBadge } from "@/components/coverage-badge";
import { useDelayedShown } from "@/hooks/use-delayed-shown";
import {
  pushRecentSearch,
  readRecentSearches,
  type RecentSearchEntry,
} from "@/lib/recent-searches";
import {
  cancelClientMeasure,
  endClientMeasure,
  startClientMeasure,
} from "@/lib/client-performance";

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
  syncSearchUrl?: boolean;
  resultSurface?: "combobox" | "page";
  liveSyncSearchPage?: boolean;
}

const iconMap = {
  school: School,
  course: GraduationCap,
  professor: UserRound,
} as const;

const SEARCH_CACHE_TTL_MS = 45_000;
const SEARCH_DEBOUNCE_MS = 140;
const MOBILE_SEARCH_DEBOUNCE_MS = 85;
const COMBOBOX_RESULT_LIMIT = 8;
const searchResponseCache = new Map<
  string,
  {
    expiresAt: number;
    results: SearchHit[];
  }
>();

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
  resultSurface = "combobox",
  liveSyncSearchPage = false,
}: SearchComboboxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const lastSyncedHrefRef = useRef("");
  const showListLoading = useDelayedShown(isPending || isLoading, 380);
  const effectiveLimit =
    resultSurface === "combobox" ? Math.min(limit, COMBOBOX_RESULT_LIMIT) : limit;
  const recentEntries = useMemo(
    () => (open && !query.trim() ? readRecentSearches().slice(0, 6) : []),
    [open, query],
  );

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const debounceMs = isMobileSheet ? MOBILE_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS;
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(deferredQuery);
    }, deferredQuery.trim() ? debounceMs : 0);

    return () => window.clearTimeout(timeout);
  }, [deferredQuery, isMobileSheet]);

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmed = initialQuery.trim();
    if (trimmed) params.set("q", trimmed);
    if (schoolSlug?.trim()) params.set("school", schoolSlug.trim());
    if (searchType !== "all") params.set("type", searchType);
    lastSyncedHrefRef.current = params.toString() ? `/search?${params.toString()}` : "/search";
  }, [initialQuery, schoolSlug, searchType]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 767px)");
    const touch = window.matchMedia("(pointer: coarse)");
    const tablet = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      // Treat touch tablets/landscape phones as mobile sheet to avoid drifting desktop popovers.
      setIsMobileSheet(compact.matches || (touch.matches && tablet.matches));
    };
    update();
    compact.addEventListener("change", update);
    touch.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      compact.removeEventListener("change", update);
      touch.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!(open && isMobileSheet)) {
      return;
    }

    // iOS Safari still rubber-bands with overflow hidden; pin body and restore scroll on close.
    const scrollY = window.scrollY;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const bodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      document.body.style.touchAction = bodyTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [isMobileSheet, open]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
    placement: "bottom",
    transform: false,
    middleware: [
      offset(10),
      ...(isMobileSheet
        ? []
        : [
            shift({
              padding: 16,
              mainAxis: false,
              crossAxis: false,
            }),
            size({
              padding: 16,
              apply({ availableHeight, availableWidth, elements, rects }) {
                const maxWidth = Math.min(availableWidth, 760);
                Object.assign(elements.floating.style, {
                  width: `${Math.min(rects.reference.width, maxWidth)}px`,
                  maxHeight: `${Math.min(availableHeight, 392)}px`,
                });
              },
            }),
          ]),
    ],
  });
  const setReferenceRef = useCallback(
    (node: HTMLFormElement | null) => {
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
  const dismiss = useDismiss(context, { outsidePressEvent: "pointerdown" });
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
    const trimmedQuery = debouncedQuery.trim();
    const shouldSkipFetch = resultSurface === "combobox" && !trimmedQuery;

    if (shouldSkipFetch) {
      setResults([]);
      setActiveIndex(null);
      setFetchError(false);
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (trimmedQuery) {
      params.set("query", trimmedQuery);
    }
    if (searchType !== "all") {
      params.set("type", searchType);
    }
    if (schoolSlug) {
      params.set("schoolSlug", schoolSlug);
    }
    params.set("surface", resultSurface);
    params.set("limit", String(effectiveLimit));

    const endpoint = `/api/search?${params.toString()}`;
    const cacheEntry = searchResponseCache.get(endpoint);

    if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
      setResults(cacheEntry.results);
      setActiveIndex(cacheEntry.results.length ? 0 : null);
      setFetchError(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const measureKey = `search-suggestion:${endpoint}`;

    setIsLoading(true);
    setFetchError(false);
    startClientMeasure(measureKey, "search_suggestion_latency", {
      surface: resultSurface,
      school_slug: schoolSlug ?? "",
      search_type: searchType,
      query_length: trimmedQuery.length,
    });

    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          results?: SearchHit[];
        } | null;
        const list = Array.isArray(payload?.results) ? payload.results : [];

        if (!response.ok) {
          if (ignore) return;
          setResults(list);
          setActiveIndex(list.length ? 0 : null);
          setFetchError(true);
          return;
        }

        if (ignore) return;
        searchResponseCache.set(endpoint, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          results: list,
        });
        setResults(list);
        setActiveIndex(list.length ? 0 : null);
        setFetchError(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || String(error).includes("AbortError")) {
          cancelClientMeasure(measureKey);
          return;
        }
        if (!ignore) {
          setResults([]);
          setActiveIndex(null);
          setFetchError(true);
        }
      })
      .finally(() => {
        void endClientMeasure(measureKey, {
          surface: resultSurface,
          search_type: searchType,
          school_slug: schoolSlug ?? "",
        });
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
      cancelClientMeasure(measureKey);
      controller.abort();
    };
  }, [debouncedQuery, effectiveLimit, resultSurface, schoolSlug, searchType, retryNonce]);

  useEffect(() => {
    if (!(open && !isMobileSheet)) {
      return;
    }

    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [isMobileSheet, open]);

  useEffect(() => {
    if (!syncSearchUrl || !liveSyncSearchPage || onSelect) {
      return;
    }

    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    if (schoolSlug?.trim()) params.set("school", schoolSlug.trim());
    if (searchType !== "all") params.set("type", searchType);
    const nextHref = params.toString() ? `/search?${params.toString()}` : "/search";

    if (!query.length) {
      lastSyncedHrefRef.current = nextHref;
    }

    const timeout = window.setTimeout(() => {
      if (lastSyncedHrefRef.current === nextHref) {
        return;
      }

      lastSyncedHrefRef.current = nextHref;
      startTransition(() => {
        runDeferredNavigation(() => {
          router.replace(nextHref, { scroll: false });
        });
      });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [
    liveSyncSearchPage,
    onSelect,
    query,
    router,
    schoolSlug,
    searchType,
    startTransition,
    syncSearchUrl,
  ]);

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

  const actionLabel =
    isPending || isLoading
      ? isMobileSheet
        ? "Wait"
        : "Working"
      : fetchError
        ? "Retry"
        : onSelect
          ? "Add"
          : isMobileSheet
            ? "Go"
            : "Explore";

  function handleSelect(item: SearchHit) {
    setOpen(false);
    pushRecentSearch(item);
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
      runDeferredNavigation(() => {
        router.push(item.href);
      });
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
      runDeferredNavigation(() => {
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
    });
  }

  return (
    <div className={cn("relative z-[241] w-full", className)}>
      <form
        ref={setReferenceRef}
        className="soft-panel relative z-[241] flex items-center gap-2 rounded-[26px] p-1.5 sm:gap-3 sm:p-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-deep-ink text-ivory sm:h-12 sm:w-12 sm:rounded-[18px]">
          {showListLoading ? (
            <ClassifyLoadingMark
              size="sm"
              tone="onDark"
              className="scale-[0.88]"
              label="Searching catalog"
            />
          ) : (
            <Search className="h-5 w-5 shrink-0" aria-hidden />
          )}
        </div>
        <input
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
            "h-11 min-w-0 flex-1 rounded-xl bg-transparent pr-1 text-base text-ink outline-none placeholder:text-muted/75 focus-visible:ring-2 focus-visible:ring-teal/30 sm:h-12 sm:pr-2 sm:text-lg",
            inputClassName,
          )}
          {...getReferenceProps()}
        />
        <button
          type="submit"
          className="inline-flex min-h-11 w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-deep-ink px-3 py-3 text-sm font-medium text-ivory transition hover:bg-[#0f2237] sm:w-auto sm:min-w-[7.25rem] sm:px-5"
        >
          <span className="inline-flex items-center justify-center">
            {actionLabel}
          </span>
        </button>
      </form>

      <AnimatePresence>
        {open ? (
          isMobileSheet ? (
            <FloatingPortal>
              <div className="overlay-layer fixed inset-0 z-[240]">
                <motion.button
                  type="button"
                  className="absolute inset-0 bg-deep-ink/50"
                  onClick={() => setOpen(false)}
                  aria-label="Close search suggestions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <div className="absolute inset-x-0 bottom-0 flex max-h-full items-end">
                  <motion.div
                    ref={setFloatingRef}
                    className="mobile-sheet-shell mx-auto w-full max-w-none rounded-t-[30px] bg-background"
                    initial={{ y: 46, opacity: 0.86 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 28, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    {...getFloatingProps()}
                  >
                    <div className="soft-panel mobile-app-scroll max-h-[min(78dvh,44rem)] overflow-y-auto rounded-t-[30px] border-b-0 p-3 pb-6">
                      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-border/90" />
                      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-3 border-b border-border/60 bg-[linear-gradient(180deg,rgba(246,241,232,0.98),rgba(246,241,232,0.92))] px-5 pb-3 pt-4 backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="eyebrow">Search results</p>
                            <p className="mt-1 text-sm text-muted">
                              Tap a result to keep moving without losing your flow.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-ink shadow-sm"
                            aria-label="Dismiss search results"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <SearchResultsPanel
                        query={query}
                        groupedSections={groupedSections}
                        results={results}
                        recentEntries={recentEntries}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                        onSelect={handleSelect}
                        onLinkSelect={() => setOpen(false)}
                        getItemProps={getItemProps}
                        listRef={listRef}
                        emptyMessage={emptyMessage}
                        fetchError={fetchError}
                        linkResults={!onSelect}
                        panelMode="sheet"
                      />
                    </div>
                  </motion.div>
                </div>
              </div>
            </FloatingPortal>
          ) : (
            <FloatingPortal>
              <motion.div
                ref={setFloatingRef}
                style={floatingStyles}
                className="overlay-layer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                {...getFloatingProps()}
              >
                <div className="soft-panel overflow-hidden rounded-[28px] border border-border/80 shadow-[0_28px_72px_rgba(7,17,31,0.18)]">
                  <SearchResultsPanel
                    query={query}
                    groupedSections={groupedSections}
                    results={results}
                    recentEntries={recentEntries}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    onSelect={handleSelect}
                    onLinkSelect={() => setOpen(false)}
                    getItemProps={getItemProps}
                    listRef={listRef}
                    emptyMessage={emptyMessage}
                    fetchError={fetchError}
                    linkResults={!onSelect}
                    panelMode="popover"
                  />
                </div>
              </motion.div>
            </FloatingPortal>
          )
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SearchResultsPanel({
  query,
  groupedSections,
  results,
  recentEntries,
  activeIndex,
  setActiveIndex,
  onSelect,
  onLinkSelect,
  getItemProps,
  listRef,
  emptyMessage,
  fetchError,
  linkResults,
  panelMode = "popover",
}: {
  query: string;
  groupedSections: Array<{ key: string; label: string; items: SearchHit[] }>;
  results: SearchHit[];
  recentEntries: RecentSearchEntry[];
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
  onSelect: (item: SearchHit) => void;
  onLinkSelect: () => void;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  listRef: MutableRefObject<Array<HTMLElement | null>>;
  emptyMessage: string;
  fetchError: boolean;
  linkResults: boolean;
  panelMode?: "sheet" | "popover";
}) {
  return (
    <div
      className={cn(
        "p-2.5 sm:p-3",
        panelMode === "popover" && "max-h-[18rem] overflow-y-auto sm:max-h-[20rem]",
      )}
    >
      {groupedSections.map((section) =>
        section.items.length ? (
          <div key={section.key} className="mb-3 last:mb-0">
            <div className="px-3 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
              {query.trim() ? section.label : `Suggested ${section.label.toLowerCase()}`}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const index = results.findIndex((candidate) => candidate.id === item.id);
                const Icon = iconMap[item.type];
                const active = index === activeIndex;

                return linkResults ? (
                  <Link
                    key={item.id}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    href={item.href}
                    className={cn(
                      "group flex items-start gap-3 rounded-[20px] px-3 py-2.5 transition",
                      active ? "bg-white" : "hover:bg-white/78",
                    )}
                    {...getItemProps({
                      onMouseEnter: () => setActiveIndex(index),
                      onClick: () => onLinkSelect(),
                    })}
                  >
                    <ResultContent item={item} Icon={Icon} />
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    type="button"
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-[20px] px-3 py-2.5 text-left transition",
                      active ? "bg-white" : "hover:bg-white/78",
                    )}
                    {...getItemProps({
                      onMouseEnter: () => setActiveIndex(index),
                      onClick: () => onSelect(item),
                    })}
                  >
                    <ResultContent item={item} Icon={Icon} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null,
      )}
      {fetchError ? (
        <div className="rounded-[22px] border border-copper/40 bg-copper/10 px-4 py-5 text-center text-sm text-ink">
          Couldn&apos;t load suggestions. Check your connection and try again.
        </div>
      ) : !query.trim() && recentEntries.length ? (
        <div className="mb-1">
          <div className="px-3 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            Recent checks
          </div>
          <div className="space-y-1">
            {recentEntries.map((entry) => {
              const Icon = iconMap[entry.type];
              return (
                <Link
                  key={`${entry.id}:${entry.href}`}
                  href={entry.href}
                  onClick={() => onLinkSelect()}
                  className="group flex items-start gap-3 rounded-[20px] px-3 py-2.5 transition hover:bg-white/78"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-deep-ink/8 text-deep-ink">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[0.96rem] font-medium leading-6 text-ink">
                      {entry.label}
                    </p>
                    <p className="mt-1 text-sm text-muted">{entry.school}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : !results.length ? (
        <div className="rounded-[22px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {emptyMessage}
        </div>
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
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-deep-ink/8 text-deep-ink">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="line-clamp-2 text-[0.96rem] font-medium leading-6 text-ink">
            {item.label}
          </span>
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
          {item.secondaryMetrics.slice(0, 3).map((metric) => (
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
