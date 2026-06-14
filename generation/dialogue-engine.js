/**
 * dialogue-engine.js
 * Moteur de dialogue pour le raffinement itératif du programme architectural.
 * Interprète les commandes en langage naturel via Claude tool use,
 * applique les opérations de manière déterministe, et persiste l'historique.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// -------------------------------------------------------
// OPENROUTER — client générique pour modèles non-Claude
// -------------------------------------------------------

function convertToolToOpenAI(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  };
}

async function callOpenRouter(model, systemPrompt, userMessage, tools) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY requis pour les modèles non-Claude (ex: DeepSeek)');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://capinsitu.fr',
      'X-Title': 'CapInSitu Generator'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      tools: tools.map(convertToolToOpenAI),
      tool_choice: 'required'
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== 'apply_programme_edits') {
    throw new Error('Commande non interprétée par le modèle (OpenRouter)');
  }

  return JSON.parse(toolCall.function.arguments);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY requis');
  return createClient(url, key, { auth: { persistSession: false } });
}

// -------------------------------------------------------
// TOOL DEFINITION — opérations atomiques sur le programme
// -------------------------------------------------------

const EDIT_TOOL = {
  name: 'apply_programme_edits',
  description: `Applique une ou plusieurs modifications atomiques au programme architectural.
Chaque opération est appliquée dans l'ordre. Toujours utiliser des ids existants pour les modifications.`,
  input_schema: {
    type: 'object',
    required: ['operations', 'reasoning'],
    properties: {
      reasoning: {
        type: 'string',
        description: 'Explication concise de la modification et de sa justification architecturale'
      },
      operations: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'object',
              required: ['op', 'espace'],
              properties: {
                op:     { const: 'add_espace' },
                espace: {
                  type: 'object',
                  required: ['id', 'nom', 'type'],
                  properties: {
                    id:          { type: 'string' },
                    nom:         { type: 'string' },
                    type:        { type: 'string' },
                    quantite:    { type: 'integer', minimum: 1 },
                    qualites:    { type: 'array', items: { type: 'string' } },
                    priorite:    { type: 'integer', minimum: 1, maximum: 5 },
                    dimensions:  { type: 'object' },
                    contraintes_op: { type: 'object' }
                  }
                }
              }
            },
            {
              type: 'object',
              required: ['op', 'espace_id'],
              properties: {
                op:         { const: 'remove_espace' },
                espace_id:  { type: 'string' }
              }
            },
            {
              type: 'object',
              required: ['op', 'espace_id', 'changes'],
              properties: {
                op:        { const: 'update_espace' },
                espace_id: { type: 'string' },
                changes: {
                  type: 'object',
                  description: 'Champs à modifier (merge partiel)',
                  properties: {
                    nom:         { type: 'string' },
                    type:        { type: 'string' },
                    quantite:    { type: 'integer' },
                    qualites:    { type: 'array', items: { type: 'string' } },
                    priorite:    { type: 'integer' },
                    dimensions:  { type: 'object' },
                    contraintes_op: { type: 'object' }
                  }
                }
              }
            },
            {
              type: 'object',
              required: ['op', 'liaison'],
              properties: {
                op: { const: 'add_liaison' },
                liaison: {
                  type: 'object',
                  required: ['source', 'cible', 'type', 'obligation'],
                  properties: {
                    source:       { type: 'string' },
                    cible:        { type: 'string' },
                    type:         { type: 'string', enum: ['directe', 'indirecte', 'proximite', 'separation_absolue', 'flux_physique', 'relation_visuelle', 'flux_acoustique'] },
                    obligation:   { type: 'string', enum: ['absolue', 'forte', 'optionnelle'] },
                    permeabilite: { type: 'string', enum: ['porte', 'ouverture_large', 'vitrage', 'mur_plein', 'acoustique_seul'] },
                    description:  { type: 'string' }
                  }
                }
              }
            },
            {
              type: 'object',
              required: ['op', 'source', 'cible'],
              properties: {
                op:     { const: 'remove_liaison' },
                source: { type: 'string' },
                cible:  { type: 'string' }
              }
            },
            {
              type: 'object',
              required: ['op', 'source', 'cible', 'changes'],
              properties: {
                op:      { const: 'update_liaison' },
                source:  { type: 'string' },
                cible:   { type: 'string' },
                changes: { type: 'object' }
              }
            },
            {
              type: 'object',
              required: ['op', 'changes'],
              properties: {
                op:      { const: 'update_global' },
                changes: {
                  type: 'object',
                  description: 'Mise à jour de contraintes_globales (merge partiel)'
                }
              }
            }
          ]
        }
      }
    }
  }
};

// -------------------------------------------------------
// APPLICATION DES OPÉRATIONS (déterministe)
// -------------------------------------------------------

function applyOperations(programme, operations) {
  let prog = JSON.parse(JSON.stringify(programme));
  const applied = [];
  const errors  = [];

  for (const op of operations) {
    try {
      switch (op.op) {
        case 'add_espace': {
          const existing = prog.espaces.find(e => e.id === op.espace.id);
          if (existing) {
            errors.push(`add_espace: id "${op.espace.id}" existe déjà`);
            break;
          }
          prog.espaces.push({
            quantite: 1,
            qualites: [],
            priorite: 3,
            dimensions: {},
            contraintes_op: {},
            ...op.espace
          });
          applied.push({ op: 'add_espace', id: op.espace.id });
          break;
        }

        case 'remove_espace': {
          const idx = prog.espaces.findIndex(e => e.id === op.espace_id);
          if (idx === -1) { errors.push(`remove_espace: "${op.espace_id}" introuvable`); break; }
          prog.espaces.splice(idx, 1);
          prog.liaisons = prog.liaisons.filter(l => l.source !== op.espace_id && l.cible !== op.espace_id);
          applied.push({ op: 'remove_espace', id: op.espace_id });
          break;
        }

        case 'update_espace': {
          const espace = prog.espaces.find(e => e.id === op.espace_id);
          if (!espace) { errors.push(`update_espace: "${op.espace_id}" introuvable`); break; }
          const { dimensions, contraintes_op, qualites, ...scalar } = op.changes;
          Object.assign(espace, scalar);
          if (dimensions)     espace.dimensions     = { ...espace.dimensions, ...dimensions };
          if (contraintes_op) espace.contraintes_op = { ...espace.contraintes_op, ...contraintes_op };
          if (qualites)       espace.qualites       = [...new Set(qualites)];
          applied.push({ op: 'update_espace', id: op.espace_id });
          break;
        }

        case 'add_liaison': {
          const exists = prog.liaisons.find(l => l.source === op.liaison.source && l.cible === op.liaison.cible);
          if (exists) {
            Object.assign(exists, op.liaison);
            applied.push({ op: 'update_liaison', source: op.liaison.source, cible: op.liaison.cible });
          } else {
            prog.liaisons.push({ permeabilite: 'porte', description: '', ...op.liaison });
            applied.push({ op: 'add_liaison', source: op.liaison.source, cible: op.liaison.cible });
          }
          break;
        }

        case 'remove_liaison': {
          const before = prog.liaisons.length;
          prog.liaisons = prog.liaisons.filter(l => !(l.source === op.source && l.cible === op.cible));
          if (prog.liaisons.length === before) errors.push(`remove_liaison: liaison ${op.source}→${op.cible} introuvable`);
          else applied.push({ op: 'remove_liaison', source: op.source, cible: op.cible });
          break;
        }

        case 'update_liaison': {
          const liaison = prog.liaisons.find(l => l.source === op.source && l.cible === op.cible);
          if (!liaison) { errors.push(`update_liaison: liaison ${op.source}→${op.cible} introuvable`); break; }
          Object.assign(liaison, op.changes);
          applied.push({ op: 'update_liaison', source: op.source, cible: op.cible });
          break;
        }

        case 'update_global': {
          prog.contraintes_globales = { ...(prog.contraintes_globales || {}), ...op.changes };
          applied.push({ op: 'update_global' });
          break;
        }

        default:
          errors.push(`Opération inconnue : ${op.op}`);
      }
    } catch (e) {
      errors.push(`${op.op}: ${e.message}`);
    }
  }

  return { programme: prog, applied, errors };
}

function buildDiffSummary(before, after, applied) {
  const beforeIds = new Set((before.espaces || []).map(e => e.id));
  const afterIds  = new Set((after.espaces  || []).map(e => e.id));

  return {
    added_espaces:     [...afterIds].filter(id => !beforeIds.has(id)),
    removed_espaces:   [...beforeIds].filter(id => !afterIds.has(id)),
    modified_espaces:  applied.filter(a => a.op === 'update_espace').map(a => a.id),
    added_liaisons:    applied.filter(a => a.op === 'add_liaison').map(a => `${a.source}→${a.cible}`),
    removed_liaisons:  applied.filter(a => a.op === 'remove_liaison').map(a => `${a.source}→${a.cible}`),
    modified_liaisons: applied.filter(a => a.op === 'update_liaison').map(a => `${a.source}→${a.cible}`)
  };
}

// -------------------------------------------------------
// MAIN — interprétation commande NL
// -------------------------------------------------------

const SYSTEM_DIALOGUE = `Tu es un assistant expert en programmation architecturale.
Tu aides l'architecte ou le maître d'ouvrage à affiner le programme spatial d'un bâtiment.

Règles :
- Toujours utiliser l'outil apply_programme_edits pour effectuer les modifications
- Ne pas modifier ce qui n'est pas demandé
- Si une commande est ambiguë, choisir l'interprétation la plus cohérente architecturalement
- Respecter la logique fonctionnelle (ex: ajouter une liaison cuisine→terrasse implique que les deux existent)
- Les ids sont en snake_case, les noms en français naturel
- Les surfaces sont en m², réalistes pour le type d'espace`;

export async function applyCommand(programme, command, options = {}) {
  const {
    apiKey    = process.env.ANTHROPIC_API_KEY,
    // Haiku 4.5 par défaut : opérations atomiques NL→JSON, mode standard (pas de thinking)
    // Benchmarks : CoT dégrade l'instruction following de 10-30% (arxiv 2505.11423)
    // Alternatives via DIALOGUE_MODEL :
    //   claude-sonnet-4-6              → commandes complexes, même provider
    //   deepseek/deepseek-v4-flash     → -86% coût, nécessite OPENROUTER_API_KEY
    model     = process.env.DIALOGUE_MODEL || 'claude-haiku-4-5-20251001',
    maxTokens = 3000
  } = options;

  const programmeSummary = {
    espaces: (programme.espaces || []).map(e => ({
      id:       e.id,
      nom:      e.nom,
      type:     e.type,
      surface:  e.dimensions?.surface_cible_m2,
      qualites: e.qualites
    })),
    liaisons: (programme.liaisons || []).map(l => ({
      source:     l.source,
      cible:      l.cible,
      type:       l.type,
      obligation: l.obligation
    })),
    contraintes_globales: programme.contraintes_globales
  };

  const userMessage = `Programme actuel :
\`\`\`json
${JSON.stringify(programmeSummary, null, 2)}
\`\`\`

Commande de modification : "${command}"

Applique cette modification en utilisant l'outil.`;

  let toolInput;

  if (model.startsWith('claude-')) {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_DIALOGUE,
      tools: [EDIT_TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: userMessage }]
    });
    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse || toolUse.name !== 'apply_programme_edits') {
      throw new Error('Commande non interprétée par Claude');
    }
    toolInput = toolUse.input;
  } else {
    toolInput = await callOpenRouter(model, SYSTEM_DIALOGUE, userMessage, [EDIT_TOOL]);
  }

  const { operations, reasoning } = toolInput;
  const { programme: updated, applied, errors } = applyOperations(programme, operations);
  const diff = buildDiffSummary(programme, updated, applied);

  return {
    programme:  updated,
    reasoning,
    operations: applied,
    errors,
    diff
  };
}

// -------------------------------------------------------
// SESSION CRUD (Supabase)
// -------------------------------------------------------

export async function createSession({ user_id, project_name, cdc_texte, guide_answers, programme, location, emprise, plu, template_ids }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({
      user_id:      user_id || null,
      project_name: project_name || 'Nouveau projet',
      cdc_texte:    cdc_texte || null,
      guide_answers: guide_answers || {},
      programme:    programme || {},
      location:     location  || {},
      emprise:      emprise   || { largeur: 20, profondeur: 15 },
      plu:          plu       || {},
      template_ids: template_ids || [],
      status:       'functional_schema',
      phase:        1
    })
    .select()
    .single();

  if (error) throw new Error(`createSession: ${error.message}`);
  await appendHistory(data.id, 'init', null, null, programme, {});
  return data;
}

export async function getSession(id) {
  const supabase = getSupabaseClient();
  const [{ data: session, error: se }, { data: history, error: he }] = await Promise.all([
    supabase.from('generation_sessions').select('*').eq('id', id).single(),
    supabase.from('session_history').select('*').eq('session_id', id).order('created_at', { ascending: true })
  ]);
  if (se) throw new Error(`getSession: ${se.message}`);
  if (he) throw new Error(`getHistory: ${he.message}`);
  return { ...session, history: history || [] };
}

export async function updateSessionProgramme(id, programme, { status } = {}) {
  const supabase = getSupabaseClient();
  const updates = { programme };
  if (status) updates.status = status;
  const { data, error } = await supabase
    .from('generation_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`updateSessionProgramme: ${error.message}`);
  return data;
}

export async function lockFunctionalSchema(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generation_sessions')
    .update({ status: 'schema_locked', phase: 2 })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`lockFunctionalSchema: ${error.message}`);
  await appendHistory(id, 'phase_change', null, null, null, { phase: 2, status: 'schema_locked' });
  return data;
}

export async function saveGenerationResult(id, result) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generation_sessions')
    .update({
      generation_result: result,
      score_layout:      result.score_layout || null,
      status:            result.steps ? 'done' : 'error',
      phase:             3
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`saveGenerationResult: ${error.message}`);
  return data;
}

export async function listSessions(user_id, { status, limit = 20 } = {}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('generation_sessions')
    .select('id, project_name, status, phase, score_layout, created_at, updated_at')
    .eq('user_id', user_id)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`listSessions: ${error.message}`);
  return data;
}

// -------------------------------------------------------
// HISTORY
// -------------------------------------------------------

export async function appendHistory(session_id, action, command, programme_before, programme_after, metadata = {}) {
  const supabase = getSupabaseClient();
  const diff = programme_before && programme_after
    ? buildDiffSummary(programme_before, programme_after, [])
    : {};

  const { error } = await supabase
    .from('session_history')
    .insert({
      session_id,
      action,
      command:          command || null,
      programme_before: programme_before || null,
      programme_after:  programme_after  || null,
      diff_summary:     diff,
      metadata
    });

  if (error) console.error('appendHistory error (non-bloquant):', error.message);
}

// -------------------------------------------------------
// COMMANDE COMPLÈTE avec persistance
// -------------------------------------------------------

export async function applyCommandAndPersist(sessionId, command, options = {}) {
  const session = await getSession(sessionId);
  if (session.status === 'schema_locked' && !options.forceEdit) {
    throw new Error('Schéma fonctionnel verrouillé. Utilisez forceEdit=true pour modifier.');
  }

  const programmeBefore = session.programme;
  const { programme, reasoning, operations, errors, diff } = await applyCommand(programmeBefore, command, options);

  if (operations.length === 0) {
    throw new Error(`Aucune opération appliquée${errors.length > 0 ? ' : ' + errors[0] : ''}`);
  }

  await updateSessionProgramme(sessionId, programme);
  await appendHistory(sessionId, 'dialogue_edit', command, programmeBefore, programme, { reasoning, errors });

  return {
    programme,
    reasoning,
    diff,
    errors,
    session_id: sessionId
  };
}
