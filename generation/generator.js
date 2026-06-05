/**
 * generator.js
 * Pipeline principal de génération bâtiment :
 * CdC texte → programme JSON → layout 2D → IFC → GLB → VIZinSITU
 */

import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { parseCahierDesCharges, extraireQuestionsClarification } from './cdc-parser.js';
import { resolveLayout, layoutToSVG } from './layout-engine.js';
import { prepareVizinSituPackage } from './vizinsitu-connector.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  outputDir: process.env.GENERATION_OUTPUT_DIR || '/tmp/generation-output',
  pythonBin: process.env.PYTHON_BIN || 'python3',
  blenderBin: process.env.BLENDER_BIN || 'blender',
  maxLayoutAttempts: 3,
  scoreMinAcceptable: 60
};

function coutUnitaireParType(type) {
  const couts = {
    logement_individuel: { min: 1800, max: 2800 },
    logement_collectif:  { min: 1600, max: 2500 },
    bureau:              { min: 2200, max: 3500 },
    commerce:            { min: 1800, max: 3000 },
    equipement_public:   { min: 2500, max: 4000 },
    industriel:          { min: 800,  max: 1500 },
    agricole:            { min: 400,  max: 900  }
  };
  return couts[type] || { min: 1800, max: 3000 };
}

function detecterTypologiePrincipale(programme) {
  const types = (programme.espaces || []).map(e => e.type);
  if (types.includes('chambre') && types.includes('sejour')) return 'logement_individuel';
  if (types.includes('open_space') || types.includes('bureau')) return 'bureau';
  if (types.includes('commerces') || types.includes('restaurant')) return 'commerce';
  return 'logement_individuel';
}

export function calculerMetresSommaires(layout, programme) {
  let shob = 0;
  let shon = 0;
  let lineaireFacades = 0;

  for (const [niveau, rects] of Object.entries(layout.rectangles || {})) {
    for (const r of rects) {
      shob += r.surface_m2 || (r.w * r.h);
    }
    if (rects.length > 0) {
      const minX = Math.min(...rects.map(r => r.x));
      const minY = Math.min(...rects.map(r => r.y));
      const maxX = Math.max(...rects.map(r => r.x + r.w));
      const maxY = Math.max(...rects.map(r => r.y + r.h));
      lineaireFacades += 2 * ((maxX - minX) + (maxY - minY));
    }
  }

  shon = shob * 0.87;

  const typo = detecterTypologiePrincipale(programme);
  const { min: cMin, max: cMax } = coutUnitaireParType(typo);

  const linairesMurs = lineaireFacades * 1.2;
  const volumeMurs = linairesMurs * 2.75 * 0.25;
  const surfaceDalles = shob;

  return {
    shob: Math.round(shob * 10) / 10,
    shon: Math.round(shon * 10) / 10,
    lineaire_facades_m: Math.round(lineaireFacades * 10) / 10,
    lineaire_murs_total_m: Math.round(linairesMurs * 10) / 10,
    volume_murs_m3: Math.round(volumeMurs * 10) / 10,
    surface_dalles_m2: Math.round(surfaceDalles * 10) / 10,
    estimation_cout: {
      min_eur: Math.round(shon * cMin / 1000) * 1000,
      max_eur: Math.round(shon * cMax / 1000) * 1000,
      base: `${cMin}–${cMax} €/m² SHON (${typo})`
    }
  };
}

async function runPython(args, timeout = 60000) {
  const { stdout, stderr } = await execFileAsync(CONFIG.pythonBin, args, { timeout });
  return { stdout, stderr };
}

export async function generateBuilding(input) {
  const {
    texte_cdc,
    location = {},
    emprise = { largeur: 20, profondeur: 15 },
    projectName = `projet-${Date.now()}`,
    generateIfc = true,
    generateGlb = false
  } = input;

  const projectId = randomUUID();
  const outputDir = join(CONFIG.outputDir, projectId);
  mkdirSync(outputDir, { recursive: true });

  const result = {
    projectId,
    outputDir,
    steps: {},
    fichiers: {},
    metres: null,
    score_layout: 0,
    violations: []
  };

  // Étape 1 : Parsing CdC
  console.log('[1/6] Parsing cahier des charges...');
  let programme;
  try {
    programme = await parseCahierDesCharges(texte_cdc);
    result.steps.parsing = { ok: true, confiance: programme.metadata?.confiance };
    const progPath = join(outputDir, 'programme.json');
    writeFileSync(progPath, JSON.stringify(programme, null, 2));
    result.fichiers.programme = progPath;

    const questions = extraireQuestionsClarification(programme);
    if (questions.length > 0) {
      result.questions_clarification = questions;
      console.warn(`[1/6] ${questions.length} question(s) de clarification identifiée(s)`);
    }
  } catch (e) {
    result.steps.parsing = { ok: false, error: e.message };
    throw new Error(`Parsing CdC échoué : ${e.message}`);
  }

  // Étape 2 : Layout 2D
  console.log('[2/6] Calcul du layout 2D...');
  let layout;
  let bestLayout = null;
  let bestScore = -1;

  for (let attempt = 1; attempt <= CONFIG.maxLayoutAttempts; attempt++) {
    try {
      layout = resolveLayout(programme, emprise);
      if (layout.score > bestScore) {
        bestScore = layout.score;
        bestLayout = layout;
      }
      if (layout.score >= CONFIG.scoreMinAcceptable) break;
      console.warn(`[2/6] Tentative ${attempt} — score ${layout.score} < ${CONFIG.scoreMinAcceptable}, retry...`);
    } catch (e) {
      console.error(`[2/6] Tentative ${attempt} échouée :`, e.message);
    }
  }

  layout = bestLayout;
  result.score_layout = layout.score;
  result.violations = layout.violations;
  result.steps.layout = { ok: true, score: layout.score, violations: layout.violations.length };

  const layoutPath = join(outputDir, 'layout.json');
  writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
  result.fichiers.layout = layoutPath;

  const svgContent = layoutToSVG(layout);
  const svgPath = join(outputDir, 'layout.svg');
  writeFileSync(svgPath, svgContent);
  result.fichiers.svg = svgPath;

  // Étape 3 : IFC
  if (generateIfc) {
    console.log('[3/6] Génération IFC...');
    const ifcPath = join(outputDir, `${projectName}.ifc`);
    try {
      await runPython([
        join(__dirname, 'volumetry.py'),
        layoutPath,
        join(outputDir, 'programme.json'),
        ifcPath
      ]);
      result.fichiers.ifc = ifcPath;
      result.steps.ifc = { ok: true };
    } catch (e) {
      result.steps.ifc = { ok: false, error: e.message };
      console.error('[3/6] IFC échoué (non bloquant) :', e.message);
    }
  }

  // Étape 4 : GLB
  if (generateGlb && result.fichiers.ifc) {
    console.log('[4/6] Export GLB via Blender...');
    const glbPath = join(outputDir, `${projectName}.glb`);
    try {
      await runPython([
        '-c',
        `
import json, sys
sys.path.insert(0, '${__dirname}')
from volumetry import VolumetryGenerator
import json
layout = json.load(open('${layoutPath}'))
programme = json.load(open('${join(outputDir, 'programme.json')}'))
gen = VolumetryGenerator(layout, programme)
gen.generate()
gen.export_glb('${glbPath}', '${CONFIG.blenderBin}')
`
      ]);
      result.fichiers.glb = glbPath;
      result.steps.glb = { ok: true };
    } catch (e) {
      result.steps.glb = { ok: false, error: e.message };
      console.error('[4/6] GLB échoué (non bloquant) :', e.message);
    }
  }

  // Étape 5 : VIZinSITU package
  console.log('[5/6] Génération paquet VIZinSITU...');
  try {
    const vizPkg = await prepareVizinSituPackage({
      glbFile: result.fichiers.glb ? `${projectName}.glb` : null,
      outputDir,
      projectName,
      location,
      programme,
      layout
    });
    result.fichiers.vizinsitu_link = vizPkg.linkPath;
    result.fichiers.vizinsitu_notice = vizPkg.noticePath;
    result.steps.vizinsitu = { ok: true, architectureLock: vizPkg.link.render.architectureLock };
  } catch (e) {
    result.steps.vizinsitu = { ok: false, error: e.message };
    console.error('[5/6] VIZinSITU package échoué :', e.message);
  }

  // Étape 6 : Métrés
  console.log('[6/6] Calcul métrés sommaires...');
  try {
    result.metres = calculerMetresSommaires(layout, programme);
    result.steps.metres = { ok: true };
    const metresPath = join(outputDir, 'metres.json');
    writeFileSync(metresPath, JSON.stringify(result.metres, null, 2));
    result.fichiers.metres = metresPath;
  } catch (e) {
    result.steps.metres = { ok: false, error: e.message };
  }

  console.log(`[OK] Génération terminée — score: ${result.score_layout}/100, violations: ${result.violations.length}`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const texte = readFileSync(process.argv[2] || '/dev/stdin', 'utf8');
  try {
    const result = await generateBuilding({ texte_cdc: texte, generateIfc: true });
    console.log(JSON.stringify({
      projectId: result.projectId,
      score: result.score_layout,
      violations: result.violations.length,
      metres: result.metres,
      fichiers: Object.fromEntries(
        Object.entries(result.fichiers).map(([k, v]) => [k, v.split('/').pop()])
      )
    }, null, 2));
  } catch (e) {
    console.error('Erreur:', e.message);
    process.exit(1);
  }
}
