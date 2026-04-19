# Forme 1 — Application de coaching sportif personnalisée

## Vision du projet

Application de coaching physique intelligente, scientifiquement fondée, conçue pour un utilisateur adulte cherchant à optimiser sa condition physique sur 4 axes prioritaires :

1. **Réduction de la graisse viscérale** — via des protocoles cardio et métaboliques ciblés
2. **Lutte contre la sarcopénie / développement musculaire** — résistance progressive, volume et fréquence adaptés à l'âge
3. **Mobilité fonctionnelle & proprioception** — amplitude articulaire, équilibre, coordination, prévention des chutes et compensations
4. **Amélioration du VO2max** — travail aérobie structuré (HIIT, MICT, Zone 2)

L'application doit s'améliorer avec l'utilisateur : plus il fournit de données (feedback, données wearable), plus le programme devient précis et efficace.

---

## Principes directeurs

### Scientifique avant tout
- Les protocoles s'appuient sur la littérature scientifique récente : physiologie de l'exercice, géroscience, nutrition sportive
- Références prioritaires : travaux sur le VO2max (Seiler, Gibala), sarcopénie (Churchward-Venne, Phillips), graisse viscérale (métabolisme HIIT vs MICT), mobilité (FRC, DNS)
- Distinguer ce qui est prouvé, ce qui est émergent, et ce qui est empirique

### Équilibre progression / conservatisme
- **Ne jamais sacrifier la sécurité à la performance** — l'utilisateur ne doit pas se blesser
- Progressions graduelles, périodisation intégrée, semaines de décharge automatiques
- Détection des signaux de sur-entraînement (via feedback + données wearable)
- Principe : `stimuler sans dégrader`

### Adaptabilité maximale
- Multi-sports : musculation, cardio, mobilité, natation, vélo, marche nordique, etc.
- Adapté à l'équipement disponible (aucun, home gym, salle complète)
- Tient compte des contraintes du jour : fatigue, temps disponible, douleurs
- Évolutif : le programme d'aujourd'hui n'est pas celui dans 6 mois

### Interface fraîche et motivante
- UX simple, claire, sans surcharge cognitive
- Design épuré mais énergique — ne ressemble pas à une app médicale
- Chaque activité : nom, durée, intensité, objectif en 1 ligne, + lien démo si disponible
- Feedback rapide à saisir (pas plus de 30 secondes après une séance)

---

## Fonctionnalités core

### Profil utilisateur
- Âge, poids, taille, composition corporelle estimée
- Niveau de forme actuel (auto-évaluation + tests intégrés : test de marche 6 min, test squat 30s, etc.)
- Équipement disponible
- Objectifs personnels pondérés (ex : 40% perte graisseuse, 30% muscle, 20% VO2, 10% mobilité)
- Contraintes médicales / historique blessures

### Génération de programme
- Planification hebdomadaire adaptative (3 à 6 séances selon disponibilité)
- Bloc périodisé sur 4-8 semaines avec ajustement automatique
- Équilibre des modalités selon les 4 objectifs
- Chaque séance : échauffement → travail principal → récupération active

### Intégration Apple Watch (via Raccourci iOS)
- Fréquence cardiaque repos + HRV → récupération et état du système nerveux autonome
- Données de sommeil → ajustement de l'intensité du jour
- Calories actives de la veille → calibrage des charges
- Sync quotidienne via un Raccourci iOS → webhook backend (pas d'App Store requis)

### Feedback post-séance
- Ressenti global (énergie, effort perçu RPE 1-10)
- Douleurs / gênes localisées
- Exercices mal compris ou non réalisables
- Ces données alimentent le moteur d'adaptation

### Moteur d'adaptation IA
- Analyse du feedback sur 2-4 semaines pour identifier les patterns
- Ajustement de volume / intensité / fréquence
- Substitution d'exercices selon retours ou équipement
- Alertes si indicateurs de sur-entraînement ou stagnation

### Bibliothèque d'exercices
- Description courte et précise (pas de jargon inutile)
- Muscles ciblés, articulations sollicitées
- Lien vidéo démonstration (YouTube / sources fiables)
- Alternatives selon niveau et équipement
- Marquage des exercices à risque nécessitant une progression technique

---

## Stack technique

### Décisions arrêtées
- **Frontend** : Next.js (web app PWA-ready, accessible mobile depuis Safari)
- **Backend** : FastAPI (Python) — adapté aux calculs physiologiques et à l'IA
- **Base de données** : PostgreSQL (via Supabase — auth + BDD intégrés)
- **IA / LLM** : Claude API (Anthropic) pour la génération de programme et l'analyse feedback
- **Intégration Apple Watch** : Apple Raccourcis iOS → webhook → backend (Option B)
  - Données récupérées : FC repos, HRV, sommeil, calories actives
  - L'utilisateur exécute le Raccourci chaque matin (ou automatisation horaire)
  - Pas de compte Apple Developer requis, pas d'App Store
- **Auth** : Supabase Auth
- **Hébergement** : Vercel (frontend) + Railway ou Render (FastAPI backend)

### Intégration Apple Watch — détail du Raccourci iOS
Le Raccourci lit depuis l'app Santé iPhone (alimentée par Apple Watch) :
- Fréquence cardiaque au repos (nuit)
- HRV (variabilité de la fréquence cardiaque)
- Durée et qualité du sommeil
- Calories actives de la veille
Il envoie ces données en POST JSON à l'endpoint `/api/wearable/sync` du backend.

### Modèle de données clés
```
User → Profile → WeeklyPlan → Session → Exercise
                           ↓
                      Feedback + WearableData → AdaptationEngine
```

---

## Contraintes et garde-fous

- **Pas de substitution médicale** : l'app recommande de consulter un médecin pour toute douleur persistante ou condition préexistante
- **Transparence des recommandations** : l'utilisateur peut toujours voir pourquoi un exercice est proposé
- **Pas de données vendues / partagées** — confidentialité des données de santé
- **Offline first** : les séances du jour doivent être accessibles sans connexion

---

## Style de code

- Commits en français ou anglais, messages descriptifs
- Tests sur les algorithmes d'adaptation (critique : une mauvaise recommandation = blessure potentielle)
- Séparation stricte logique métier / UI
- Pas d'over-engineering sur le MVP : d'abord faire fonctionner, ensuite optimiser

---

## Prochaines étapes (roadmap MVP)

1. **Schéma de données** — modéliser User, Profile, WeeklyPlan, Session, Exercise, Feedback, WearableData
2. **Backend FastAPI** — endpoints CRUD + endpoint de génération de programme via Claude API
3. **Moteur de programme v1** — génération d'une semaine type selon profil (sans wearable)
4. **Frontend Next.js** — onboarding profil, affichage programme hebdo, saisie feedback
5. **Raccourci iOS** — créer et documenter le Raccourci Apple Watch → webhook
6. **Moteur d'adaptation v1** — ajustement du programme sur la base du feedback et des données wearable
7. **Polish UI** — design, animations légères, liens démo exercices
