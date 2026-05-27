import { sql } from "@vercel/postgres";

export { sql };

export function currentSeason(date = new Date()): "spring" | "early_summer" | "summer" | "autumn" | "winter" {
  const m = date.getMonth() + 1;
  if (m === 3 || m === 4 || m === 5) return "spring";
  if (m === 6) return "early_summer";
  if (m === 7 || m === 8) return "summer";
  if (m === 9 || m === 10 || m === 11) return "autumn";
  return "winter";
}

export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
