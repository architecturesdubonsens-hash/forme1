"""
Route : synchronisation des données Apple Watch via Raccourci iOS.
POST /api/wearable/sync
"""
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException

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
