/**
 * layout-engine.js
 * Résout le graphe de liaisons du programme en géométrie 2D rectangulaire
 * via un algorithme force-dirigé + résolution de chevauchements.
 */

import { fileURLToPath } from 'url';

const POIDS_ATTRACTION = {
  directe:          { absolue: 5.0, forte: 3.0, optionnelle: 1.5 },
  proximite:        { absolue: 2.5, forte: 1.5, optionnelle: 0.8 },
  flux_physique:    { absolue: 4.0, forte: 2.5, optionnelle: 1.0 },
  flux_acoustique:  { absolue: 0.5, forte: 0.3, optionnelle: 0.1 },
  relation_visuelle:{ absolue: 2.0, forte: 1.2, optionnelle: 0.5 },
  indirecte:        { absolue: 1.0, forte: 0.6, optionnelle: 0.3 }
};

const POIDS_REPULSION = {
  separation_absolue: { absolue: 8.0, forte: 5.0, optionnelle: 2.0 }
};

const GRILLE_M = 0.5;
const ITERATIONS_FORCES = 150;
const ITERATIONS_OVERLAP = 50;
const AMORTISSEMENT = 0.85;

function surfaceCible(espace) {
  if (espace.dimensions?.surface_cible_m2) return espace.dimensions.surface_cible_m2;
  if (espace.dimensions?.surface_min_m2 && espace.dimensions?.surface_max_m2) {
    return (espace.dimensions.surface_min_m2 + espace.dimensions.surface_max_m2) / 2;
  }
  if (espace.dimensions?.surface_min_m2) return espace.dimensions.surface_min_m2 * 1.2;
  return surfaceDefaut(espace.type);
}

function surfaceDefaut(type) {
  const surfaces = {
    sejour: 30, cuisine: 15, salle_a_manger: 18, chambre: 14, bureau: 12,
    salle_de_bain: 8, wc: 3, dressing: 6, hall: 8, couloir: 6, entree: 5,
    cellier: 6, buanderie: 6, garage: 20, cave: 15, grenier: 20, combles: 25,
    terrasse: 20, balcon: 8, loggia: 10, jardin: 80, cour: 30,
    salle_reunion: 25, open_space: 40, accueil: 15, archives: 12, local_technique: 8,
    circulation_verticale: 5, palier: 4, cage_escalier: 8, ascenseur: 4,
    autre: 15
  };
  return surfaces[type] || 15;
}

function dimensionsRect(surface) {
  const ratio = 1.5;
  const larg = Math.sqrt(surface / ratio);
  const long = surface / larg;
  return { w: snapGrille(long), h: snapGrille(larg) };
}

function snapGrille(val) {
  return Math.max(GRILLE_M, Math.round(val / GRILLE_M) * GRILLE_M);
}

function centreRect(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function distanceCentres(r1, r2) {
  const c1 = centreRect(r1);
  const c2 = centreRect(r2);
  return Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);
}

function chevauchement(r1, r2) {
  const ox = Math.max(0, Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x));
  const oy = Math.max(0, Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y));
  return { ox, oy, chevauche: ox > 0 && oy > 0 };
}

function distribuerNiveaux(espaces, programme) {
  const niveaux = { sous_sol: [], rdc: [], etage: [] };

  for (const espace of espaces) {
    const pos = espace.contraintes_op?.position_preferee;
    if (pos === 'sous_sol') {
      niveaux.sous_sol.push(espace.id);
    } else if (pos === 'etage') {
      niveaux.etage.push(espace.id);
    } else if (pos === 'rdc') {
      niveaux.rdc.push(espace.id);
    } else {
      const typesRdc = ['sejour', 'cuisine', 'salle_a_manger', 'hall', 'entree', 'wc', 'garage', 'bureau', 'accueil', 'open_space'];
      const typesEtage = ['chambre', 'salle_de_bain', 'dressing', 'couloir', 'palier'];
      const typesSousSol = ['cave', 'local_technique', 'buanderie', 'cellier'];

      if (typesRdc.includes(espace.type)) {
        niveaux.rdc.push(espace.id);
      } else if (typesEtage.includes(espace.type)) {
        niveaux.etage.push(espace.id);
      } else if (typesSousSol.includes(espace.type)) {
        niveaux.sous_sol.push(espace.id);
      } else {
        niveaux.rdc.push(espace.id);
      }
    }
  }

  return niveaux;
}

function layoutNiveau(espacesNiveau, liaisons, emprise) {
  if (espacesNiveau.length === 0) return [];

  const rects = espacesNiveau.map((espace, i) => {
    const { w, h } = dimensionsRect(surfaceCible(espace));
    const angle = (i / espacesNiveau.length) * 2 * Math.PI;
    const radius = Math.sqrt(espacesNiveau.length) * 5;
    return {
      id: espace.id,
      nom: espace.nom,
      type: espace.type,
      x: (emprise.largeur / 2) + radius * Math.cos(angle) - w / 2,
      y: (emprise.profondeur / 2) + radius * Math.sin(angle) - h / 2,
      w, h,
      vx: 0, vy: 0
    };
  });

  const idxById = {};
  rects.forEach((r, i) => { idxById[r.id] = i; });

  for (let iter = 0; iter < ITERATIONS_FORCES; iter++) {
    const forces = rects.map(() => ({ fx: 0, fy: 0 }));

    for (const liaison of liaisons) {
      const ia = idxById[liaison.source];
      const ib = idxById[liaison.cible];
      if (ia === undefined || ib === undefined) continue;

      const ra = rects[ia];
      const rb = rects[ib];
      const ca = centreRect(ra);
      const cb = centreRect(rb);
      const dx = cb.x - ca.x;
      const dy = cb.y - ca.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

      if (liaison.type === 'separation_absolue') {
        const poids = POIDS_REPULSION.separation_absolue[liaison.obligation] || 2.0;
        const distCible = (ra.w + rb.w) / 2 + (ra.h + rb.h) / 2;
        if (dist < distCible * 1.5) {
          const force = poids * (distCible * 1.5 - dist) / dist;
          forces[ia].fx -= dx * force;
          forces[ia].fy -= dy * force;
          forces[ib].fx += dx * force;
          forces[ib].fy += dy * force;
        }
      } else {
        const poidsMap = POIDS_ATTRACTION[liaison.type] || POIDS_ATTRACTION.proximite;
        const poids = poidsMap[liaison.obligation] || 1.0;
        const distCible = liaison.type === 'directe' ? (ra.w + rb.w) / 2 + 0.5 : (ra.w + rb.w);
        const force = poids * (dist - distCible) * 0.05;
        forces[ia].fx += dx * force;
        forces[ia].fy += dy * force;
        forces[ib].fx -= dx * force;
        forces[ib].fy -= dy * force;
      }
    }

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const ra = rects[i];
        const rb = rects[j];
        const ca = centreRect(ra);
        const cb = centreRect(rb);
        const dx = cb.x - ca.x;
        const dy = cb.y - ca.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const distMin = (ra.w + rb.w + ra.h + rb.h) / 4 + 2;
        if (dist < distMin) {
          const force = 0.3 * (distMin - dist) / dist;
          forces[i].fx -= dx * force;
          forces[i].fy -= dy * force;
          forces[j].fx += dx * force;
          forces[j].fy += dy * force;
        }
      }
    }

    for (let i = 0; i < rects.length; i++) {
      rects[i].vx = (rects[i].vx + forces[i].fx) * AMORTISSEMENT;
      rects[i].vy = (rects[i].vy + forces[i].fy) * AMORTISSEMENT;
      rects[i].x += rects[i].vx;
      rects[i].y += rects[i].vy;
    }
  }

  for (let iter = 0; iter < ITERATIONS_OVERLAP; iter++) {
    let resolved = true;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const { ox, oy, chevauche } = chevauchement(rects[i], rects[j]);
        if (!chevauche) continue;
        resolved = false;
        if (ox < oy) {
          const decal = ox / 2 + 0.1;
          if (centreRect(rects[i]).x < centreRect(rects[j]).x) {
            rects[i].x -= decal;
            rects[j].x += decal;
          } else {
            rects[i].x += decal;
            rects[j].x -= decal;
          }
        } else {
          const decal = oy / 2 + 0.1;
          if (centreRect(rects[i]).y < centreRect(rects[j]).y) {
            rects[i].y -= decal;
            rects[j].y += decal;
          } else {
            rects[i].y += decal;
            rects[j].y -= decal;
          }
        }
      }
    }
    if (resolved) break;
  }

  let minX = Infinity, minY = Infinity;
  for (const r of rects) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); }
  for (const r of rects) {
    r.x = snapGrille(r.x - minX);
    r.y = snapGrille(r.y - minY);
  }

  return rects.map(r => ({
    id: r.id, nom: r.nom, type: r.type,
    x: r.x, y: r.y, w: r.w, h: r.h,
    surface_m2: r.w * r.h
  }));
}

function evaluerLayout(rectanglesTousNiveaux, liaisons, programme) {
  let score = 100;
  const violations = [];

  const posById = {};
  for (const [niveau, rects] of Object.entries(rectanglesTousNiveaux)) {
    for (const r of rects) {
      posById[r.id] = { ...r, niveau };
    }
  }

  for (const liaison of liaisons) {
    const ra = posById[liaison.source];
    const rb = posById[liaison.cible];
    if (!ra || !rb) continue;

    if (liaison.type === 'separation_absolue' && liaison.obligation === 'absolue') {
      const { chevauche } = chevauchement(ra, rb);
      if (ra.niveau === rb.niveau) {
        const dist = distanceCentres(ra, rb);
        if (dist < (ra.w + rb.w) / 2 + 2) {
          violations.push({ type: 'CRITIQUE', message: `Séparation absolue violée : ${ra.nom} — ${rb.nom}` });
          score -= 20;
        }
      }
    }

    if (liaison.type === 'directe' && liaison.obligation === 'absolue') {
      if (ra.niveau !== rb.niveau) {
        violations.push({ type: 'IMPORTANTE', message: `Liaison directe obligatoire inter-niveau : ${ra.nom} — ${rb.nom}` });
        score -= 10;
      } else {
        const dist = distanceCentres(ra, rb);
        const distMax = (ra.w + rb.w) / 2 + (ra.h + rb.h) / 2;
        if (dist > distMax * 1.5) {
          violations.push({ type: 'IMPORTANTE', message: `Liaison directe trop distante : ${ra.nom} — ${rb.nom}` });
          score -= 10;
        }
      }
    }
  }

  return { score: Math.max(0, score), violations };
}

export function resolveLayout(programme, emprise = { largeur: 20, profondeur: 15 }) {
  const niveauxIds = distribuerNiveaux(programme.espaces, programme);
  const espacesById = {};
  programme.espaces.forEach(e => { espacesById[e.id] = e; });

  const rectangles = {};
  const niveauxActifs = [];

  for (const [niveau, ids] of Object.entries(niveauxIds)) {
    if (ids.length === 0) continue;
    niveauxActifs.push(niveau);
    const espacesNiveau = ids.map(id => espacesById[id]).filter(Boolean);
    rectangles[niveau] = layoutNiveau(espacesNiveau, programme.liaisons, emprise);
  }

  const { score, violations } = evaluerLayout(rectangles, programme.liaisons, programme);

  return {
    rectangles,
    niveaux: niveauxActifs,
    emprise,
    score,
    violations
  };
}

export function layoutToSVG(layout, scale = 30) {
  const colors = {
    sejour: '#E8F4F8', cuisine: '#FFF3E0', salle_a_manger: '#FFF9C4',
    chambre: '#F3E5F5', salle_de_bain: '#E0F2F1', wc: '#E8EAF6',
    bureau: '#E3F2FD', hall: '#FAFAFA', couloir: '#F5F5F5',
    garage: '#ECEFF1', cave: '#ECEFF1', local_technique: '#CFD8DC',
    terrasse: '#F1F8E9', balcon: '#F1F8E9', autre: '#FFFFFF'
  };

  const niveauxOrder = ['sous_sol', 'rdc', 'etage'];
  const svgParts = [];
  let totalHeight = 0;
  const padding = 40;
  const niveauGap = 60;
  const niveauxPresents = niveauxOrder.filter(n => layout.rectangles[n]);

  let offsetY = padding;
  const niveauxSVG = {};

  for (const niveau of niveauxPresents) {
    const rects = layout.rectangles[niveau];
    if (!rects || rects.length === 0) continue;

    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    niveauxSVG[niveau] = { rects, maxX, maxY, offsetY };
    offsetY += maxY * scale + niveauGap;
  }

  totalHeight = offsetY + padding;
  const maxWidth = Math.max(...Object.values(niveauxSVG).map(n => n.maxX * scale), 0) + padding * 2;

  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${totalHeight}" viewBox="0 0 ${maxWidth} ${totalHeight}">`);
  svgParts.push(`<rect width="${maxWidth}" height="${totalHeight}" fill="#F8F8F8"/>`);

  for (const [niveau, data] of Object.entries(niveauxSVG)) {
    const label = niveau === 'rdc' ? 'Rez-de-chaussée' : niveau === 'etage' ? 'Étage' : 'Sous-sol';
    svgParts.push(`<text x="${padding}" y="${data.offsetY - 10}" font-family="sans-serif" font-size="14" fill="#333" font-weight="bold">${label}</text>`);

    for (const r of data.rects) {
      const x = padding + r.x * scale;
      const y = data.offsetY + r.y * scale;
      const w = r.w * scale;
      const h = r.h * scale;
      const fill = colors[r.type] || '#FFFFFF';

      svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#555" stroke-width="1.5" rx="2"/>`);
      svgParts.push(`<text x="${x + w / 2}" y="${y + h / 2 - 6}" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(11, w / 5)}" fill="#222">${r.nom}</text>`);
      svgParts.push(`<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#666">${r.surface_m2.toFixed(1)}m²</text>`);
    }
  }

  svgParts.push(`<text x="${padding}" y="${totalHeight - 10}" font-family="sans-serif" font-size="10" fill="#999">Score: ${layout.score}/100 — ${layout.violations.length} violation(s)</text>`);
  svgParts.push('</svg>');

  return svgParts.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readFileSync } = await import('fs');
  const programme = JSON.parse(readFileSync(process.argv[2] || 'programme.json', 'utf8'));
  const layout = resolveLayout(programme);
  console.log(JSON.stringify(layout, null, 2));
  console.error(`Score: ${layout.score}/100, violations: ${layout.violations.length}`);
}
