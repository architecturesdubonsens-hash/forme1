"""
Routes micro-activités (snack fitness).
GET /api/snacks              — liste filtrée
GET /api/snacks/recommended  — suggestions cohérentes avec la séance du jour
"""
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from app.database import supabase

router = APIRouter(prefix="/api/snacks", tags=["snacks"])

# Catégories complémentaires selon le type de séance
_COMPLEMENTARY: dict[str, list[str]] = {
    "strength":        ["mobility", "stretching", "breathing"],
    "cardio":          ["stretching", "breathing", "mobility"],
    "hiit":            ["stretching", "mobility", "breathing"],
    "mobility":        ["strength", "breathing"],
    "active_recovery": ["breathing", "stretching", "mobility"],
    "mixed":           ["mobility", "breathing", "stretching"],
}


@router.get("")
async def list_snacks(
    duration: Optional[int] = None,
    context: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Retourne les snacks actifs, avec filtres optionnels.
    - duration : 5 | 10 | 15 | 20
    - context  : office | home | travel | hotel | any
    - category : mobility | strength | cardio | posture | breathing | stretching
    """
    query = supabase.table("snack_activities").select("*").eq("is_active", True)

    if duration:
        query = query.eq("duration_min", duration)
    if category:
        query = query.eq("category", category)

    result = query.order("duration_min").execute()
    data = result.data or []

    # Filtrage contextuel côté Python (les tableaux Postgres ne sont pas facilement
    # filtrables avec l'opérateur contains via PostgREST sans extension)
    if context and context != "all":
        data = [
            s for s in data
            if context in (s.get("contexts") or [])
            or "any" in (s.get("contexts") or [])
        ]

    return data


@router.get("/recommended")
async def recommended_snacks(x_user_id: UUID = Header(...)):
    """
    Retourne 4 snacks recommandés en fonction de la séance prévue aujourd'hui.
    Si aucune séance aujourd'hui, retourne un mix mobilité + respiration.
    """
    user_id = str(x_user_id)
    today = date.today().isoformat()

    # Cherche la séance planifiée aujourd'hui
    session_res = (
        supabase.table("sessions")
        .select("session_type")
        .eq("user_id", user_id)
        .eq("scheduled_date", today)
        .limit(1)
        .execute()
    )
    session_type = None
    if session_res.data:
        session_type = session_res.data[0].get("session_type")

    preferred_cats = _COMPLEMENTARY.get(session_type or "", ["mobility", "breathing"])

    results: list[dict] = []
    seen_ids: set[str] = set()

    for cat in preferred_cats[:3]:
        r = (
            supabase.table("snack_activities")
            .select("*")
            .eq("is_active", True)
            .eq("category", cat)
            .limit(2)
            .execute()
        )
        for item in r.data or []:
            if item["id"] not in seen_ids:
                results.append(item)
                seen_ids.add(item["id"])
        if len(results) >= 4:
            break

    return results[:4]
