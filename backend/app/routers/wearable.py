"""
Routes : synchronisation et consultation des données Apple Watch.
POST /api/wearable/sync
GET  /api/wearable/today
GET  /api/wearable/history
GET  /api/wearable/shortcut
"""
from datetime import date, timedelta
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import Response

from app.database import supabase
from app.models import WearableSync, WearableRead
from app.services.recovery import compute_recovery_score

router = APIRouter(prefix="/api/wearable", tags=["wearable"])


@router.post("/sync", response_model=WearableRead)
async def sync_wearable(
    data: WearableSync,
    x_user_id: UUID = Header(..., description="UUID Supabase de l'utilisateur"),
):
    """
    Reçoit les données quotidiennes de l'Apple Watch envoyées par le Raccourci iOS.
    Calcule le score de récupération et persiste en base.
    """
    recovery_score = compute_recovery_score(data)

    payload = {
        "user_id": str(x_user_id),
        "date": data.date.isoformat(),
        "resting_hr": data.resting_hr,
        "hrv_rmssd": float(data.hrv_rmssd) if data.hrv_rmssd else None,
        "sleep_duration_min": data.sleep_duration_min,
        "sleep_quality": data.sleep_quality,
        "active_calories": data.active_calories,
        "steps": data.steps,
        "recovery_score": recovery_score,
    }

    result = (
        supabase.table("wearable_data")
        .upsert(payload, on_conflict="user_id,date")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde des données.")

    return WearableRead(**result.data[0])


@router.get("/today", response_model=Optional[WearableRead])
async def get_today(
    x_user_id: UUID = Header(..., description="UUID Supabase de l'utilisateur"),
):
    """Retourne les données wearable du jour, ou null si non synchronisées."""
    today = date.today().isoformat()
    result = (
        supabase.table("wearable_data")
        .select("*")
        .eq("user_id", str(x_user_id))
        .eq("date", today)
        .execute()
    )
    if not result.data:
        return None
    return WearableRead(**result.data[0])


@router.get("/history", response_model=list[WearableRead])
async def get_history(
    x_user_id: UUID = Header(..., description="UUID Supabase de l'utilisateur"),
    days: int = Query(default=7, ge=1, le=30, description="Nombre de jours d'historique"),
):
    """Retourne les N derniers jours de données wearable (plus récent en premier)."""
    since = (date.today() - timedelta(days=days - 1)).isoformat()
    result = (
        supabase.table("wearable_data")
        .select("*")
        .eq("user_id", str(x_user_id))
        .gte("date", since)
        .order("date", desc=True)
        .execute()
    )
    return [WearableRead(**row) for row in (result.data or [])]


@router.get("/shortcut")
async def download_shortcut(
    user_id: str = Query(..., description="UUID Supabase de l'utilisateur"),
    backend_url: str = Query(..., description="URL de base du backend"),
):
    """
    Génère et retourne un fichier .shortcut iOS prêt à importer.
    Ouvrir ce lien depuis Safari sur iPhone l'importe directement
    dans l'app Raccourcis (nécessite 'Autoriser les raccourcis non fiables').
    """
    try:
        UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID invalide.")

    from app.services.shortcut_generator import generate_shortcut_plist
    data = generate_shortcut_plist(user_id=user_id, backend_url=backend_url)

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": 'attachment; filename="Forme1-AppleWatch.shortcut"',
            "Cache-Control": "no-store",
        },
    )
