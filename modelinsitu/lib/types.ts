export interface EspaceDimensions {
  surface_min_m2?: number;
  surface_max_m2?: number;
  surface_cible_m2?: number;
  largeur_min_m?: number;
  longueur_min_m?: number;
  hauteur_sous_plafond_m?: number;
}

export interface ContraintesOp {
  ensoleillement_min_heures?: number;
  orientation_preferee?: string[];
  facade_preferee?: boolean;
  position_preferee?: 'rdc' | 'etage' | 'sous_sol' | 'any';
  isolation_acoustique_db?: number;
  ventilation_naturelle?: boolean;
  acces_pmr?: boolean;
  hauteur_libre_min_m?: number;
  ratio_vitrage_min?: number;
  ratio_vitrage_max?: number;
  double_orientation?: boolean;
  separation_circulation?: boolean;
  acces_direct_exterieur?: boolean;
}

export interface Espace {
  id: string;
  nom: string;
  type: string;
  quantite?: number;
  niveau?: string;
  dimensions?: EspaceDimensions;
  qualites?: string[];
  contraintes_op?: ContraintesOp;
  contacts_exterieurs?: string[];
  priorite?: number;
  surface_estimee_m2?: number; // legacy compat
}

export interface Liaison {
  // schema cdc-parser (source/cible)
  source?: string;
  cible?: string;
  // schema legacy (espace_a/espace_b)
  id?: string;
  espace_a?: string;
  espace_b?: string;
  type: string;
  obligation?: 'absolue' | 'forte' | 'optionnelle';
  permeabilite?: string;
  description?: string;
  qualite?: string;
}

export interface ProgrammeMetadata {
  version?: string;
  created_at?: string;
  source_cdc?: string;
  confiance?: number;
  valide?: boolean;
  questions_clarification?: string[];
  erreurs_validation?: string[];
}

export interface ContraintesGlobales {
  emprise_max_m2?: number;
  surface_plancher_max_m2?: number;
  hauteur_max_m?: number;
  niveaux_max?: number;
  pmr?: boolean;
  re2020?: boolean;
  bbc?: boolean;
  passif?: boolean;
}

export interface Programme {
  espaces: Espace[];
  liaisons: Liaison[];
  contraintes_globales?: ContraintesGlobales;
  objectifs_conception?: string[];
  references_typologiques?: string[];
  contacts_exterieurs?: Record<string, string[]>;
  circulation?: {
    entrees?: string[];
    axes?: string[];
    escaliers?: string[];
  };
  niveaux?: string[];
  surface_totale_estimee?: number;
  metadata?: ProgrammeMetadata;
}

// ── Layout engine output ──────────────────────────────────────────────────────

export interface LayoutRect {
  id: string;
  nom: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  surface_m2: number;
}

export interface LayoutViolation {
  type: string;
  message: string;
}

export interface LayoutData {
  rectangles: Record<string, LayoutRect[]>;
  niveaux: string[];
  emprise: { largeur: number; profondeur: number };
  score: number;
  violations: LayoutViolation[];
}

export interface TemplateStats {
  nb_espaces: number;
  surface_totale: number;
  nb_liaisons: number;
  nb_niveaux: number;
}

export interface Template {
  id: string;
  nom: string;
  typology: string;
  sous_type?: string;
  tags?: string[];
  programme: Programme;
  stats: TemplateStats;
  confiance: number;
  is_public: boolean;
  is_validated: boolean;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  session_id: string;
  action: string;
  command?: string;
  diff_summary?: {
    added?: string[];
    modified?: string[];
    removed?: string[];
  };
  created_at: string;
}

export interface Session {
  id: string;
  user_id?: string;
  project_name: string;
  status:
    | 'parsing'
    | 'brouillon'
    | 'functional_schema'
    | 'schema_fonctionnel'
    | 'schema_valide'
    | 'schema_locked'
    | 'generation_en_cours'
    | 'genere'
    | 'done'
    | 'erreur'
    | 'archive';
  phase?: 1 | 2 | 3;
  cdc_texte?: string;
  programme?: Programme;
  generation_result?: GenerationResult;
  created_at: string;
  updated_at: string;
  history?: HistoryEntry[];
}

export interface GenerationResult {
  svg?: string;
  ifc_path?: string;
  glb_path?: string;
  layout_score?: number;
  stats?: Record<string, unknown>;
}

export interface AnalysisJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  images_count?: number;
  summary?: {
    nb_espaces: number;
    nb_liaisons: number;
    confiance: number;
  };
  error?: string;
}

export interface CommandResult {
  programme: Programme;
  operations: Array<{ type: string; [key: string]: unknown }>;
  summary: string;
}

export const TYPOLOGIES = [
  'logement_collectif',
  'maison_individuelle',
  'bureau',
  'equipement_public',
  'commerce',
  'industrie',
  'mixte',
  'autre',
] as const;

export type Typology = typeof TYPOLOGIES[number];

export const TYPOLOGY_LABELS: Record<string, string> = {
  logement_collectif: 'Logement collectif',
  maison_individuelle: 'Maison individuelle',
  bureau: 'Bureaux',
  equipement_public: 'Équipement public',
  commerce: 'Commerce',
  industrie: 'Industrie / Entrepôt',
  mixte: 'Usage mixte',
  autre: 'Autre',
};
