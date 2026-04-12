"""
Route : génération et consultation du programme d'entraînement.
POST /api/program/generate
GET  /api/program/current
"""
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from app.database import supabase
from app.models import ProgramGenerationRequest
from app.services.program_generator import generate_weekly_program

router = APIRouter(prefix="/api/program", tags=["program"])

_VALID_INTENSITIES = {"low", "moderate", "high", "max"}
_VALID_SESSION_TYPES = {"strength", "cardio", "hiit", "mobility", "mixed", "active_recovery"}

def _normalize_intensity(value: str) -> str:
    if value in _VALID_INTENSITIES:
        return value
    v = value.lower()
    if "max" in v:    return "max"
    if "high" in v:   return "high"
    if "low" in v:    return "low"
    return "moderate"

def _normalize_session_type(value: str) -> str:
    if value in _VALID_SESSION_TYPES:
        return value
    v = value.lower()
    if "hiit" in v:              return "hiit"
    if "cardio" in v:            return "cardio"
    if "strength" in v or "force" in v: return "strength"
    if "mobil" in v:             return "mobility"
    if "recov" in v or "actif" in v: return "active_recovery"
    return "mixed"


@router.post("/generate")
async def generate_program(
    req: ProgramGenerationRequest,
    x_user_id: UUID = Header(...),
):
    """
    Génère un programme hebdomadaire personnalisé via Claude.
    Récupère le profil et les dernières données wearable, puis appelle le moteur IA.
    """
    user_id = str(x_user_id)

    # Récupération du profil
    try:
        profile_res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Profil introuvable.")
    if not profile_res or not profile_res.data:
        raise HTTPException(status_code=404, detail="Profil introuvable.")
    profile = profile_res.data

    # Récupération des 7 derniers jours de données wearable
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
    wearable_res = (
        supabase.table("wearable_data")
        .select("*")
        .eq("user_id", user_id)
        .gte("date", seven_days_ago)
        .order("date", desc=True)
        .execute()
    )
    wearable_data = wearable_res.data or []

    # Génération via Claude
    sessions, generation_notes = await generate_weekly_program(
        profile=profile,
        wearable_recent=wearable_data,
        week_number=req.week_number,
        week_start=req.week_start,
    )

    # Calcul de la fin de semaine
    week_end = req.week_start + timedelta(days=6)

    # Désactiver les plans actifs précédents
    supabase.table("weekly_plans").update({"is_active": False}).eq("user_id", user_id).eq("is_active", True).execute()

    # Sauvegarde du plan
    plan_res = (
        supabase.table("weekly_plans")
        .insert({
            "user_id": user_id,
            "week_number": req.week_number,
            "week_start": req.week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "generation_notes": generation_notes,
            "is_active": True,
        })
        .execute()
    )
    plan_id = plan_res.data[0]["id"]

    # Sauvegarde des séances et exercices
    for session in sessions:
        session_res = (
            supabase.table("sessions")
            .insert({
                "plan_id": plan_id,
                "user_id": user_id,
                "scheduled_date": (req.week_start + timedelta(days=session.day_of_week)).isoformat(),
                "day_of_week": session.day_of_week,
                "session_type": _normalize_session_type(session.session_type),
                "title": session.title,
                "goal_summary": session.goal_summary,
                "estimated_duration_min": session.estimated_duration_min,
                "intensity_target": _normalize_intensity(session.intensity_target),
                "strategic_context": session.strategic_context,
                "objectives_targeted": session.objectives_targeted,
                "status": "planned",
            })
            .execute()
        )
        session_id = session_res.data[0]["id"]

        for i, ex in enumerate(session.exercises):
            supabase.table("session_exercises").insert({
                "session_id": session_id,
                "position": i,
                "block": ex.block,
                # On stocke les détails dans load_notes et cues — pas de FK exercises
                # pour le MVP (pas encore de bibliothèque complète)
                "name_fr": ex.name_fr,
                "demo_url": ex.demo_url,
                "cues": ex.cues,
                "sets": ex.sets,
                "reps_min": ex.reps_min,
                "reps_max": ex.reps_max,
                "duration_sec": ex.duration_sec,
                "rest_sec": ex.rest_sec,
                "rpe_target": ex.rpe_target,
                "load_notes": ex.load_notes,
            }).execute()

    return {
        "plan_id": plan_id,
        "week_start": req.week_start,
        "week_end": week_end,
        "sessions_count": len(sessions),
        "generation_notes": generation_notes,
        "sessions": [s.model_dump() for s in sessions],
    }


@router.get("/current")
async def get_current_program(x_user_id: UUID = Header(...)):
    """Retourne le programme actif avec toutes ses séances."""
    user_id = str(x_user_id)

    plan_res = (
        supabase.table("weekly_plans")
        .select("*, sessions(*, session_exercises(*))")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )

    if not plan_res or not plan_res.data:
        raise HTTPException(status_code=404, detail="Aucun programme actif.")

    return plan_res.data
