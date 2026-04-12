"""
Routes : défis personnalisés.
GET  /api/challenges          — liste des défis de l'utilisateur
POST /api/challenges/suggest  — génère 3 suggestions IA
POST /api/challenges          — crée un défi (suggestion ou custom)
PATCH /api/challenges/{id}/milestone — marque un jalon comme fait
PATCH /api/challenges/{id}/complete  — marque le défi comme accompli
"""
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import supabase
from app.services.challenge_generator import suggest_challenges, generate_challenge_custom

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    emoji: str = "🎯"
    challenge_type: str
    target_description: str
    target_metrics: dict = {}
    start_date: date
    target_date: date
    milestones: list[dict] = []
    domains: list[str] = []
    generation_notes: Optional[str] = None


class CustomChallengeRequest(BaseModel):
    challenge_type: str
    hint: str
    duration_weeks: int = 8


@router.get("")
async def list_challenges(x_user_id: UUID = Header(...)):
    res = (
        supabase.table("challenges")
        .select("*")
        .eq("user_id", str(x_user_id))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/suggest")
async def suggest(x_user_id: UUID = Header(...)):
    """Génère 3 propositions de défis IA adaptées au profil."""
    profile_res = supabase.table("profiles").select("*").eq("id", str(x_user_id)).single().execute()
    if not profile_res.data:
        raise HTTPException(404, "Profil introuvable.")

    # Semaine courante
    plan_res = supabase.table("weekly_plans").select("week_number").eq("user_id", str(x_user_id)).eq("is_active", True).single().execute()
    current_week = plan_res.data["week_number"] if plan_res.data else 1

    suggestions = await suggest_challenges(profile_res.data, current_week)
    return suggestions


@router.post("/custom")
async def create_custom(req: CustomChallengeRequest, x_user_id: UUID = Header(...)):
    """Génère un défi sur mesure à partir d'une indication."""
    profile_res = supabase.table("profiles").select("*").eq("id", str(x_user_id)).single().execute()
    if not profile_res.data:
        raise HTTPException(404, "Profil introuvable.")

    ch = await generate_challenge_custom(profile_res.data, req.challenge_type, req.hint, req.duration_weeks)
    return ch


@router.post("")
async def create_challenge(data: ChallengeCreate, x_user_id: UUID = Header(...)):
    """Persiste un défi (issu des suggestions ou custom)."""
    res = supabase.table("challenges").insert({
        "user_id": str(x_user_id),
        "title": data.title,
        "description": data.description,
        "emoji": data.emoji,
        "challenge_type": data.challenge_type,
        "target_description": data.target_description,
        "target_metrics": data.target_metrics,
        "start_date": data.start_date.isoformat(),
        "target_date": data.target_date.isoformat(),
        "milestones": data.milestones,
        "domains": data.domains,
        "generation_notes": data.generation_notes,
        "status": "active",
    }).execute()
    return res.data[0]


@router.patch("/{challenge_id}/milestone")
async def toggle_milestone(
    challenge_id: UUID,
    payload: dict,
    x_user_id: UUID = Header(...),
):
    """
    Marque ou démarque un jalon comme accompli.
    Body: {"week": 3, "done": true}
    """
    ch_res = supabase.table("challenges").select("milestones").eq("id", str(challenge_id)).eq("user_id", str(x_user_id)).single().execute()
    if not ch_res.data:
        raise HTTPException(404, "Défi introuvable.")

    milestones = ch_res.data["milestones"] or []
    week = payload.get("week")
    done = payload.get("done", True)

    updated = [
        {**m, "done": done} if m.get("week") == week else m
        for m in milestones
    ]

    supabase.table("challenges").update({"milestones": updated}).eq("id", str(challenge_id)).execute()
    return {"milestones": updated}


@router.patch("/{challenge_id}/complete")
async def complete_challenge(
    challenge_id: UUID,
    payload: dict,
    x_user_id: UUID = Header(...),
):
    """Marque un défi comme accompli ou abandonné."""
    status = payload.get("status", "completed")
    supabase.table("challenges").update({
        "status": status,
        "completed_at": "now()",
        "completion_notes": payload.get("notes"),
    }).eq("id", str(challenge_id)).eq("user_id", str(x_user_id)).execute()
    return {"status": status}
