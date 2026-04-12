"""
Route : soumission du feedback post-séance.
POST /api/feedback/{session_id}
"""
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException

from app.database import supabase
from app.models import FeedbackCreate

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/{session_id}")
async def submit_feedback(
    session_id: UUID,
    feedback: FeedbackCreate,
    x_user_id: UUID = Header(...),
):
    """
    Enregistre le feedback post-séance et marque la séance comme complétée.
    """
    user_id = str(x_user_id)

    # Vérifier que la séance appartient à l'utilisateur
    session_res = (
        supabase.table("sessions")
        .select("id, status")
        .eq("id", str(session_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Séance introuvable.")

    # Upsert feedback
    supabase.table("session_feedback").upsert({
        "session_id": str(session_id),
        "user_id": user_id,
        "rpe_actual": feedback.rpe_actual,
        "energy_level": feedback.energy_level,
        "motivation_score": feedback.motivation_score,
        "pain_reported": feedback.pain_reported,
        "pain_location": feedback.pain_location,
        "pain_severity": feedback.pain_severity,
        "completed_fully": feedback.completed_fully,
        "skipped_exercises": [str(e) for e in feedback.skipped_exercises],
        "notes": feedback.notes,
    }, on_conflict="session_id").execute()

    # Marquer la séance complétée (ou modifiée si des exercices ont été sautés)
    new_status = "completed" if feedback.completed_fully else "modified"
    supabase.table("sessions").update({
        "status": new_status,
        "completed_at": "now()",
    }).eq("id", str(session_id)).execute()

    return {"status": "ok", "session_status": new_status}
