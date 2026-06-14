'use client';
import type { LayoutData, LayoutRect } from '@/lib/types';
import { useState, useMemo } from 'react';

const PADDING = 16;
const NIVEAU_LABEL_H = 16;
const NIVEAU_GAP = 28;

const TYPE_FILL: Record<string, string> = {
  sejour:          '#1c3251',
  cuisine:         '#2d1f10',
  salle_a_manger:  '#1f2d10',
  chambre:         '#231535',
  salle_de_bain:   '#0f2d25',
  wc:              '#13162d',
  bureau:          '#102338',
  dressing:        '#2a1035',
  hall:            '#252525',
  entree:          '#2a2a2a',
  couloir:         '#1c1c1c',
  garage:          '#161818',
  cave:            '#141414',
  local_technique: '#111313',
  terrasse:        '#0f2210',
  balcon:          '#0f2210',
  loggia:          '#0f2210',
  jardin:          '#0a1a0a',
  autre:           '#1a1a1a',
};

const NIVEAU_LABELS: Record<string, string> = {
  sous_sol: 'Sous-sol',
  rdc:      'Rez-de-chaussée',
  etage:    'Étage',
};

interface Props {
  layout: LayoutData;
  selectedEspaceId?: string;
  onSelectEspace?: (id: string, nom: string) => void;
}

interface NiveauData {
  niveau: string;
  rects: LayoutRect[];
  offsetY: number;
  contentH: number;
  maxX: number;
}

export default function SvgSchematic({ layout, selectedEspaceId, onSelectEspace }: Props) {
  const [hoveredId, setHoveredId] = useState<string | undefined>();

  const { niveauxData, totalWidth, totalHeight, scale } = useMemo(() => {
    const niveauxOrder = ['sous_sol', 'rdc', 'etage'];
    const present = niveauxOrder.filter(n => (layout.rectangles[n]?.length ?? 0) > 0);

    // Auto-scale: fit all niveaux in ~260px width
    const maxExtentX = Math.max(...present.flatMap(n =>
      (layout.rectangles[n] ?? []).map(r => r.x + r.w)
    ), 1);
    const targetW = 260 - PADDING * 2;
    const sc = Math.max(10, Math.min(28, targetW / maxExtentX));

    let offsetY = PADDING;
    const data: NiveauData[] = [];

    for (const niveau of present) {
      const rects = layout.rectangles[niveau] ?? [];
      const maxX = Math.max(...rects.map(r => r.x + r.w), 1);
      const maxY = Math.max(...rects.map(r => r.y + r.h), 1);
      const contentH = maxY * sc;
      data.push({ niveau, rects, offsetY: offsetY + NIVEAU_LABEL_H, contentH, maxX });
      offsetY += NIVEAU_LABEL_H + contentH + NIVEAU_GAP;
    }

    const tw = Math.max(...data.map(n => n.maxX * sc), 100) + PADDING * 2;
    const th = offsetY - NIVEAU_GAP + PADDING;
    return { niveauxData: data, totalWidth: tw, totalHeight: th, scale: sc };
  }, [layout]);

  const critiques = layout.violations.filter(v => v.type === 'CRITIQUE');

  return (
    <div className="w-full">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="w-full"
        style={{ maxHeight: '100%' }}
      >
        {/* Background */}
        <rect width={totalWidth} height={totalHeight} fill="#0a0a0a" />

        {niveauxData.map(({ niveau, rects, offsetY: nOY, contentH, maxX }) => (
          <g key={niveau}>
            {/* Level label */}
            <text
              x={PADDING} y={nOY - 4}
              fontSize={9} fill="#404040" fontFamily="sans-serif" fontWeight="600"
            >
              {NIVEAU_LABELS[niveau] ?? niveau}
            </text>

            {/* Level background */}
            <rect
              x={PADDING - 4} y={nOY}
              width={maxX * scale + 8} height={contentH}
              fill="#111" rx={2}
            />

            {/* Room rects */}
            {rects.map(r => {
              const x = PADDING + r.x * scale;
              const y = nOY + r.y * scale;
              const w = r.w * scale;
              const h = r.h * scale;
              const sel = r.id === selectedEspaceId;
              const hov = r.id === hoveredId;
              const fill = sel ? '#1e3a5f' : hov ? '#252525' : (TYPE_FILL[r.type] ?? '#1a1a1a');
              const stroke = sel ? '#3b82f6' : hov ? '#555' : '#2a2a2a';

              return (
                <g
                  key={r.id}
                  onClick={() => onSelectEspace?.(r.id, r.nom)}
                  onMouseEnter={() => setHoveredId(r.id)}
                  onMouseLeave={() => setHoveredId(undefined)}
                  style={{ cursor: onSelectEspace ? 'pointer' : 'default' }}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sel ? 1.5 : 0.8}
                    rx={1.5}
                  />
                  {w >= 28 && h >= 14 && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + (h >= 26 ? -4 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(9, w / 5.5)}
                      fill={sel ? '#93c5fd' : '#888'}
                      fontFamily="sans-serif"
                    >
                      {r.nom.length > 12 ? r.nom.slice(0, 11) + '…' : r.nom}
                    </text>
                  )}
                  {w >= 28 && h >= 26 && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + 7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={7}
                      fill={sel ? '#60a5fa' : '#444'}
                      fontFamily="sans-serif"
                    >
                      {r.surface_m2.toFixed(0)}m²
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {/* Score footer */}
        <text
          x={PADDING} y={totalHeight - 4}
          fontSize={7} fill="#333" fontFamily="sans-serif"
        >
          Score {layout.score}/100 · {layout.violations.length} violation(s)
        </text>
      </svg>

      {/* Critical violations */}
      {critiques.length > 0 && (
        <div className="mt-2 space-y-1 px-1">
          {critiques.map((v, i) => (
            <p key={i} className="text-[10px] text-danger leading-snug">⚠ {v.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}
