/**
 * Client HTTP vers le backend FastAPI.
 * Chaque requête passe l'UUID Supabase dans le header X-User-Id.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function request<T>(
  path: string,
  options: RequestInit & { userId?: string } = {}
): Promise<T> {
  const { userId, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${BASE}${path}`, { ...fetchOptions, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Erreur réseau");
  }
  return res.json();
}

// ── Wearable ──────────────────────────────────────────────────────────────────

export function syncWearable(userId: string, data: object) {
  return request("/api/wearable/sync", {
    method: "POST",
    userId,
    body: JSON.stringify(data),
  });
}

// ── Programme ─────────────────────────────────────────────────────────────────

export function generateProgram(userId: string, weekNumber: number, weekStart: string, weekSchedule?: object[]) {
  return request("/api/program/generate", {
    method: "POST",
    userId,
    body: JSON.stringify({
      user_id: userId,
      week_number: weekNumber,
      week_start: weekStart,
      week_schedule: weekSchedule ?? [],
    }),
  });
}

export function getCurrentProgram(userId: string) {
  return request("/api/program/current", { userId });
}

// ── Snacks ────────────────────────────────────────────────────────────────────

export function listSnacks(params?: { duration?: number; context?: string; category?: string }) {
  const qs = new URLSearchParams();
  if (params?.duration)  qs.set("duration",  String(params.duration));
  if (params?.context)   qs.set("context",   params.context);
  if (params?.category)  qs.set("category",  params.category);
  const query = qs.toString() ? `?${qs}` : "";
  return request<any[]>(`/api/snacks${query}`);
}

export function recommendedSnacks(userId: string) {
  return request<any[]>("/api/snacks/recommended", { userId });
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export function submitFeedback(userId: string, sessionId: string, data: object) {
  return request(`/api/feedback/${sessionId}`, {
    method: "POST",
    userId,
    body: JSON.stringify(data),
  });
}
