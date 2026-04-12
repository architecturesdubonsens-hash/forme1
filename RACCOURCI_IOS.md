# Raccourci iOS — Sync Apple Watch → Forme 1

Ce Raccourci lit chaque matin vos données de santé depuis l'Apple Watch
et les envoie automatiquement au backend Forme 1.

## Ce dont vous avez besoin

- iPhone avec l'app **Raccourcis** (préinstallée)
- Apple Watch appairée et synchronisée
- L'app **Santé** activée (collecte FC, HRV, sommeil)
- URL de votre backend Forme 1 (ex : `https://votre-app.railway.app`)
- Votre UUID Supabase (visible dans les réglages de l'app)

---

## Créer le Raccourci manuellement

### Étape 1 — Ouvrir l'app Raccourcis et créer un nouveau raccourci

### Étape 2 — Ajouter les actions dans cet ordre

**Action 1 : Obtenir les échantillons de santé — Fréquence cardiaque au repos**
- Type : "Obtenir des échantillons de santé"
- Type de santé : Fréquence cardiaque au repos
- Période : Dernières 24 heures
- Sauvegarder dans : variable `fc_repos`

**Action 2 : Obtenir les échantillons de santé — VFC (HRV)**
- Type de santé : Variabilité de la fréquence cardiaque
- Période : Dernières 24 heures
- Sauvegarder dans : variable `hrv`

**Action 3 : Obtenir les échantillons de santé — Sommeil**
- Type de santé : Sommeil
- Période : Dernières 24 heures
- Calculer le total (durée en minutes)
- Sauvegarder dans : variable `sommeil_min`

**Action 4 : Obtenir les échantillons de santé — Calories actives**
- Type de santé : Énergie active
- Période : Hier (journée complète)
- Calculer la somme
- Sauvegarder dans : variable `calories_actives`

**Action 5 : Obtenir la date du jour**
- Format : `AAAA-MM-JJ`
- Sauvegarder dans : variable `date_auj`

**Action 6 : Obtenir la première valeur**
- Entrée : `fc_repos`
- Sauvegarder dans : variable `fc_valeur`

**Action 7 : Obtenir la première valeur**
- Entrée : `hrv`
- Sauvegarder dans : variable `hrv_valeur`

**Action 8 : Contenu d'URL (requête HTTP)**
- URL : `https://VOTRE_BACKEND/api/wearable/sync`
- Méthode : POST
- En-têtes :
  - `Content-Type` : `application/json`
  - `x-user-id` : `VOTRE_UUID_SUPABASE`
- Corps (JSON) :
```json
{
  "date": "[date_auj]",
  "resting_hr": [fc_valeur],
  "hrv_rmssd": [hrv_valeur],
  "sleep_duration_min": [sommeil_min],
  "active_calories": [calories_actives]
}
```

**Action 9 (optionnel) : Afficher la notification**
- Titre : "Forme 1 — Sync OK"
- Corps : "Données Apple Watch envoyées"

---

## Automatiser l'exécution

Pour que le Raccourci s'exécute automatiquement chaque matin :

1. Dans l'app **Raccourcis** → onglet **Automatisation**
2. **Nouvelle automatisation → Personnelle**
3. Déclencheur : **Heure du jour** → 7h00, chaque jour
4. Action : **Exécuter le raccourci** → sélectionner votre raccourci
5. Désactiver "Demander avant d'exécuter"

---

## Vérification

Après la première exécution, vérifiez dans l'app Forme 1 que votre
badge de récupération s'affiche sur le dashboard.

Si le badge n'apparaît pas :
1. Vérifiez que l'app Santé a accès à votre Apple Watch
  (Réglages → Santé → Sources → Apple Watch)
2. Portez votre montre au moins 2 nuits pour avoir des données HRV
3. Vérifiez l'URL et l'UUID dans le raccourci

---

## Données collectées

| Donnée | Source | Utilisation |
|--------|--------|-------------|
| FC repos | Apple Watch (nuit) | Score récupération (30%) |
| HRV (RMSSD) | Apple Watch (nuit) | Score récupération (50%) |
| Durée sommeil | Apple Watch | Score récupération (20%) |
| Calories actives | Apple Watch (veille) | Calibrage volume séance |

**Aucune donnée n'est partagée** avec des tiers. Tout reste sur votre instance Supabase.
