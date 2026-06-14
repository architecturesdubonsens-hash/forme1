export interface Espace {
  id: string;
  nom: string;
  type: string;
  niveau?: string;
  surface_estimee_m2?: number;
  qualites?: string[];
  contacts_exterieurs?: string[];
}

export interface Liaison {
  id: string;
  espace_a: string;
  espace_b: string;
  type: 'directe' | 'couloir' | 'visuelle' | 'acoustique' | 'fonctionnelle';
  qualite?: string;
}

export interface Programme {
  espaces: Espace[];
  liaisons: Liaison[];
  contacts_exterieurs?: Record<string, string[]>;
  circulation?: {
    entrees?: string[];
    axes?: string[];
    escaliers?: string[];
  };
  niveaux?: string[];
  surface_totale_estimee?: number;
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
  status: 'brouillon' | 'schema_fonctionnel' | 'schema_valide' | 'generation_en_cours' | 'genere' | 'erreur' | 'archive';
  phase: 1 | 2 | 3;
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
