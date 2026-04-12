"""
Moteur de génération de programme d'entraînement via Claude API.
Utilise le prompt caching pour réduire les coûts sur le contexte scientifique.
"""
import json
from datetime import date
from uuid import UUID

import anthropic

from app.config import settings
from app.models import GeneratedSession, ProgramGenerationRequest

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# ── Contexte scientifique (mis en cache) ─────────────────────────────────────
# Ce bloc est envoyé une fois puis caché par Anthropic pendant 5 minutes.
# Il représente la "base de connaissances" physiologiques de l'app.

SCIENTIFIC_CONTEXT = """
Tu es un coach sportif expert en physiologie de l'exercice, spécialisé dans
la prise en charge des adultes de 45 ans et plus. Tes recommandations sont
fondées sur la littérature scientifique récente dans les domaines suivants :

## Références scientifiques clés

### Composition corporelle & graisse viscérale
- Le HIIT (High-Intensity Interval Training) réduit la graisse viscérale plus
  efficacement que le cardio continu à intensité modérée (MICT) à dépense
  calorique équivalente (Maillard et al., 2018 — Obesity Reviews).
- La combinaison musculation + cardio Zone 2 est optimale pour la perte de
  graisse viscérale tout en préservant la masse maigre.
- Le déficit calorique modéré (≤500 kcal/j) protège la masse musculaire.

### Sarcopénie & développement musculaire après 50 ans
- Le seuil de stimulation protéique est plus élevé chez les seniors :
  0,4 g/kg de protéines par repas minimum pour une synthèse protéique optimale
  (Moore et al., 2015).
- La progression de charge (progressive overload) reste le stimulus principal,
  même à intensité modérée (≥60% 1RM suffisant si volume adéquat).
- Fréquence optimale : 2–3x/semaine par groupe musculaire.
- Les exercices multi-articulaires (squat, deadlift, tirage) sont prioritaires.

### VO2max
- L'entraînement polarisé (80% faible intensité / 20% haute intensité)
  est le plus efficace pour améliorer le VO2max (Seiler, 2010).
- Les intervalles à 90–95% FCmax (4x4 min) augmentent le VO2max de 10–15%
  en 8 semaines (Wisløff et al., Gjøvaag — études HUNT).
- La Zone 2 (60–70% FCmax) améliore la biogenèse mitochondriale.

### Mobilité fonctionnelle
- La mobilité active (FRC — Functional Range Conditioning) est supérieure aux
  étirements passifs pour les gains durables.
- CARs (Controlled Articular Rotations) quotidiens : 5–10 min suffisent.
- La mobilité doit être travaillée dans les amplitudes d'utilisation réelle.

### Récupération & surmenage
- HRV (variabilité de la fréquence cardiaque) : marqueur fiable de l'état
  du système nerveux autonome. Baisse de >10% sur 3 jours = signal d'alerte.
- Rapport stimulus/récupération : ne jamais augmenter le volume de plus de
  10% par semaine (règle des 10%).
- Semaine de décharge toutes les 4–6 semaines : réduction de 40–50% du volume.

## Principes de programmation

### Périodisation
- Phase BASE (sem 1–4) : technique, volume modéré, intensité basse-modérée
- Phase BUILD (sem 5–8) : augmentation progressive volume + intensité
- Phase PEAK (sem 9–10) : intensité haute, volume réduit
- Phase DELOAD (sem 11) : récupération, volume -50%

### Équilibre progression / conservatisme
- Priorité absolue : ne pas se blesser
- Progressions hebdomadaires : +5% charge OU +1 série OU -5s repos (jamais les 3)
- Si douleur > 3/10 : retirer l'exercice, proposer alternative
- Si RPE feedback > 8.5 sur 2 séances consécutives : réduire l'intensité

### Structure d'une séance type
1. Échauffement général (5–8 min) : mobilisation articulaire + élévation FC
2. Activation (5 min) : activation musculaire spécifique à la séance
3. Travail principal (30–45 min)
4. Retour au calme (5–10 min) : étirements, respiration
"""


def _build_user_context(profile: dict, wearable_recent: list[dict]) -> str:
    """Construit le contexte utilisateur personnalisé pour le prompt."""
    age = date.today().year - profile.get("birth_year", 1970)
    recovery = None
    if wearable_recent:
        scores = [w["recovery_score"] for w in wearable_recent if w.get("recovery_score")]
        if scores:
            recovery = round(sum(scores) / len(scores))

    lines = [
        f"## Profil utilisateur",
        f"- Âge : {age} ans",
        f"- Poids : {profile.get('weight_kg', '?')} kg, Taille : {profile.get('height_cm', '?')} cm",
        f"- Niveau de forme : {profile.get('fitness_level', 'light')}",
        f"- Séances disponibles : {profile.get('sessions_per_week', 4)}/semaine",
        f"- Durée préférée : {profile.get('session_duration_min', 60)} min",
        f"- Équipement : {', '.join(profile.get('equipment', [])) or 'aucun (poids de corps)'}",
        f"",
        f"## Objectifs pondérés",
        f"- Perte de graisse viscérale : {profile.get('goal_fat_loss', 25)}%",
        f"- Masse musculaire (anti-sarcopénie) : {profile.get('goal_muscle', 25)}%",
        f"- Mobilité fonctionnelle : {profile.get('goal_mobility', 25)}%",
        f"- VO2max : {profile.get('goal_vo2max', 25)}%",
    ]

    if profile.get("medical_notes"):
        lines.append(f"- Notes médicales : {profile['medical_notes']}")
    if profile.get("injury_history"):
        lines.append(f"- Historique blessures : {', '.join(profile['injury_history'])}")

    if recovery is not None:
        lines += [
            f"",
            f"## Récupération actuelle",
            f"- Score de récupération moyen (7 derniers jours) : {recovery}/100",
            f"- {'Récupération faible → programme conservateur cette semaine' if recovery < 40 else 'Récupération normale → programme standard' if recovery < 70 else 'Bonne récupération → intensité peut être augmentée'}",
        ]

    return "\n".join(lines)


async def generate_weekly_program(
    profile: dict,
    wearable_recent: list[dict],
    week_number: int,
    week_start: date,
) -> list[GeneratedSession]:
    """
    Génère un programme hebdomadaire complet via Claude.
    Retourne une liste de séances structurées.
    """
    user_context = _build_user_context(profile, wearable_recent)
    sessions_count = profile.get("sessions_per_week", 4)
    duration = profile.get("session_duration_min", 60)

    user_prompt = f"""
{user_context}

## Ta tâche

Génère exactement {sessions_count} séances d'entraînement pour la semaine {week_number}
(du {week_start.strftime('%d/%m/%Y')}).

Chaque séance doit :
- Durer environ {duration} minutes
- Être adaptée à l'équipement et au niveau de l'utilisateur
- Comporter 3 blocs : échauffement, travail principal, retour au calme
- Inclure pour chaque exercice : sets, reps/durée, RPE cible, note de charge (max 6 mots), 2 cues max (max 5 mots chacun), demo_url : URL de recherche YouTube du mouvement (ex: "https://www.youtube.com/results?search_query=squat+technique+form")
- Avoir un champ "strategic_context" : 1 phrase courte (max 15 mots)
- Avoir un champ "objectives_targeted" (liste parmi : fat_loss, muscle, vo2max, mobility)

Respecte la répartition des objectifs pondérés pour l'ensemble de la semaine.

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, au format :
{{
  "sessions": [
    {{
      "day_of_week": 1,
      "session_type": "strength",
      "title": "...",
      "goal_summary": "...",
      "estimated_duration_min": 60,
      "intensity_target": "moderate",
      "strategic_context": "Cette séance de force en début de semaine exploite votre meilleure récupération. Elle cible les chaînes postérieures, sous-sollicitées dans votre quotidien, pour contrer la sarcopénie.",
      "objectives_targeted": ["muscle", "fat_loss"],
      "exercises": [
        {{
          "name_fr": "...",
          "block": "warmup",
          "sets": null,
          "reps_min": null,
          "reps_max": null,
          "duration_sec": 60,
          "rest_sec": 30,
          "rpe_target": 4,
          "load_notes": "...",
          "demo_url": "https://www.youtube.com/results?search_query=nom+exercice+technique+form",
          "cues": ["...", "..."]
        }}
      ]
    }}
  ],
  "generation_notes": "Brève explication de tes choix de programmation cette semaine (2-3 phrases, ton de coach direct)."
}}
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=[
            {
                "type": "text",
                "text": SCIENTIFIC_CONTEXT,
                "cache_control": {"type": "ephemeral"},  # cache 5 min
            }
        ],
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text.strip()

    # Extraction robuste du JSON (Claude peut parfois ajouter des backticks)
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    data = json.loads(raw)
    sessions = [GeneratedSession(**{**s, "day_of_week": s["day_of_week"] % 7}) for s in data["sessions"]]

    return sessions, data.get("generation_notes", "")
