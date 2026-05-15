"""
Génération de défis personnalisés via Claude API.
Expose deux fonctions utilisées par le router challenges :
  - suggest_challenges(profile, current_week) -> list[dict]
  - generate_challenge_custom(profile, challenge_type, hint, duration_weeks) -> dict
"""
import json
import re

import anthropic

from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = (
    "Tu es un coach sportif expert, spécialisé dans la préparation physique des adultes "
    "de 45 ans et plus. Tu génères des défis stimulants, sécurisés et progressifs, "
    "fondés sur la littérature scientifique (sarcopénie, VO2max, graisse viscérale, mobilité). "
    "Tu réponds UNIQUEMENT en JSON valide, sans texte autour."
)


def _parse_json(text: str):
    """Extrait le premier objet/tableau JSON d'une réponse Claude."""
    # Enlever les blocs markdown éventuels
    text = re.sub(r"```(?:json)?", "", text).strip()
    return json.loads(text)


async def suggest_challenges(profile: dict, current_week: int) -> list[dict]:
    """
    Génère 3 suggestions de défis adaptées au profil et à la semaine en cours.
    Retourne une liste de dicts prêts à être affichés et éventuellement persistés.
    """
    prompt = f"""
Génère exactement 3 défis sportifs personnalisés pour ce profil :

Profil :
- Âge : {profile.get("age", "inconnu")} ans
- Poids : {profile.get("weight_kg", "inconnu")} kg
- Niveau de forme : {profile.get("fitness_level", "intermédiaire")}
- Équipement : {profile.get("equipment", "aucun équipement spécifique")}
- Objectifs prioritaires : {profile.get("objectives", "santé générale")}
- Contraintes médicales : {profile.get("medical_constraints", "aucune")}
- Semaine de programme en cours : {current_week}

Réponds avec un tableau JSON de 3 objets, chacun contenant exactement ces champs :
{{
  "title": "Titre court et motivant",
  "description": "Description en 2-3 phrases",
  "emoji": "un emoji représentatif",
  "challenge_type": "strength | cardio | hiit | mobility | mixed",
  "target_description": "Objectif chiffré et mesurable",
  "target_metrics": {{"unit": "...", "value": 0}},
  "duration_weeks": 4,
  "milestones": [
    {{"week": 1, "label": "...", "done": false}},
    {{"week": 2, "label": "...", "done": false}},
    {{"week": 3, "label": "...", "done": false}},
    {{"week": 4, "label": "...", "done": false}}
  ],
  "domains": ["strength"],
  "generation_notes": "Justification scientifique en 1 phrase"
}}
"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json(response.content[0].text)


async def generate_challenge_custom(
    profile: dict,
    challenge_type: str,
    hint: str,
    duration_weeks: int = 8,
) -> dict:
    """
    Génère un défi unique sur mesure à partir d'une indication libre.
    Retourne un dict prêt à être persisté.
    """
    prompt = f"""
Génère un défi sportif sur mesure pour ce profil :

Profil :
- Âge : {profile.get("age", "inconnu")} ans
- Niveau de forme : {profile.get("fitness_level", "intermédiaire")}
- Équipement : {profile.get("equipment", "aucun équipement spécifique")}
- Objectifs : {profile.get("objectives", "santé générale")}

Type de défi demandé : {challenge_type}
Indication de l'utilisateur : "{hint}"
Durée souhaitée : {duration_weeks} semaines

Réponds avec un objet JSON unique contenant exactement ces champs :
{{
  "title": "Titre court et motivant",
  "description": "Description en 2-3 phrases",
  "emoji": "un emoji représentatif",
  "challenge_type": "{challenge_type}",
  "target_description": "Objectif chiffré et mesurable",
  "target_metrics": {{"unit": "...", "value": 0}},
  "duration_weeks": {duration_weeks},
  "milestones": [
    {{"week": 1, "label": "Jalon semaine 1", "done": false}}
  ],
  "domains": ["{challenge_type}"],
  "generation_notes": "Justification et conseils de sécurité en 2 phrases"
}}

Les jalons doivent couvrir toutes les {duration_weeks} semaines de manière progressive.
"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1500,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json(response.content[0].text)
