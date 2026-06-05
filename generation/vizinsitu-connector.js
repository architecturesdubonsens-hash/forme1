/**
 * vizinsitu-connector.js
 * Génère le paquet de handoff vers VIZinSITU :
 *   - vizinsitu-link.json
 *   - notice opérateur Markdown
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_ARCHITECTURE_LOCK = 70;
const DEFAULT_MATERIAL_LOCK = 50;
const DEFAULT_CREATIVITY = 60;

function deriverArchitectureLock(programme, layout) {
  let lock = DEFAULT_ARCHITECTURE_LOCK;

  const liaisonsAbsolues = (programme.liaisons || []).filter(l => l.obligation === 'absolue').length;
  const totalLiaisons = (programme.liaisons || []).length || 1;
  const ratioAbsolu = liaisonsAbsolues / totalLiaisons;
  lock += ratioAbsolu * 15;

  const contraintes = programme.contraintes_globales || {};
  if (contraintes.plu?.cos || contraintes.emprise_max_m2) lock += 5;
  if (contraintes.pmr) lock += 3;
  if (contraintes.re2020) lock += 3;

  if (layout?.score < 70) lock -= 10;

  return Math.round(Math.min(95, Math.max(30, lock)));
}

function deriverMaterialLock(programme) {
  let lock = DEFAULT_MATERIAL_LOCK;

  const qualitesMateriaux = ['naturel', 'minéral', 'chaud', 'froid'];
  const allQualites = (programme.espaces || []).flatMap(e => e.qualites || []);
  const nbQualitesMat = allQualites.filter(q => qualitesMateriaux.includes(q)).length;
  if (nbQualitesMat > 0) lock += Math.min(20, nbQualitesMat * 5);

  return Math.round(Math.min(90, Math.max(20, lock)));
}

function deriverCreativity(programme, architectureLock) {
  return Math.round(Math.max(10, 100 - architectureLock + 10));
}

export function buildPromptSupplement(programme, layout) {
  const parts = [];
  const allQualites = (programme.espaces || []).flatMap(e => e.qualites || []);
  const countQualite = (q) => allQualites.filter(x => x === q).length;

  if (countQualite('lumineux') > 2) {
    parts.push('Large glazing, maximizing natural light throughout');
  }
  if (countQualite('naturel') > 0) {
    parts.push('Natural materials: wood, stone, exposed concrete');
  }
  if (countQualite('minéral') > 0) {
    parts.push('Mineral aesthetic: concrete, stone, stucco');
  }
  if (allQualites.includes('haute_hauteur')) {
    parts.push('Generous ceiling heights in key spaces');
  }
  if (programme.contraintes_globales?.re2020) {
    parts.push('Contemporary sustainable architecture, visible insulation performance');
  }
  if (programme.references_typologiques?.length > 0) {
    parts.push(`Reference typologies: ${programme.references_typologiques.join(', ')}`);
  }
  if (programme.objectifs_conception?.length > 0) {
    parts.push(...programme.objectifs_conception.slice(0, 3));
  }

  return parts.join('. ') || 'Contemporary residential architecture, clean lines, quality materials';
}

export function generateVizinSituLink(options = {}) {
  const {
    glbFile,
    location = {},
    programme = {},
    layout = {},
    projectName = 'projet',
    scale = 1.0,
    architectureLock = null,
    materialLock = null,
    creativity = null,
    style = 'photorealistic'
  } = options;

  const archLock = architectureLock ?? deriverArchitectureLock(programme, layout);
  const matLock = materialLock ?? deriverMaterialLock(programme);
  const creat = creativity ?? deriverCreativity(programme, archLock);
  const promptSupplement = buildPromptSupplement(programme, layout);

  return {
    vizinsitu: '1.0',
    location: {
      lat: location.lat ?? 48.8566,
      lng: location.lng ?? 2.3522,
      altitude: location.altitude ?? 0,
      trueNorth: location.trueNorth ?? 0,
      groundElevation: location.groundElevation ?? 0
    },
    model: {
      file: glbFile || `${projectName}.glb`,
      scale
    },
    render: {
      architectureLock: archLock,
      materialLock: matLock,
      creativity: creat,
      style,
      promptSupplement
    },
    metadata: {
      projectName,
      generatedAt: new Date().toISOString(),
      layoutScore: layout.score ?? null,
      generator: 'capinsitu-generation-v1'
    }
  };
}

export function saveVizinSituLink(link, outputDir, projectName = 'projet') {
  mkdirSync(outputDir, { recursive: true });
  const linkPath = join(outputDir, `${projectName}-vizinsitu-link.json`);
  writeFileSync(linkPath, JSON.stringify(link, null, 2));
  return linkPath;
}

function buildNoticeOperateur(link, programme, layout) {
  const { render, location, model } = link;
  const violations = layout?.violations || [];
  const critiques = violations.filter(v => v.type === 'CRITIQUE');

  return `# Notice VIZinSITU — ${link.metadata?.projectName || 'Projet'}

**Généré le** : ${new Date().toISOString().split('T')[0]}
**Score layout** : ${layout?.score ?? 'N/A'}/100

---

## Paramètres de rendu recommandés

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| architectureLock | **${render.architectureLock}** | Contraintes programme : ${render.architectureLock > 75 ? 'fortes' : 'modérées'} |
| materialLock | **${render.materialLock}** | Palette matériaux : ${render.materialLock > 60 ? 'définie' : 'libre'} |
| creativity | **${render.creativity}** | Marge créative résiduelle |
| style | ${render.style} | |

## Prompt supplement suggéré

> ${render.promptSupplement}

## Localisation

- Coordonnées : ${location.lat}, ${location.lng}
- Nord vrai : ${location.trueNorth}°
- Altitude sol : ${location.groundElevation}m

## Modèle 3D

- Fichier : \`${model.file}\`
- Échelle : ${model.scale}

## Espaces principaux

${(programme.espaces || []).slice(0, 10).map(e => `- **${e.nom}** (${e.type}) — ${e.dimensions?.surface_cible_m2 || '?'}m²`).join('\n')}

${(programme.espaces || []).length > 10 ? `_... et ${(programme.espaces || []).length - 10} autres espaces_` : ''}

## Alertes layout

${critiques.length > 0 ? critiques.map(v => `⚠️ ${v.message}`).join('\n') : '✅ Aucune violation critique'}

---

_Généré par CapInSitu Generation Module_
`;
}

export async function prepareVizinSituPackage(opts = {}) {
  const {
    glbFile,
    outputDir,
    projectName = 'projet',
    location = {},
    programme = {},
    layout = {}
  } = opts;

  mkdirSync(outputDir, { recursive: true });

  const link = generateVizinSituLink({
    glbFile: glbFile || `${projectName}.glb`,
    location,
    programme,
    layout,
    projectName
  });

  const linkPath = saveVizinSituLink(link, outputDir, projectName);

  const notice = buildNoticeOperateur(link, programme, layout);
  const noticePath = join(outputDir, `${projectName}-notice-vizinsitu.md`);
  writeFileSync(noticePath, notice);

  return {
    link,
    linkPath,
    noticePath
  };
}
