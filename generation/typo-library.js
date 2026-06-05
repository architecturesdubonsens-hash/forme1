/**
 * typo-library.js
 * CRUD bibliothèque typologique + auto-matching.
 * Utilise Supabase (service_role) côté backend.
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY requis');
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

// -------------------------------------------------------
// SAVE
// -------------------------------------------------------

export async function saveTemplate({ nom, description, typology, sous_type, tags, source_plans, programme, stats, confiance, is_public, created_by }) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('typo_templates')
    .insert({
      nom,
      description:  description || null,
      typology,
      sous_type:    sous_type || null,
      tags:         tags || [],
      source_plans: source_plans || [],
      programme:    programme || {},
      stats:        stats || {},
      confiance:    confiance ?? 0.7,
      is_public:    is_public ?? true,
      is_validated: false,
      created_by:   created_by || null
    })
    .select()
    .single();

  if (error) throw new Error(`saveTemplate: ${error.message}`);
  return data;
}

// -------------------------------------------------------
// GET / LIST
// -------------------------------------------------------

export async function getTemplate(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('typo_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`getTemplate: ${error.message}`);
  return data;
}

export async function listTemplates({ typology, tags, is_public, created_by, limit = 50 } = {}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('typo_templates')
    .select('id, nom, typology, sous_type, tags, stats, confiance, is_public, is_validated, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (typology)    query = query.eq('typology', typology);
  if (is_public !== undefined) query = query.eq('is_public', is_public);
  if (created_by)  query = query.eq('created_by', created_by);
  if (tags?.length) query = query.overlaps('tags', tags);

  const { data, error } = await query;
  if (error) throw new Error(`listTemplates: ${error.message}`);
  return data;
}

// -------------------------------------------------------
// UPDATE / DELETE
// -------------------------------------------------------

export async function updateTemplate(id, updates, userId) {
  const supabase = getSupabaseClient();

  const allowed = ['nom', 'description', 'tags', 'is_public', 'is_validated', 'programme', 'stats', 'confiance'];
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const { data, error } = await supabase
    .from('typo_templates')
    .update(clean)
    .eq('id', id)
    .eq('created_by', userId)
    .select()
    .single();

  if (error) throw new Error(`updateTemplate: ${error.message}`);
  return data;
}

export async function deleteTemplate(id, userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('typo_templates')
    .delete()
    .eq('id', id)
    .eq('created_by', userId);
  if (error) throw new Error(`deleteTemplate: ${error.message}`);
}

// -------------------------------------------------------
// AUTO-MATCHING
// -------------------------------------------------------

function scoreTemplate(template, typology, targetStats) {
  let score = 0;

  // Typology exact match — critère principal
  if (template.typology === typology) score += 40;

  const s = template.stats || {};

  // Surface similarity (±30%)
  if (targetStats?.surface_totale_m2 && s.surface_totale_m2) {
    const ratio = Math.min(targetStats.surface_totale_m2, s.surface_totale_m2) /
                  Math.max(targetStats.surface_totale_m2, s.surface_totale_m2);
    score += ratio * 25;
  }

  // Nb espaces similarity
  if (targetStats?.nb_espaces && s.nb_espaces) {
    const ratio = Math.min(targetStats.nb_espaces, s.nb_espaces) /
                  Math.max(targetStats.nb_espaces, s.nb_espaces);
    score += ratio * 15;
  }

  // Confiance bonus
  score += (template.confiance || 0.7) * 10;

  // Validated bonus
  if (template.is_validated) score += 5;

  // Niveaux compatibility
  if (targetStats?.niveaux && s.niveaux) {
    const overlap = targetStats.niveaux.filter(n => s.niveaux.includes(n)).length;
    score += (overlap / Math.max(targetStats.niveaux.length, 1)) * 5;
  }

  return Math.round(score * 10) / 10;
}

export async function findMatchingTemplates(typology, targetStats = {}, limit = 3) {
  const supabase = getSupabaseClient();

  // Fetch candidates : exact typology + public
  const { data: candidates, error } = await supabase
    .from('typo_templates')
    .select('*')
    .eq('is_public', true)
    .or(`typology.eq.${typology},typology.eq.mixte`)
    .order('confiance', { ascending: false })
    .limit(30);

  if (error) throw new Error(`findMatchingTemplates: ${error.message}`);
  if (!candidates || candidates.length === 0) return [];

  const scored = candidates
    .map(t => ({ ...t, _score: scoreTemplate(t, typology, targetStats) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  return scored;
}

// -------------------------------------------------------
// PLAN ANALYSES
// -------------------------------------------------------

export async function createPlanAnalysis({ created_by, session_id, image_refs }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('plan_analyses')
    .insert({ created_by, session_id: session_id || null, image_refs, status: 'pending' })
    .select()
    .single();
  if (error) throw new Error(`createPlanAnalysis: ${error.message}`);
  return data;
}

export async function updatePlanAnalysis(id, { status, raw_extraction, extracted_programme, confiance, error_message, template_id }) {
  const supabase = getSupabaseClient();
  const updates = {};
  if (status              !== undefined) updates.status               = status;
  if (raw_extraction      !== undefined) updates.raw_extraction       = raw_extraction;
  if (extracted_programme !== undefined) updates.extracted_programme  = extracted_programme;
  if (confiance           !== undefined) updates.confiance            = confiance;
  if (error_message       !== undefined) updates.error_message        = error_message;
  if (template_id         !== undefined) updates.template_id          = template_id;

  const { data, error } = await supabase
    .from('plan_analyses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`updatePlanAnalysis: ${error.message}`);
  return data;
}

export async function getPlanAnalysis(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('plan_analyses')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`getPlanAnalysis: ${error.message}`);
  return data;
}
