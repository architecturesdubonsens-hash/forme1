# Activation du logging Forme1

## 3 gestes manuels requis

### 1. Token Vercel (portée Projects:Read)
Le token actuel a une portee insuffisante (403 Forbidden).
- Aller sur https://vercel.com/account/tokens
- Creer un nouveau token avec la portee "Projects:Read"
- Ajouter dans Railway : `railway variables add VERCEL_TOKEN=xxx`

### 2. Railway : connexion au depot
Railway n'est pas connecte au depot GitHub forme1.
- Installer Railway CLI : `npm i -g @railway/cli`
- Se connecter : `railway login`
- Lier le projet : `railway link` (dans le dossier forme1)
- Deployer : `railway up`

### 3. Migration SQL Supabase
La table app_logs n'existe pas encore dans Supabase.
- Ouvrir le dashboard Supabase > projet Forme1 > SQL Editor
- Coller et executer le contenu de database/003_app_logging.sql
- Verifier : `SELECT * FROM app_logs LIMIT 1` ne doit pas retourner d'erreur

## Verification
Apres deploiement, provoquer une erreur sur l'app mobile.
Verifier dans Supabase : `SELECT * FROM app_logs ORDER BY created_at DESC LIMIT 10`
L'erreur doit apparaitre sans acces au telephone.
