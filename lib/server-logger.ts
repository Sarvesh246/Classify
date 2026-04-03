import "server-only";

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = { level, event, ts: new Date().toISOString(), ...data };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const serverLog = {
  info(event: string, data?: Record<string, unknown>) {
    emit("info", event, data);
  },
  warn(event: string, data?: Record<string, unknown>) {
    emit("warn", event, data);
  },
  error(event: string, data?: Record<string, unknown>) {
    emit("error", event, data);
  },
};
