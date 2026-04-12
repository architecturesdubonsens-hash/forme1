"""
Calcul du score de récupération (0–100) à partir des données Apple Watch.
Basé sur : HRV (poids 50%), FC repos (30%), qualité sommeil (20%).
"""
from app.models import WearableSync


def compute_recovery_score(data: WearableSync) -> int | None:
    """
    Retourne un score de récupération entre 0 et 100, ou None si les données
    sont insuffisantes pour calculer (moins de 2 métriques disponibles).

    Interprétation :
      0–39  → Récupération faible  → séance légère ou repos actif
      40–69 → Récupération normale → programme standard
      70–89 → Bonne récupération   → peut hausser l'intensité
      90–100→ Excellente           → séance haute intensité possible
    """
    scores: list[float] = []
    weights: list[float] = []

    # HRV : score normalisé sur une échelle 20–100 ms (typique adulte sain)
    if data.hrv_rmssd is not None:
        hrv_score = _normalize(data.hrv_rmssd, low=20, high=80)
        scores.append(hrv_score)
        weights.append(0.50)

    # FC repos : inversée — plus elle est basse, mieux c'est (40–80 bpm)
    if data.resting_hr is not None:
        hr_score = _normalize(data.resting_hr, low=40, high=80, invert=True)
        scores.append(hr_score)
        weights.append(0.30)

    # Sommeil : qualité 1–5 convertie en 0–100
    if data.sleep_quality is not None:
        sleep_score = (data.sleep_quality - 1) / 4 * 100
        scores.append(sleep_score)
        weights.append(0.20)

    if len(scores) < 2:
        return None

    # Moyenne pondérée normalisée
    total_weight = sum(weights)
    weighted = sum(s * w for s, w in zip(scores, weights)) / total_weight
    return max(0, min(100, round(weighted)))


def _normalize(value: float, low: float, high: float, invert: bool = False) -> float:
    """Normalise une valeur entre [low, high] vers [0, 100]."""
    clamped = max(low, min(high, value))
    score = (clamped - low) / (high - low) * 100
    return 100 - score if invert else score
