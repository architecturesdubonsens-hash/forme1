/**
 * cdc-parser.js
 * Traduit un cahier des charges libre en programme architectural JSON structuré
 * via Claude API, puis enrichit les contraintes opérationnelles (L1→L2).
 */

import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

let _schema = null;
function getSchema() {
  if (!_schema) {
    _schema = JSON.parse(readFileSync(join(__dirname, 'programme-schema.json'), 'utf8'));
  }
  return _schema;
}

const QUALITES_OPERATIONNELLES = {
  lumineux: {
    ensoleillement_min_heures: 4,
    orientation_preferee: ['S', 'SE', 'SW', 'E'],
    facade_preferee: true,
    ratio_vitrage_min: 0.25
  },
  sombre: {
    ensoleillement_min_heures: 0,
    orientation_preferee: ['N', 'NE', 'NW'],
    ratio_vitrage_max: 0.15
  },
  traversant: {
    double_orientation: true,
    ventilation_naturelle: true
  },
  aveugle: {
    ratio_vitrage_max: 0.05,
    facade_preferee: false
  },
  calme: {
    isolation_acoustique_db: 45,
    orientation_preferee: ['N', 'NE', 'NW', 'W'],
    separation_circulation: true
  },
  actif: {
    isolation_acoustique_db: 30
  },
  intime: {
    position_preferee: 'etage',
    separation_circulation: true
  },
  représentatif: {
    position_preferee: 'rdc',
    facade_preferee: true,
    hauteur_libre_min_m: 2.7
  },
  flexible: {
    hauteur_libre_min_m: 2.7
  },
  haute_hauteur: {
    hauteur_libre_min_m: 3.2
  },
  compressé: {
    hauteur_libre_min_m: 2.2
  },
  accessible_pmr: {
    acces_pmr: true,
    position_preferee: 'rdc'
  },
  vue_extérieure: {
    facade_preferee: true,
    ratio_vitrage_min: 0.20
  },
  vue_jardin: {
    orientation_preferee: ['S', 'SE', 'SW'],
    facade_preferee: true
  },
  vue_rue: {
    orientation_preferee: ['N', 'NE', 'NW'],
    facade_preferee: true
  },
  vue_cour: {
    facade_preferee: true
  },
  ventilé_naturellement: {
    ventilation_naturelle: true,
    double_orientation: true
  },
  climatisé: {
    ventilation_naturelle: false
  },
  acoustiquement_isolé: {
    isolation_acoustique_db: 50,
    separation_circulation: true
  },
  acoustiquement_ouvert: {
    isolation_acoustique_db: 20
  },
  technique: {
    position_preferee: 'sous_sol',
    acces_pmr: false
  },
  privé: {
    separation_circulation: true,
    position_preferee: 'etage'
  },
  public: {
    position_preferee: 'rdc',
    acces_pmr: true
  },
  semi_privé: {
    position_preferee: 'rdc'
  },
  sécurisé: {
    separation_circulation: true,
    acces_pmr: false
  }
};

const SYSTEM_PROMPT = `Tu es un expert en programmation architecturale. Tu analyses des cahiers des charges de projets de construction et tu les traduis en programmes architecturaux structurés au format JSON.

Ta sortie doit strictement respecter le schéma JSON fourni. Sois précis et exhaustif dans l'identification des espaces et de leurs relations.

Règles importantes :
- Chaque espace doit avoir un id unique en snake_case (ex: sejour_principal, chambre_1)
- Si un espace est mentionné plusieurs fois (ex: "3 chambres"), créer 3 espaces séparés avec des ids distincts OU utiliser le champ quantite
- Les liaisons représentent les relations spatiales : directe = contigus avec passage, proximite = proches mais pas forcément contigus, separation_absolue = ne doivent pas être adjacents
- L'obligation : absolue = contrainte irréductible, forte = très souhaitable, optionnelle = si possible
- Les qualités déclaratives sont les termes du vocabulaire spatial défini dans le schéma
- Inclure des dimensions réalistes si non précisées (ex: séjour 25-35m², chambre 12-20m²)`;

export async function parseCahierDesCharges(texte_cdc, options = {}) {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = 'claude-sonnet-4-6',
    temperature = 0.3,
    maxTokens = 8000,
    schema = getSchema()
  } = options;

  const client = new Anthropic({ apiKey });

  const prompt = `Voici le cahier des charges à analyser :

---
${texte_cdc}
---

Génère un programme architectural JSON conforme à ce schéma :
${JSON.stringify(schema, null, 2)}

Retourne UNIQUEMENT le JSON valide, sans markdown ni explication.`;

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  const rawJson = message.content[0].text.trim();
  let programme;
  try {
    programme = JSON.parse(rawJson);
  } catch (e) {
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      programme = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Impossible de parser la réponse Claude : ${e.message}`);
    }
  }

  programme = enrichirContraintesOperationnelles(programme);

  programme.metadata = {
    version: '1.0',
    created_at: new Date().toISOString(),
    source_cdc: texte_cdc.substring(0, 200),
    ...programme.metadata
  };

  const { valide, erreurs } = validerProgramme(programme, schema);
  programme.metadata.confiance = calculerConfiance(programme, erreurs);
  programme.metadata.valide = valide;
  if (erreurs.length > 0) {
    programme.metadata.erreurs_validation = erreurs;
  }

  return programme;
}

export function enrichirContraintesOperationnelles(programme) {
  for (const espace of programme.espaces) {
    if (!espace.qualites || espace.qualites.length === 0) continue;

    const cop = espace.contraintes_op || {};

    for (const qualite of espace.qualites) {
      const params = QUALITES_OPERATIONNELLES[qualite];
      if (!params) continue;

      for (const [key, val] of Object.entries(params)) {
        if (cop[key] === undefined) {
          cop[key] = val;
        } else if (key === 'orientation_preferee' && Array.isArray(val)) {
          cop[key] = [...new Set([...(cop[key] || []), ...val])];
        } else if (key === 'ensoleillement_min_heures') {
          cop[key] = Math.max(cop[key] || 0, val);
        } else if (key === 'isolation_acoustique_db') {
          cop[key] = Math.max(cop[key] || 0, val);
        } else if (key === 'ratio_vitrage_min') {
          cop[key] = Math.max(cop[key] || 0, val);
        } else if (key === 'ratio_vitrage_max') {
          cop[key] = cop[key] !== undefined ? Math.min(cop[key], val) : val;
        } else if (key === 'hauteur_libre_min_m') {
          cop[key] = Math.max(cop[key] || 0, val);
        }
      }
    }

    espace.contraintes_op = cop;
  }

  return programme;
}

export function validerProgramme(programme, schema = getSchema()) {
  const validate = ajv.compile(schema);
  const valide = validate(programme);
  const erreurs = valide ? [] : (validate.errors || []).map(e =>
    `${e.instancePath || '/'} ${e.message}`
  );
  return { valide, erreurs };
}

export function extraireQuestionsClarification(programme) {
  const questions = [];

  for (const espace of programme.espaces) {
    if (!espace.dimensions?.surface_cible_m2 && !espace.dimensions?.surface_min_m2) {
      questions.push(`Quelle surface souhaitez-vous pour "${espace.nom}" ?`);
    }
    if (!espace.qualites || espace.qualites.length === 0) {
      questions.push(`Quelles ambiances souhaitez-vous pour "${espace.nom}" ? (ex: lumineux, calme, intime...)`);
    }
  }

  if (!programme.contraintes_globales?.emprise_max_m2 && !programme.contraintes_globales?.surface_plancher_max_m2) {
    questions.push('Quelle est la surface de terrain disponible ou la SHON maximale autorisée ?');
  }

  if (!programme.contraintes_globales?.niveaux_max) {
    questions.push('Combien de niveaux sont autorisés ou souhaités ?');
  }

  const liaisonsIds = new Set([
    ...programme.liaisons.map(l => l.source),
    ...programme.liaisons.map(l => l.cible)
  ]);
  for (const espace of programme.espaces) {
    if (!liaisonsIds.has(espace.id)) {
      questions.push(`L'espace "${espace.nom}" n'a aucune liaison définie — est-il isolé intentionnellement ?`);
    }
  }

  return questions;
}

export function calculerConfiance(programme, erreurs) {
  let score = 1.0;

  score -= erreurs.length * 0.05;

  const espacesAvecDimensions = programme.espaces.filter(e => e.dimensions?.surface_cible_m2 || e.dimensions?.surface_min_m2).length;
  const ratiosDimensions = espacesAvecDimensions / programme.espaces.length;
  score -= (1 - ratiosDimensions) * 0.2;

  const espacesAvecQualites = programme.espaces.filter(e => e.qualites?.length > 0).length;
  const ratioQualites = espacesAvecQualites / programme.espaces.length;
  score -= (1 - ratioQualites) * 0.1;

  if (programme.liaisons.length < programme.espaces.length - 1) {
    score -= 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const texte = process.argv[2] || `
    Maison individuelle de 4 personnes.
    Rez-de-chaussée : séjour lumineux et traversant ouvert sur le jardin,
    cuisine ouverte sur séjour, WC visiteurs accessible PMR.
    Étage : 3 chambres dont une suite parentale avec salle de bain privative et dressing,
    2 chambres enfants, salle de bain familiale, WC séparé.
    Garage 2 voitures avec accès direct à la maison.
    Budget : 350 000€ HT.
  `;

  try {
    const programme = await parseCahierDesCharges(texte);
    console.log(JSON.stringify(programme, null, 2));
    const questions = extraireQuestionsClarification(programme);
    if (questions.length > 0) {
      console.error('\nQuestions de clarification :');
      questions.forEach(q => console.error('  -', q));
    }
  } catch (e) {
    console.error('Erreur:', e.message);
    process.exit(1);
  }
}
