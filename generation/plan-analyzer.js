/**
 * plan-analyzer.js
 * Analyse des plans architecturaux via Claude Vision.
 * Extrait espaces, surfaces, liaisons, flux et contacts extérieurs
 * pour alimenter la bibliothèque typologique.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = `Tu es un expert en programmation architecturale et en lecture de plans de bâtiments.
Tu analyses des plans architecturaux (images) pour en extraire le programme spatial structuré.

Pour chaque plan fourni :
1. Identifie tous les espaces (pièces, locaux, dégagements) avec leurs noms et usages
2. Estime les surfaces en m² d'après les proportions visuelles et les dimensions standards
3. Identifie les liaisons entre espaces (adjacence directe, flux de circulation, séparations)
4. Identifie les contacts avec l'extérieur (façade rue, jardin, cour, pignon, toit-terrasse)
5. Identifie les axes de circulation principaux et les entrées
6. Déduis les qualités déclaratives probables (lumineux, représentatif, intime, etc.)

Si plusieurs plans sont fournis (RDC + étage, etc.), analyse chacun et combine-les.

Vocabulaire de qualités autorisé :
lumineux, sombre, traversant, aveugle, calme, actif, intime, représentatif,
flexible, dédié, ouvert, cloisonné, accessible_pmr, technique, naturel, minéral,
chaud, froid, humide, sec, haute_hauteur, standard, compressé,
vue_extérieure, vue_jardin, vue_rue, vue_cour,
ventilé_naturellement, climatisé, acoustiquement_isolé, acoustiquement_ouvert,
sécurisé, public, privé, semi_privé

Types d'espaces autorisés :
entrée, séjour, cuisine, salle_a_manger, chambre, suite_parentale, dressing,
salle_de_bain, wc, bureau, bibliothèque, espace_jeux, salle_cinema, cave,
garage, abri_voiture, local_technique, buanderie, cellier, rangement,
terrasse, balcon, loggia, jardin_d_hiver, véranda, patio,
open_space, salle_reunion, accueil, cafeteria, archives, local_serveur,
commerce, hall, circulations, escalier, ascenseur, autre`;

const EXTRACTION_TOOL = {
  name: 'extraire_programme',
  description: 'Extrait le programme architectural structuré depuis les plans analysés',
  input_schema: {
    type: 'object',
    required: ['espaces', 'liaisons', 'contacts_exterieurs', 'circulation', 'niveaux', 'observations'],
    properties: {
      espaces: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'nom', 'type', 'niveau'],
          properties: {
            id:          { type: 'string', description: 'Identifiant snake_case unique' },
            nom:         { type: 'string' },
            type:        { type: 'string' },
            niveau:      { type: 'string', enum: ['sous_sol', 'rdc', 'etage', 'combles', 'toiture'] },
            surface_estimee_m2: { type: 'number', minimum: 1 },
            largeur_estimee_m:  { type: 'number', minimum: 0.5 },
            longueur_estimee_m: { type: 'number', minimum: 0.5 },
            qualites: {
              type: 'array',
              items: { type: 'string' }
            },
            contacts_exterieurs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Noms des facades/jardins auxquels cet espace est exposé'
            },
            est_circulation: { type: 'boolean', default: false }
          }
        }
      },
      liaisons: {
        type: 'array',
        items: {
          type: 'object',
          required: ['source', 'cible', 'type', 'obligation'],
          properties: {
            source:      { type: 'string' },
            cible:       { type: 'string' },
            type:        { type: 'string', enum: ['directe', 'indirecte', 'proximite', 'separation_absolue', 'flux_physique', 'relation_visuelle'] },
            obligation:  { type: 'string', enum: ['absolue', 'forte', 'optionnelle'] },
            permeabilite:{ type: 'string', enum: ['porte', 'ouverture_large', 'vitrage', 'mur_plein', 'acoustique_seul'] },
            description: { type: 'string' }
          }
        }
      },
      contacts_exterieurs: {
        type: 'object',
        description: 'Mapping facade_id → [espace_ids exposés]',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      circulation: {
        type: 'object',
        properties: {
          entrees_principales: { type: 'array', items: { type: 'string' } },
          entrees_secondaires: { type: 'array', items: { type: 'string' } },
          axes_principaux:     { type: 'array', items: { type: 'string' }, description: 'IDs des espaces de circulation' },
          escaliers:           { type: 'array', items: { type: 'string' } }
        }
      },
      niveaux: {
        type: 'array',
        items: { type: 'string', enum: ['sous_sol', 'rdc', 'etage', 'combles', 'toiture'] }
      },
      observations: { type: 'string', description: 'Notes libres sur le plan, incertitudes, éléments remarquables' },
      echelle_detectee: { type: 'string', description: 'Échelle ou indice de taille détecté dans le plan' }
    }
  }
};

function buildImageContent(images) {
  return images.map(img => {
    if (img.url) {
      return { type: 'image', source: { type: 'url', url: img.url } };
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.media_type || 'image/jpeg',
        data: img.data
      }
    };
  });
}

function normaliserExtraction(extraction, typology) {
  const espaces = (extraction.espaces || []).map(e => ({
    id: e.id,
    nom: e.nom,
    type: e.type,
    quantite: 1,
    dimensions: {
      surface_min_m2:    e.surface_estimee_m2 ? Math.round(e.surface_estimee_m2 * 0.8) : undefined,
      surface_cible_m2:  e.surface_estimee_m2 ? Math.round(e.surface_estimee_m2)       : undefined,
      surface_max_m2:    e.surface_estimee_m2 ? Math.round(e.surface_estimee_m2 * 1.2) : undefined,
      largeur_min_m:     e.largeur_estimee_m,
      longueur_min_m:    e.longueur_estimee_m
    },
    qualites: (e.qualites || []).filter(q => QUALITES_VALIDES.has(q)),
    contraintes_op: {},
    priorite: e.est_circulation ? 2 : 3,
    niveau_prefere: e.niveau
  }));

  const liaisons = (extraction.liaisons || []).map(l => ({
    source: l.source,
    cible: l.cible,
    type: l.type,
    obligation: l.obligation,
    permeabilite: l.permeabilite || 'porte',
    description: l.description || ''
  }));

  const surfaceTotale = espaces.reduce((s, e) => s + (e.dimensions.surface_cible_m2 || 0), 0);
  const liaisonsAbsolues = liaisons.filter(l => l.obligation === 'absolue').length;

  const stats = {
    nb_espaces:              espaces.length,
    surface_totale_m2:       Math.round(surfaceTotale),
    nb_liaisons:             liaisons.length,
    ratio_liaisons_absolues: liaisons.length > 0
      ? Math.round((liaisonsAbsolues / liaisons.length) * 100) / 100
      : 0,
    niveaux:                 extraction.niveaux || ['rdc'],
    contacts_exterieurs:     extraction.contacts_exterieurs || {},
    circulation:             extraction.circulation || {}
  };

  return {
    programme: {
      espaces,
      liaisons,
      contraintes_globales: {},
      typology_source: typology
    },
    stats,
    observations: extraction.observations || '',
    echelle_detectee: extraction.echelle_detectee || null
  };
}

const QUALITES_VALIDES = new Set([
  'lumineux', 'sombre', 'traversant', 'aveugle', 'calme', 'actif', 'intime',
  'représentatif', 'flexible', 'dédié', 'ouvert', 'cloisonné', 'accessible_pmr',
  'technique', 'naturel', 'minéral', 'chaud', 'froid', 'humide', 'sec',
  'haute_hauteur', 'standard', 'compressé', 'vue_extérieure', 'vue_jardin',
  'vue_rue', 'vue_cour', 'ventilé_naturellement', 'climatisé',
  'acoustiquement_isolé', 'acoustiquement_ouvert', 'sécurisé', 'public', 'privé', 'semi_privé'
]);

export async function analyzePlans(images, options = {}) {
  const {
    apiKey      = process.env.ANTHROPIC_API_KEY,
    model       = 'claude-sonnet-4-6',
    typology    = 'autre',
    context     = '',
    maxTokens   = 6000
  } = options;

  if (!images || images.length === 0) {
    throw new Error('Au moins une image de plan est requise');
  }

  const client = new Anthropic({ apiKey });

  const textContent = {
    type: 'text',
    text: `Analyse ${images.length > 1 ? 'ces plans architecturaux' : 'ce plan architectural'}.
${context ? `\nContexte fourni : ${context}` : ''}
${typology !== 'autre' ? `\nTypologie présumée : ${typology}` : ''}

Extrais le programme spatial complet en utilisant l'outil extraire_programme.
Sois précis sur les surfaces, les liaisons fonctionnelles et les contacts avec l'extérieur.`
  };

  const imageContents = buildImageContent(images);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'any' },
    messages: [{
      role: 'user',
      content: [textContent, ...imageContents]
    }]
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.name !== 'extraire_programme') {
    throw new Error('Claude n\'a pas utilisé l\'outil d\'extraction — réponse inattendue');
  }

  const extraction = toolUse.input;
  const { programme, stats, observations, echelle_detectee } = normaliserExtraction(extraction, typology);

  const nbEspaces = programme.espaces.length;
  const nbLiaisons = programme.liaisons.length;
  const nbQualites = programme.espaces.filter(e => e.qualites?.length > 0).length;
  const nbSurfaces = programme.espaces.filter(e => e.dimensions?.surface_cible_m2).length;

  const confiance = Math.min(1, Math.max(0.3,
    (nbEspaces > 2 ? 0.3 : 0.1) +
    (nbLiaisons > 0 ? 0.2 : 0) +
    (nbQualites / Math.max(nbEspaces, 1)) * 0.25 +
    (nbSurfaces / Math.max(nbEspaces, 1)) * 0.25
  ));

  return {
    programme,
    stats,
    observations,
    echelle_detectee,
    confiance: Math.round(confiance * 100) / 100,
    model_used: model,
    images_analyzed: images.length
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: node plan-analyzer.js <image_path> [typology]');
    process.exit(1);
  }
  const data = readFileSync(imagePath).toString('base64');
  const ext  = imagePath.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  try {
    const result = await analyzePlans(
      [{ data, media_type: mime }],
      { typology: process.argv[3] || 'autre' }
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Erreur:', e.message);
    process.exit(1);
  }
}
