import datetime

# Note: Assurez-vous que les imports nécessaires (comme de la librairie 'anthropic' ou 'openai' 
# si vous utilisez un client spécifique) sont présents en haut de votre fichier principal.

class ChallengeService:
    """
    Service gérant la génération de défis sportifs via l'IA.
    """

    def __init__(self, anthropic_client):
        self.client = anthropic_client

    async def generate_challenges(self, user_profile: dict) -> list:
        """
        Méthode principale pour générer des défis basés sur le profil utilisateur.
        """
        # Construction du prompt système (Le "Cerveau" de l'IA)
        system_prompt = (
            "Tu es un coach sportif expert, spécialisé dans la préparation physique et la motivation. "
        "Ton objectif est de créer des défis stimulants, sécurisés et personnalisés.\n\n"
        "CONSIGNES :\n"
        "1. Adapte l'intensité au niveau de l'utilisateur (débutant, intermédiaire, expert).\n"
        "2. Utilise un ton motivant mais professionnel.\n"
        "3. Chaque défi doit être réalisable avec un équipement minimal ou sans matériel.\n"
        "4. Structure tes réponses de manière très précise en JSON.\n\n"
        "FORMAT DE SORTIE (JSON uniquement) :\n"
        "[\n"
        "  {\n"
        "    \"title\": \"Nom du défi\",\n"
        "    \"description\": \"Description détaillée de l'exercice\",\n"
        "    \"duration_minutes\": 20,\n"
        "    \"difficulty\": \"easy|medium|hard\",\n"
        "    \"instructions\": \"Étapes à suivre\"\n"
        "  }\n"
        "]"
        )

        # Construction du prompt utilisateur (Les données)
        user_prompt = f"""
        Génère 3 nouveaux défis sportifs pour ce profil :
        - Niveau : {user_profile.get('fitness_level', 'débutant')}
        - Objectif : {user_profile.get('goal', 'santé générale')}
        - Équipement disponible : {user_profile.get('equipment', 'aucun')}
        - Préférences : {user_profile.get('preferences', 'aucun')}
        """

        try:
            # Appel à l'API (Exemple avec Anthropic Claude)
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            
            # Extraction et parsing du contenu
            content = response.content[0].text
            import json
            return json.loads(content)
        except Exception as e:
            print(f"Erreur lors de la génération des défis : {e}")
            return []
