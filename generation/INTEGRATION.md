# Générateur ↔ CapInSitu — Contrat d'intégration

## Contexte

Le générateur bâtiment (`generation/`) est un module autonome développé en parallèle de CapInSitu (`app-v3`).
Il est conçu pour être intégré à CapInSitu au fur et à mesure, sans refactoring majeur.

## Principe de déploiement

```
CapInSitu app-v3          Générateur (ce module)
─────────────────         ───────────────────────
Projets / suivi    ←───── Session validée + bâtiment généré
Équipe / docs             Programme spatial (JSON)
Maquette viewer    ←───── GLB/IFC via VIZinSITU
Auth utilisateurs  ──────→ Même Supabase project (fnfrusblyzndbzckkfir)
```

## Point de jonction principal

Quand une session de génération passe au statut `schema_valide` puis `genere`, elle est prête
à créer un projet CapInSitu. Le lien se fera via :

```json
// generation_sessions
{
  "id": "uuid-session",
  "status": "genere",
  "programme": { ... },
  "generation_result": { "glb_path": "...", "ifc_path": "...", "svg": "..." },
  "capinsitu_project_id": null   // ← réservé pour le lien CapInSitu
}
```

Quand CapInSitu sera prêt à consommer :
1. Appeler `POST /sessions/{id}/lock` pour valider le schéma fonctionnel
2. Appeler `POST /sessions/{id}/generate` pour lancer la génération
3. Lire `GET /sessions/{id}` pour récupérer `generation_result` (GLB, IFC, SVG, programme)
4. Créer le projet CapInSitu avec ces données et mettre à jour `capinsitu_project_id`

## Endpoints que CapInSitu consommera

| Endpoint | Usage |
|---|---|
| `POST /sessions` | Créer une session depuis un projet CapInSitu |
| `GET /sessions/{id}` | Lire programme + résultat de génération |
| `POST /sessions/{id}/command` | Affiner le programme en dialogue |
| `POST /sessions/{id}/lock` | Valider le schéma fonctionnel |
| `POST /sessions/{id}/generate` | Lancer la génération 2D/IFC/GLB |
| `GET /sessions/{id}/svg` | Récupérer le plan 2D SVG |
| `GET /library/templates/match` | Suggestions typologiques automatiques |

## Auth

Les deux produits partagent Supabase `fnfrusblyzndbzckkfir`.
Un utilisateur CapInSitu authentifié passe son JWT Bearer dans les requêtes au générateur.
Le générateur vérifie le token via `SUPABASE_SERVICE_KEY` et filtre les sessions par `user_id`.
RLS Supabase est activé sur toutes les tables — `created_by = auth.uid()`.

## VIZinSITU

Le fichier `vizinsitu-connector.js` est le point d'interface avec VIZinSITU.
Dès que VIZinSITU expose son API d'import de modèle, implémenter :
```js
export async function pushToVizinSitu(sessionId, glbPath, metadata) { ... }
```
Appelé automatiquement depuis `api-generate.py` quand `status → genere`.

## Règles de développement

- Ne pas casser la signature des endpoints listés ci-dessus sans versioning (`/v2/...`)
- Tout nouveau champ dans `generation_sessions` doit être pensé en termes de valeur pour CapInSitu
- L'auth JWT doit être implémentée dans le générateur AVANT l'intégration CapInSitu
- Les logs de génération doivent être suffisamment détaillés pour le support CapInSitu
