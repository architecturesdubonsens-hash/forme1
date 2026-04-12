"""
Modèles Pydantic — miroir du schéma SQL, utilisés pour valider
les entrées/sorties de l'API.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ── Profil ──────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    first_name: Optional[str] = None
    birth_year: Optional[int] = Field(None, ge=1930, le=2010)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    weight_kg: Optional[float] = Field(None, gt=0, le=300)
    height_cm: Optional[int] = Field(None, gt=0, le=250)
    fitness_level: str = "light"
    goal_fat_loss: int = Field(25, ge=0, le=100)
    goal_muscle: int = Field(25, ge=0, le=100)
    goal_mobility: int = Field(25, ge=0, le=100)
    goal_vo2max: int = Field(25, ge=0, le=100)
    sessions_per_week: int = Field(4, ge=1, le=7)
    session_duration_min: int = Field(60, ge=20, le=180)
    equipment: list[str] = []
    medical_notes: Optional[str] = None
    injury_history: list[str] = []

class ProfileRead(ProfileCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Données wearable ─────────────────────────────────────────────────────────

class WearableSync(BaseModel):
    """Payload envoyé par le Raccourci iOS chaque matin."""
    date: date
    resting_hr: Optional[int] = Field(None, ge=30, le=200)
    hrv_rmssd: Optional[float] = Field(None, ge=0, le=200)
    sleep_duration_min: Optional[int] = Field(None, ge=0, le=960)
    sleep_quality: Optional[int] = Field(None, ge=1, le=5)
    active_calories: Optional[int] = Field(None, ge=0)
    steps: Optional[int] = Field(None, ge=0)

class WearableRead(WearableSync):
    id: UUID
    user_id: UUID
    synced_at: datetime
    recovery_score: Optional[int] = None


# ── Séance ───────────────────────────────────────────────────────────────────

class SessionRead(BaseModel):
    id: UUID
    scheduled_date: date
    session_type: str
    title: str
    goal_summary: Optional[str]
    estimated_duration_min: Optional[int]
    intensity_target: str
    status: str


# ── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    rpe_actual: int = Field(..., ge=1, le=10)
    energy_level: int = Field(..., ge=1, le=5)
    motivation_score: int = Field(..., ge=1, le=5)
    pain_reported: bool = False
    pain_location: list[str] = []
    pain_severity: Optional[int] = Field(None, ge=1, le=5)
    completed_fully: bool = True
    skipped_exercises: list[UUID] = []
    notes: Optional[str] = None


# ── Génération de programme ───────────────────────────────────────────────────

class ProgramGenerationRequest(BaseModel):
    """Paramètres envoyés au moteur IA pour générer une semaine de programme."""
    user_id: UUID
    week_number: int = 1
    week_start: date

class GeneratedSession(BaseModel):
    """Une séance dans le programme généré par Claude."""
    day_of_week: int = Field(..., ge=0, le=6)   # 0=dimanche
    session_type: str
    title: str
    goal_summary: str
    estimated_duration_min: int
    intensity_target: str
    strategic_context: Optional[str] = None       # pourquoi cette séance aujourd'hui ?
    objectives_targeted: list[str] = []           # ['muscle', 'fat_loss', ...]
    exercises: list[GeneratedExercise]

class GeneratedExercise(BaseModel):
    name_fr: str
    block: str                         # warmup | main | cooldown
    sets: Optional[int] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    duration_sec: Optional[int] = None
    rest_sec: Optional[int] = None
    rpe_target: Optional[int] = None
    load_notes: Optional[str] = None
    demo_url: Optional[str] = None
    cues: list[str] = []

# Résolution des références circulaires
GeneratedSession.model_rebuild()
