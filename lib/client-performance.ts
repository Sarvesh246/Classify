"use client";

type PerfPayload = Record<string, string | number | boolean | null | undefined>;

type ActiveMeasure = {
  name: string;
  startedAt: number;
  payload?: PerfPayload;
};

declare global {
  interface Window {
    __classifyPerfMarks?: Map<string, ActiveMeasure>;
  }
}

function getStore() {
  if (typeof window === "undefined") {
    return null;
  }

  window.__classifyPerfMarks ??= new Map<string, ActiveMeasure>();
  return window.__classifyPerfMarks;
}

function sanitizeEventName(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40) || "perf_event";
}

function sanitizePayload(payload: PerfPayload = {}) {
  const output: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    if (!safeKey) continue;

    if (typeof value === "number") {
      output[safeKey] = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
      continue;
    }

    output[safeKey] = typeof value === "boolean" ? (value ? 1 : 0) : String(value).slice(0, 100);
  }

  return output;
}

function emitDevLog(name: string, durationMs: number, payload: PerfPayload = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const safeDuration = Math.round(durationMs * 100) / 100;
  console.info(`[perf] ${name}: ${safeDuration}ms`, payload);
}

export async function emitPerformanceEvent(
  name: string,
  durationMs: number,
  payload: PerfPayload = {},
) {
  const merged = sanitizePayload({
    duration_ms: durationMs,
    ...payload,
  });

  emitDevLog(name, durationMs, merged);

  if (typeof window === "undefined") {
    return;
  }

  try {
    const { logAnalyticsEvent } = await import("@/lib/firebase/client");
    await logAnalyticsEvent(sanitizeEventName(name), merged);
  } catch {
    // ignore analytics failures entirely
  }
}

export function startClientMeasure(
  key: string,
  name: string,
  payload?: PerfPayload,
) {
  const store = getStore();
  if (!store) return;

  store.set(key, {
    name,
    startedAt: performance.now(),
    payload,
  });
}

export async function endClientMeasure(
  key: string,
  extraPayload?: PerfPayload,
) {
  const store = getStore();
  if (!store) return;

  const active = store.get(key);
  if (!active) return;

  store.delete(key);
  await emitPerformanceEvent(active.name, performance.now() - active.startedAt, {
    ...active.payload,
    ...extraPayload,
  });
}

export function cancelClientMeasure(key: string) {
  const store = getStore();
  store?.delete(key);
}
