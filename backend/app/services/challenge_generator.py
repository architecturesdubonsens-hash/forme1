"""
Génération de défis personnalisés via Claude.
Un défi = objectif concret + durée + jalons hebdomadaires + conseils.
"""
import json
from datetime import date, timedelta
from uuid import UUID
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

CHALLENGE_SYSTEM = """
Tu es un coach sportif expert qui crée des défis motivants, réalistes et progressifs.
Un bon défi doit :
- Être concret et mesurable (pas "progresser", mais "courir 5km sans s'arrêter")
- Être ambitieux mais atteignable en 6–12 semaines
- Être adapté au niveau et aux objectifs de la personne
- Inclure des jalons hebdomadaires clairs
- Être suffisamment précis pour pouvoir mesurer la réussite le jour J
"""


async def suggest_challenges(profile: dict, current_week: int) -> list[dict]:
    """
    Génère 3 propositions de défis personnalisées basées sur le profil.
    Retourne une liste de dicts.
    """
    age = date.today().year - profile.get("birth_year", 1970)
    equipment = ", ".join(profile.get("equipment", [])) or "poids de corps"

    prompt = f"""
Profil :
- Âge : {age} ans
- Niveau : {profile.get('fitness_level', 'light')}
- Équipement : {equipment}
- Objectifs prioritaires : graisse viscérale {profile.get('goal_fat_loss',25)}%, muscle {profile.get('goal_muscle',25)}%, mobilité {profile.get('goal_mobility',25)}%, VO2max {profile.get('goal_vo2max',25)}%
- Semaine actuelle du programme : {current_week}

Propose exactement 3 défis variés, couvrant des types différents parmi :
trail, exercise_mastery, metric, endurance, multi_domain.

Adapte la difficulté : ni trop facile, ni irréaliste pour quelqu'un de {age} ans au niveau {profile.get('fitness_level', 'light')}.

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
[
  {{
    "title": "...",
    "description": "...",
    "emoji": "...",
    "challenge_type": "trail|exercise_mastery|metric|endurance|multi_domain",
    "target_description": "Objectif précis et mesurable en 1 phrase",
    "target_metrics": {{}},
    "duration_weeks": 8,
    "domains": ["vo2max", "fat_loss"],
    "milestones": [
      {{"week": 1, "title": "...", "objective": "...", "done": false}},
      {{"week": 2, "title": "...", "objective": "...", "done": false}}
    ],
    "generation_notes": "Pourquoi ce défi est adapté à ce profil."
  }}
]
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=CHALLENGE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    challenges = json.loads(raw)

    # Calcul de la target_date
    for ch in challenges:
        weeks = ch.get("duration_weeks", 8)
        ch["start_date"] = date.today().isoformat()
        ch["target_date"] = (date.today() + timedelta(weeks=weeks)).isoformat()
        # Générer tous les jalons si manquants
        if len(ch.get("milestones", [])) < weeks:
            ch["milestones"] = _fill_milestones(ch["milestones"], weeks)

    return challenges


async def generate_challenge_custom(
    profile: dict,
    challenge_type: str,
    hint: str,
    duration_weeks: int = 8,
) -> dict:
    """Génère un défi sur mesure à partir d'une indication de l'utilisateur."""
    age = date.today().year - profile.get("birth_year", 1970)

    prompt = f"""
Profil : {age} ans, niveau {profile.get('fitness_level','light')}, équipement : {', '.join(profile.get('equipment',[]) or ['poids de corps'])}

L'utilisateur veut un défi de type "{challenge_type}" sur {duration_weeks} semaines.
Indication : "{hint}"

Génère UN seul défi avec des jalons pour chacune des {duration_weeks} semaines.
Réponds en JSON valide (même format que précédemment, objet unique, pas de tableau).
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=CHALLENGE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    ch = json.loads(raw)
    ch["start_date"]  = date.today().isoformat()
    ch["target_date"] = (date.today() + timedelta(weeks=duration_weeks)).isoformat()
    return ch


def _fill_milestones(existing: list[dict], total_weeks: int) -> list[dict]:
    """Complète la liste des jalons si le LLM n'en a pas générés pour toutes les semaines."""
    existing_weeks = {m["week"] for m in existing}
    result = list(existing)
    for w in range(1, total_weeks + 1):
        if w not in existing_weeks:
            result.append({"week": w, "title": f"Semaine {w}", "objective": "Continuer la progression", "done": False})
    return sorted(result, key=lambda m: m["week"])
