import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGpa(value: number | null) {
  return value == null ? "Unavailable" : value.toFixed(2);
}

export function formatPercent(value: number | null) {
  return value == null ? "Unavailable" : `${Math.round(value)}%`;
}

export function formatScore(value: number | null) {
  return value == null ? "Unavailable" : `${Math.round(value)}`;
}

export function scoreToLabel(score: number | null): string {
  if (score == null) return "Unavailable";
  if (score >= 80) return "Easy";
  if (score >= 65) return "Above avg";
  if (score >= 50) return "Average";
  if (score >= 35) return "Tough";
  return "Hard";
}

export function confidenceToLabel(confidence: number): string {
  if (confidence >= 75) return "High";
  if (confidence >= 50) return "Medium";
  return "Low";
}

export function formatRating(value: number | null) {
  return value == null ? "Unavailable" : value.toFixed(1);
}

export function formatCoverageTier(tier: string) {
  switch (tier) {
    case "institutional_plus_rmp":
      return "Institutional + RMP";
    case "institutional_only":
      return "Institutional Only";
    case "rmp_only":
      return "RMP Only";
    default:
      return tier;
  }
}

export function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatSignedDelta(
  value: number | null,
  formatter: (value: number) => string,
) {
  if (value == null) {
    return "Unavailable";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${prefix}${formatter(Math.abs(value))}`;
}
