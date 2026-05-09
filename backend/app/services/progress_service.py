"""
Calcul des métriques de progression à partir des séances complétées et du feedback.
Appelé après chaque soumission de feedback.
"""
import logging
from app.database import supabase

log = logging.getLogger(__name__)

_TYPE_AXES: dict[str, dict[str, float]] = {
    "strength":        {"muscle": 10, "fat_loss": 4},
    "cardio":          {"vo2max": 10, "fat_loss": 6},
    "hiit":            {"vo2max": 8,  "fat_loss": 8},
    "mobility":        {"mobility": 10},
    "mixed":           {"muscle": 5,  "vo2max": 5, "fat_loss": 4, "mobility": 4},
    "active_recovery": {"mobility": 3, "vo2max": 2},
}

_MAX_RAW = 200.0


def _quality(rpe: int | None, energy: int | None) -> float:
    rpe    = rpe    or 6
    energy = energy or 3
    rpe_factor    = 1.0 if 5 <= rpe <= 8 else (0.9 if rpe > 8 else 0.85)
    energy_factor = 0.8 + (energy / 5) * 0.4
    return round(rpe_factor * energy_factor, 3)


def compute_and_save_progress(user_id: str) -> None:
    try:
        # 1 — Profil
        prof = (
            supabase.table("profiles")
            .select("goal_fat_loss, goal_muscle, goal_mobility, goal_vo2max")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        ).data or {}
        weights = {
            "fat_loss": (prof.get("goal_fat_loss") or 25) / 100,
            "muscle":   (prof.get("goal_muscle")   or 25) / 100,
            "vo2max":   (prof.get("goal_vo2max")   or 25) / 100,
            "mobility": (prof.get("goal_mobility") or 25) / 100,
        }

        # 2 — Séances complétées
        sessions = (
            supabase.table("sessions")
            .select("id, session_type")
            .eq("user_id", user_id)
            .in_("status", ["completed", "modified"])
            .execute()
        ).data or []
        sessions_done = len(sessions)
        if not sessions:
            return

        # 3 — Feedback (requête séparée pour éviter les problèmes de jointure)
        session_ids = [s["id"] for s in sessions]
        fb_rows = (
            supabase.table("session_feedback")
            .select("session_id, rpe_actual, energy_level")
            .in_("session_id", session_ids)
            .execute()
        ).data or []
        fb_map = {f["session_id"]: f for f in fb_rows}

        # 4 — Accumulation points bruts
        raw: dict[str, float] = {"fat_loss": 0.0, "muscle": 0.0, "vo2max": 0.0, "mobility": 0.0}
        for s in sessions:
            stype = s.get("session_type") or "mixed"
            axes  = _TYPE_AXES.get(stype, _TYPE_AXES["mixed"])
            fb    = fb_map.get(s["id"])
            q     = _quality(fb.get("rpe_actual") if fb else None,
                             fb.get("energy_level") if fb else None)
            for axis, pts in axes.items():
                raw[axis] += pts * q

        # 5 — Normalisation 0-100
        scores: dict[str, int] = {}
        for axis, r in raw.items():
            w   = weights[axis]
            val = min(100.0, (r / _MAX_RAW) * 100 * (1 + w))
            scores[axis] = round(val)
        score_overall = round(sum(scores.values()) / 4)

        # 6 — Semaine courante
        plan = (
            supabase.table("weekly_plans")
            .select("week_number")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        ).data or {}
        week_number = plan.get("week_number") or 1

        # 7 — Upsert
        supabase.table("progress_metrics").upsert(
            {
                "user_id":        user_id,
                "week_number":    week_number,
                "sessions_done":  sessions_done,
                "score_fat_loss": scores["fat_loss"],
                "score_muscle":   scores["muscle"],
                "score_vo2max":   scores["vo2max"],
                "score_mobility": scores["mobility"],
                "score_overall":  score_overall,
            },
            on_conflict="user_id,week_number",
        ).execute()

        log.info("progress_metrics mis à jour : user=%s scores=%s", user_id, scores)

    except Exception as e:
        log.error("Erreur calcul progression user=%s : %s", user_id, e)
