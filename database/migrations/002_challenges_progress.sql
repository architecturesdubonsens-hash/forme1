-- ============================================================
-- MIGRATION 002 — Défis, progression, contexte stratégique
-- À exécuter dans Supabase SQL Editor après le schema initial
-- ============================================================

-- Extension pour les exclusions de plage (si pas déjà activée)
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ── 1. Enrichir session_exercises (exercices générés dynamiquement) ──────────

ALTER TABLE session_exercises
  ADD COLUMN IF NOT EXISTS name_fr        TEXT,
  ADD COLUMN IF NOT EXISTS demo_url       TEXT,
  ADD COLUMN IF NOT EXISTS cues           TEXT[],
  ALTER COLUMN exercise_id DROP NOT NULL;  -- nullable pour le MVP sans catalogue


-- ── 2. Ajouter le contexte stratégique aux séances ───────────────────────────

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS strategic_context TEXT,  -- pourquoi cette séance ce jour ?
  ADD COLUMN IF NOT EXISTS objectives_targeted TEXT[];  -- ['fat_loss','vo2max']


-- ── 3. Métriques de progression (snapshot hebdomadaire) ──────────────────────

CREATE TABLE IF NOT EXISTS progress_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_at  TIMESTAMPTZ DEFAULT now(),
  week_number  INT NOT NULL,

  -- Indices relatifs 0–100 (0 = niveau départ, 100 = objectif atteint)
  score_vo2max    INT DEFAULT 0 CHECK (score_vo2max    BETWEEN 0 AND 100),
  score_muscle    INT DEFAULT 0 CHECK (score_muscle    BETWEEN 0 AND 100),
  score_fat_loss  INT DEFAULT 0 CHECK (score_fat_loss  BETWEEN 0 AND 100),
  score_mobility  INT DEFAULT 0 CHECK (score_mobility  BETWEEN 0 AND 100),

  -- Score global pondéré (calculé par le backend)
  score_overall   INT DEFAULT 0 CHECK (score_overall   BETWEEN 0 AND 100),

  -- Données brutes (optionnelles, issues de tests)
  weight_kg         DECIMAL(5,2),
  resting_hr_avg    INT,
  hrv_avg           DECIMAL(5,1),
  sessions_done     INT DEFAULT 0,

  notes TEXT,

  UNIQUE(user_id, week_number)
);

ALTER TABLE progress_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON progress_metrics USING (user_id = auth.uid());


-- ── 4. Défis (challenges) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),

  -- Description
  title        TEXT NOT NULL,
  description  TEXT,
  emoji        TEXT DEFAULT '🎯',

  -- Classification
  challenge_type TEXT NOT NULL
    CHECK (challenge_type IN (
      'trail',           -- ex: trail 15km / 800m D+
      'exercise_mastery',-- ex: 10 tractions strictes
      'metric',          -- ex: VO2max > 48
      'endurance',       -- ex: 1h de vélo sans pause
      'multi_domain'     -- combinaison de plusieurs objectifs
    )),

  -- Objectif concret mesurable
  target_description TEXT NOT NULL,  -- "Terminer un trail de 12km / 600m D+"
  target_metrics     JSONB,           -- {distance_km: 12, elevation_m: 600}

  -- Calendrier
  start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date  DATE NOT NULL,
  duration_weeks INT GENERATED ALWAYS AS (
    CEIL((target_date - start_date)::float / 7)
  ) STORED,

  -- Statut
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,

  -- Programme de jalons hebdomadaires (généré par IA)
  -- [{week: 1, title: "Base cardio", objective: "3x30min Zone 2", done: false}, ...]
  milestones JSONB DEFAULT '[]',

  -- Domaines concernés (pour affichage dans le radar)
  domains TEXT[] DEFAULT '{}',  -- ['vo2max', 'fat_loss', 'muscle', 'mobility']

  -- Traçabilité IA
  generation_notes TEXT
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON challenges USING (user_id = auth.uid());


-- ── 5. Tests d'évaluation — résultats détaillés ──────────────────────────────
-- (la table fitness_assessments existe déjà, on ajoute des colonnes)

ALTER TABLE fitness_assessments
  ADD COLUMN IF NOT EXISTS balance_single_leg_sec INT,   -- équilibre unipodal (sec)
  ADD COLUMN IF NOT EXISTS grip_strength_kg       DECIMAL(4,1),  -- force de préhension
  ADD COLUMN IF NOT EXISTS step_test_hr           INT;           -- FC après test step 3 min


-- ── 6. Index utiles ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wearable_user_date
  ON wearable_data (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date
  ON sessions (user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_session
  ON session_feedback (session_id);

CREATE INDEX IF NOT EXISTS idx_challenges_user_status
  ON challenges (user_id, status);

CREATE INDEX IF NOT EXISTS idx_progress_user_week
  ON progress_metrics (user_id, week_number DESC);
