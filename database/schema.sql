-- ============================================================
-- FORME 1 — Schéma PostgreSQL (Supabase)
-- ============================================================
-- Les utilisateurs sont gérés par Supabase Auth (auth.users)
-- On étend avec nos propres tables liées à auth.users.id


-- ============================================================
-- 1. PROFIL UTILISATEUR
-- ============================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  -- Identité
  first_name    TEXT,
  birth_year    INT,             -- on calcule l'âge dynamiquement
  gender        TEXT CHECK (gender IN ('male', 'female', 'other')),

  -- Morphologie
  weight_kg     DECIMAL(5,2),
  height_cm     INT,

  -- Niveau de forme auto-évalué au départ
  fitness_level TEXT DEFAULT 'light'
    CHECK (fitness_level IN ('sedentary', 'light', 'moderate', 'active', 'athlete')),

  -- Objectifs pondérés (entiers, somme = 100)
  goal_fat_loss  INT DEFAULT 25,   -- % priorité perte graisseuse
  goal_muscle    INT DEFAULT 25,   -- % priorité masse musculaire
  goal_mobility  INT DEFAULT 25,   -- % priorité mobilité
  goal_vo2max    INT DEFAULT 25,   -- % priorité VO2max

  -- Disponibilité
  sessions_per_week     INT DEFAULT 4,
  session_duration_min  INT DEFAULT 60,  -- durée préférée en minutes

  -- Équipement disponible (tableau de valeurs)
  -- Valeurs : 'none' | 'dumbbells' | 'barbell' | 'kettlebell' |
  --           'pull_up_bar' | 'resistance_bands' | 'bench' |
  --           'gym_full' | 'pool' | 'bike' | 'treadmill'
  equipment TEXT[] DEFAULT '{}',

  -- Santé
  medical_notes   TEXT,
  injury_history  TEXT[],

  -- Contexte d'entraînement
  existing_training          BOOLEAN DEFAULT false,
  existing_training_context  TEXT
);

-- Mise à jour automatique du updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. ÉVALUATIONS DE FORME (tests de base)
-- ============================================================

CREATE TABLE fitness_assessments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessed_at  TIMESTAMPTZ DEFAULT now(),

  -- Tests standardisés
  six_min_walk_m    INT,           -- Test de marche 6 min (mètres)
  squat_30s_reps    INT,           -- Test squat 30 secondes (répétitions)
  pushup_max        INT,           -- Pompes max
  sit_reach_cm      DECIMAL(4,1),  -- Souplesse assise (cm)
  resting_hr        INT,           -- FC repos (bpm)
  hrv_rmssd         DECIMAL(5,1),  -- HRV de base (ms, méthode RMSSD)

  notes TEXT
);


-- ============================================================
-- 3. DONNÉES WEARABLE QUOTIDIENNES (Apple Watch → Raccourci iOS)
-- ============================================================

CREATE TABLE wearable_data (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT now(),

  -- Métriques Apple Watch (via app Santé iPhone)
  resting_hr        INT,            -- FC repos (bpm)
  hrv_rmssd         DECIMAL(5,1),   -- HRV nuit (ms)
  sleep_duration_min INT,           -- Durée totale de sommeil (minutes)
  sleep_quality     INT CHECK (sleep_quality BETWEEN 1 AND 5),
  active_calories   INT,            -- Calories actives (kcal)
  steps             INT,

  -- Score de récupération calculé par le backend (0–100)
  -- Algorithme : combinaison HRV + FC repos + sommeil
  recovery_score INT CHECK (recovery_score BETWEEN 0 AND 100),

  UNIQUE(user_id, date)
);


-- ============================================================
-- 4. BIBLIOTHÈQUE D'EXERCICES (catalogue statique)
-- ============================================================

CREATE TABLE exercises (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name_fr      TEXT NOT NULL,
  name_en      TEXT,

  -- Classification
  category     TEXT NOT NULL
    CHECK (category IN ('strength', 'cardio', 'mobility', 'hiit', 'recovery')),

  muscles_primary   TEXT[],   -- ex : ['quadriceps', 'fessiers']
  muscles_secondary TEXT[],   -- ex : ['ischio-jambiers', 'core']

  -- Prérequis
  equipment_required TEXT[] DEFAULT '{}',  -- vide = poids de corps
  skill_level        INT DEFAULT 1
    CHECK (skill_level BETWEEN 1 AND 5),   -- 1=débutant, 5=expert
  injury_risk        TEXT DEFAULT 'low'
    CHECK (injury_risk IN ('low', 'medium', 'high')),

  -- Instructions
  description  TEXT,              -- explication courte et claire
  cues         TEXT[],            -- 2–4 points clés d'exécution
  demo_url     TEXT,              -- lien YouTube démonstration

  -- Contribution aux 4 objectifs (pour la sélection IA)
  targets_fat_loss  BOOLEAN DEFAULT false,
  targets_muscle    BOOLEAN DEFAULT false,
  targets_mobility  BOOLEAN DEFAULT false,
  targets_vo2max    BOOLEAN DEFAULT false
);


-- ============================================================
-- 5. PLANS HEBDOMADAIRES (générés par IA)
-- ============================================================

CREATE TABLE weekly_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  week_number  INT  NOT NULL,   -- numéro de semaine dans le programme global
  week_start   DATE NOT NULL,
  week_end     DATE NOT NULL,

  -- Contexte au moment de la génération
  recovery_score_avg DECIMAL(4,1),  -- score de récupération moyen de la semaine précédente
  phase TEXT DEFAULT 'base'
    CHECK (phase IN ('base', 'build', 'peak', 'deload')),

  -- Traçabilité IA
  generation_notes TEXT,   -- raisonnement de Claude pour ce plan

  is_active BOOLEAN DEFAULT true,

  CONSTRAINT no_overlapping_active_plans
    EXCLUDE USING gist (user_id WITH =, daterange(week_start, week_end) WITH &&)
    WHERE (is_active = true)
);


-- ============================================================
-- 6. SÉANCES (sessions d'entraînement)
-- ============================================================

CREATE TABLE sessions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id   UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  scheduled_date DATE NOT NULL,
  day_of_week    INT  CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=dimanche

  -- Type et description
  session_type TEXT NOT NULL
    CHECK (session_type IN ('strength', 'cardio', 'hiit', 'mobility', 'mixed', 'active_recovery')),
  title            TEXT NOT NULL,
  goal_summary     TEXT,              -- 1 ligne : but de la séance

  estimated_duration_min INT,
  intensity_target TEXT DEFAULT 'moderate'
    CHECK (intensity_target IN ('low', 'moderate', 'high', 'max')),

  -- Statut
  status       TEXT DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed', 'skipped', 'modified')),
  completed_at TIMESTAMPTZ
);


-- ============================================================
-- 7. EXERCICES D'UNE SÉANCE (avec prescription)
-- ============================================================

CREATE TABLE session_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),

  position    INT  NOT NULL,    -- ordre dans la séance
  block       TEXT NOT NULL
    CHECK (block IN ('warmup', 'main', 'cooldown')),

  -- Prescription
  sets        INT,
  reps_min    INT,
  reps_max    INT,
  duration_sec INT,             -- pour les exercices chronométrés
  rest_sec    INT,

  -- Charge / intensité
  rpe_target      INT  CHECK (rpe_target BETWEEN 1 AND 10),
  load_notes      TEXT,         -- ex : "poids permettant 12 reps propres"

  -- Alternative proposée si l'exercice principal est impossible
  substitute_exercise_id UUID REFERENCES exercises(id)
);


-- ============================================================
-- 8. FEEDBACK POST-SÉANCE
-- ============================================================

CREATE TABLE session_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) UNIQUE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ DEFAULT now(),

  -- Effort et énergie
  rpe_actual      INT CHECK (rpe_actual BETWEEN 1 AND 10),
  energy_level    INT CHECK (energy_level BETWEEN 1 AND 5),
  motivation_score INT CHECK (motivation_score BETWEEN 1 AND 5),

  -- Douleurs / gênes
  pain_reported  BOOLEAN DEFAULT false,
  pain_location  TEXT[],                          -- zones du corps
  pain_severity  INT CHECK (pain_severity BETWEEN 1 AND 5),

  -- Qualité de séance
  completed_fully     BOOLEAN DEFAULT true,
  skipped_exercises   UUID[],                     -- IDs des exercices sautés
  notes               TEXT
);


-- ============================================================
-- 9. JOURNAL DES ADAPTATIONS IA (audit trail)
-- ============================================================

CREATE TABLE adaptation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),

  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('feedback', 'wearable', 'manual', 'scheduled')),

  -- Détail des changements sous forme JSON
  -- ex : {"volume": "-10%", "intensity": "maintained", "exercises_swapped": [...]}
  changes_made JSONB,

  -- Explication de Claude
  reasoning TEXT
);


-- ============================================================
-- ROW LEVEL SECURITY (chaque utilisateur ne voit que ses données)
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_data     ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_logs   ENABLE ROW LEVEL SECURITY;

-- Politique générique : l'utilisateur accède uniquement à ses propres lignes
CREATE POLICY "own_data" ON profiles
  USING (id = auth.uid());

CREATE POLICY "own_data" ON fitness_assessments
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON wearable_data
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON weekly_plans
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON sessions
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON session_feedback
  USING (user_id = auth.uid());

CREATE POLICY "own_data" ON adaptation_logs
  USING (user_id = auth.uid());

-- session_exercises : accès via la session parente
CREATE POLICY "own_data" ON session_exercises
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- exercises : lecture publique (catalogue partagé)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON exercises FOR SELECT USING (true);
