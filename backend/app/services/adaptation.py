"""
Moteur d'adaptation — analyse le feedback et les données wearable
sur 2–4 semaines pour ajuster le programme suivant.

Logique :
  - Sur-entraînement détecté → réduction volume -15%, intensité -1 cran
  - Stagnation détectée → augmentation volume +10% ou variation d'exercices
  - Progression normale → application règle des +10% max/semaine
  - Douleur signalée → suppression exercice + substitution
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


@dataclass
class AdaptationSignals:
    avg_rpe: float = 6.0          # RPE moyen (1–10)
    avg_energy: float = 3.0       # Énergie moyenne (1–5)
    pain_reports: int = 0         # Nombre de séances avec douleur
    pain_locations: list[str] = field(default_factory=list)
    completion_rate: float = 1.0  # Taux de complétion des séances (0–1)
    hrv_trend: float = 0.0        # Tendance HRV : positif = amélioration
    recovery_avg: float = 60.0    # Score récupération moyen (0–100)
    sessions_done: int = 0
    sessions_planned: int = 0


def compute_signals(
    feedback_list: list[dict],
    wearable_list: list[dict],
    sessions_planned: int,
) -> AdaptationSignals:
    """Calcule les signaux d'adaptation à partir des données brutes."""
    if not feedback_list:
        return AdaptationSignals(sessions_planned=sessions_planned)

    rpes    = [f["rpe_actual"]    for f in feedback_list if f.get("rpe_actual")]
    energies= [f["energy_level"]  for f in feedback_list if f.get("energy_level")]
    pains   = [f for f in feedback_list if f.get("pain_reported")]
    pain_locs = [loc for f in pains for loc in (f.get("pain_location") or [])]

    completed = sum(1 for f in feedback_list if f.get("completed_fully", True))

    # Tendance HRV : pente linéaire simplifiée sur les dernières valeurs
    hrv_values = [w["hrv_rmssd"] for w in wearable_list if w.get("hrv_rmssd")]
    hrv_trend = 0.0
    if len(hrv_values) >= 4:
        mid = len(hrv_values) // 2
        hrv_trend = (sum(hrv_values[:mid]) / mid) - (sum(hrv_values[mid:]) / (len(hrv_values) - mid))

    recovery_scores = [w["recovery_score"] for w in wearable_list if w.get("recovery_score")]

    return AdaptationSignals(
        avg_rpe=sum(rpes) / len(rpes) if rpes else 6.0,
        avg_energy=sum(energies) / len(energies) if energies else 3.0,
        pain_reports=len(pains),
        pain_locations=list(set(pain_locs)),
        completion_rate=completed / len(feedback_list),
        hrv_trend=hrv_trend,
        recovery_avg=sum(recovery_scores) / len(recovery_scores) if recovery_scores else 60.0,
        sessions_done=len(feedback_list),
        sessions_planned=sessions_planned,
    )


def detect_overtraining(signals: AdaptationSignals) -> bool:
    """Détecte un état de sur-entraînement."""
    return (
        signals.avg_rpe > 8.5
        or signals.avg_energy < 2.0
        or signals.recovery_avg < 35
        or (signals.hrv_trend < -5 and signals.avg_rpe > 7.5)
    )


def detect_stagnation(signals: AdaptationSignals, week_number: int) -> bool:
    """Détecte une stagnation (après la semaine 3 minimum)."""
    return (
        week_number >= 3
        and signals.avg_rpe < 5.5
        and signals.avg_energy >= 4.0
        and signals.completion_rate >= 0.9
    )


def volume_adjustment_factor(signals: AdaptationSignals) -> float:
    """
    Retourne un facteur multiplicateur pour le volume (sets × reps).
    Entre 0.7 (–30%) et 1.10 (+10%).
    """
    if detect_overtraining(signals):
        return 0.75
    if signals.recovery_avg < 45:
        return 0.90
    if signals.avg_rpe > 8.0:
        return 0.95
    if signals.avg_rpe < 5.5 and signals.avg_energy >= 4.0:
        return 1.08  # sous-stimulation → légère augmentation
    return 1.0


def intensity_adjustment(signals: AdaptationSignals) -> str:
    """Ajuste le niveau d'intensité général de la semaine."""
    if detect_overtraining(signals):
        return "low"
    if signals.recovery_avg < 45 or signals.avg_rpe > 8.0:
        return "moderate"
    if signals.avg_energy >= 4.5 and signals.recovery_avg >= 70:
        return "high"
    return "moderate"


async def generate_adaptation_notes(
    signals: AdaptationSignals,
    week_number: int,
    profile: dict,
) -> str:
    """
    Demande à Claude d'expliquer les ajustements de la semaine en 2–3 phrases,
    dans un ton de coach bienveillant.
    """
    overtraining = detect_overtraining(signals)
    stagnation   = detect_stagnation(signals, week_number)
    vol_factor   = volume_adjustment_factor(signals)

    context = f"""
Semaine {week_number} — Analyse d'adaptation pour {profile.get('first_name', 'l\'utilisateur')}.

Signaux :
- RPE moyen : {signals.avg_rpe:.1f}/10
- Énergie moyenne : {signals.avg_energy:.1f}/5
- Taux de complétion : {signals.completion_rate*100:.0f}%
- Score récupération moyen : {signals.recovery_avg:.0f}/100
- Douleurs signalées : {signals.pain_reports} séances ({', '.join(signals.pain_locations) or 'aucune zone'})
- Sur-entraînement détecté : {'OUI' if overtraining else 'non'}
- Stagnation détectée : {'OUI' if stagnation else 'non'}
- Ajustement volume : {vol_factor:.0%}

En 2–3 phrases maximum, explique au coach (ton bienveillant mais direct) :
1. Ce que montrent ces données
2. Ce qui va changer dans le programme cette semaine
3. Un conseil pratique concret

Commence directement par l'analyse, pas de formule de politesse.
"""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",  # haiku = rapide pour les notes courtes
        max_tokens=300,
        messages=[{"role": "user", "content": context}],
    )
    return response.content[0].text.strip()
