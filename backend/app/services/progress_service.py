"""
Calcul des métriques de progression à partir des séances complétées et du feedback.
Appelé après chaque soumission de feedback.
"""
from app.database import supabase

# Points bruts par type de séance et par axe
_TYPE_AXES: dict[str, dict[str, float]] = {
    "strength":        {"muscle": 10, "fat_loss": 4},
    "cardio":          {"vo2max": 10, "fat_loss": 6},
    "hiit":            {"vo2max": 8,  "fat_loss": 8},
    "mobility":        {"mobility": 10},
    "mixed":           {"muscle": 5,  "vo2max": 5, "fat_loss": 4, "mobility": 4},
    "active_recovery": {"mobility": 3, "vo2max": 2},
}

# Points max attendus en fin de cycle (~20 séances typiques)
_MAX_RAW = 200.0


def _quality_multiplier(feedback_row: dict | None) -> float:
    """0.8 à 1.2 selon RPE + niveau d'énergie."""
    if not feedback_row:
        return 1.0
    rpe    = feedback_row.get("rpe_actual", 6) or 6
    energy = feedback_row.get("energy_level", 3) or 3
    # RPE 6-8 idéal → bonus ; énergie haute → bonus
    rpe_factor    = 1.0 if 5 <= rpe <= 8 else (0.9 if rpe > 8 else 0.85)
    energy_factor = 0.8 + (energy / 5) * 0.4   # 0.80 … 1.20
    return round(rpe_factor * energy_factor, 3)


def compute_and_save_progress(user_id: str) -> None:
    """Recalcule les métriques de la semaine courante et les upserte."""

    # 1 — Profil (poids des objectifs)
    prof_res = (
        supabase.table("profiles")
        .select("goal_fat_loss, goal_muscle, goal_mobility, goal_vo2max")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    prof = prof_res.data or {}
    weights = {
        "fat_loss": (prof.get("goal_fat_loss") or 25) / 100,
        "muscle":   (prof.get("goal_muscle")   or 25) / 100,
        "vo2max":   (prof.get("goal_vo2max")   or 25) / 100,
        "mobility": (prof.get("goal_mobility") or 25) / 100,
    }

    # 2 — Toutes les séances complétées (avec leur feedback si disponible)
    sess_res = (
        supabase.table("sessions")
        .select("session_type, session_feedback(rpe_actual, energy_level)")
        .eq("user_id", user_id)
        .in_("status", ["completed", "modified"])
        .execute()
    )
    sessions = sess_res.data or []
    sessions_done = len(sessions)

    # 3 — Accumulation des points bruts
    raw: dict[str, float] = {"fat_loss": 0, "muscle": 0, "vo2max": 0, "mobility": 0}
    for s in sessions:
        stype  = s.get("session_type", "mixed") or "mixed"
        axes   = _TYPE_AXES.get(stype, _TYPE_AXES["mixed"])
        fb_list = s.get("session_feedback") or []
        fb     = fb_list[0] if fb_list else None
        q      = _quality_multiplier(fb)
        for axis, pts in axes.items():
            raw[axis] += pts * q

    # 4 — Normalisation 0-100 avec pondération objectif
    #     Un axe prioritaire (poids 0.40) progresse ~1.4× plus vite
    scores: dict[str, int] = {}
    for axis, r in raw.items():
        w = weights[axis]
        val = min(100.0, (r / _MAX_RAW) * 100 * (1 + w))
        scores[axis] = round(val)

    score_overall = round(sum(scores.values()) / 4)

    # 5 — Semaine courante
    plan_res = (
        supabase.table("weekly_plans")
        .select("week_number")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    week_number = (plan_res.data or {}).get("week_number", 1) or 1

    # 6 — Upsert
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
