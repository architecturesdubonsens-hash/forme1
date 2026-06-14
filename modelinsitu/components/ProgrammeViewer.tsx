'use client';
import type { Programme, Espace, Liaison } from '@/lib/types';
import { Home, ArrowLeftRight, Layers, Wind, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

// Compat helpers — support both new (source/cible) and legacy (espace_a/espace_b) schemas
function liaisonSource(l: Liaison): string { return l.source ?? l.espace_a ?? ''; }
function liaisonCible(l: Liaison): string  { return l.cible  ?? l.espace_b ?? ''; }
function espaceSurface(e: Espace): number | undefined {
  return e.dimensions?.surface_cible_m2 ?? e.dimensions?.surface_min_m2 ?? e.surface_estimee_m2;
}

const LIAISON_COLORS: Record<string, string> = {
  directe:            'text-accent',
  flux_physique:      'text-accent',
  indirecte:          'text-yellow-400',
  couloir:            'text-yellow-400',
  proximite:          'text-blue-400',
  relation_visuelle:  'text-purple-400',
  visuelle:           'text-purple-400',
  flux_acoustique:    'text-orange-400',
  acoustique:         'text-orange-400',
  separation_absolue: 'text-red-400',
  fonctionnelle:      'text-green-400',
};

const OBLIGATION_LABELS: Record<string, string> = {
  absolue:     '●',
  forte:       '◑',
  optionnelle: '○',
};

interface Props {
  programme: Programme;
  compact?: boolean;
  onSelectEspace?: (espace: Espace) => void;
  selectedEspaceId?: string;
}

export default function ProgrammeViewer({ programme, compact, onSelectEspace, selectedEspaceId }: Props) {
  const { espaces = [], liaisons = [], niveaux, surface_totale_estimee, metadata } = programme;
  const [liaisonsOpen, setLiaisonsOpen] = useState(true);

  const totalSurface = surface_totale_estimee
    || espaces.reduce((t, e) => t + (espaceSurface(e) ?? 0), 0)
    || undefined;

  const confiance = metadata?.confiance;
  const questions = metadata?.questions_clarification ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1"><Home size={11} /> {espaces.length} espaces</span>
        <span className="flex items-center gap-1"><ArrowLeftRight size={11} /> {liaisons.length} liaisons</span>
        {niveaux && niveaux.length > 0 && (
          <span className="flex items-center gap-1"><Layers size={11} /> {niveaux.length} niveau(x)</span>
        )}
        {totalSurface ? (
          <span className="flex items-center gap-1"><Wind size={11} /> ~{Math.round(totalSurface)} m²</span>
        ) : null}
        {confiance !== undefined && (
          <span className={clsx(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
            confiance >= 0.75 ? 'bg-success/20 text-success' :
            confiance >= 0.5  ? 'bg-warning/20 text-warning' :
            'bg-danger/20 text-danger'
          )}>
            {Math.round(confiance * 100)}%
          </span>
        )}
      </div>

      {/* Questions de clarification */}
      {questions.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent/70 mb-1.5">À préciser</p>
          {questions.slice(0, 3).map((q, i) => (
            <p key={i} className="text-xs text-muted leading-snug">• {q}</p>
          ))}
        </div>
      )}

      {/* Espaces */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Espaces</p>
        <div className="space-y-1.5">
          {espaces.map(e => {
            const surf = espaceSurface(e);
            const isSelected = e.id === selectedEspaceId;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEspace?.(e)}
                className={clsx(
                  'w-full text-left bg-canvas border rounded-lg p-3 transition-all',
                  onSelectEspace ? 'cursor-pointer hover:border-accent/40 hover:bg-accent/5' : 'cursor-default',
                  isSelected ? 'border-accent bg-accent/10' : 'border-border'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate leading-tight">{e.nom}</p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {e.type}{e.niveau ? ` · ${e.niveau}` : ''}
                      {e.quantite && e.quantite > 1 ? ` · ×${e.quantite}` : ''}
                    </p>
                  </div>
                  {surf !== undefined && (
                    <span className="text-xs text-accent font-mono flex-shrink-0">{surf} m²</span>
                  )}
                </div>

                {(e.contacts_exterieurs?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {e.contacts_exterieurs!.map(c => (
                      <span key={c} className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                )}

                {(e.qualites?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.qualites!.slice(0, compact ? 3 : 999).map(q => (
                      <span key={q} className="text-[9px] bg-white/5 text-muted/80 px-1.5 py-0.5 rounded-full">{q}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liaisons (collapsable in compact mode) */}
      {liaisons.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center justify-between w-full text-[10px] font-semibold uppercase tracking-wider text-muted mb-2"
            onClick={() => setLiaisonsOpen(o => !o)}
          >
            <span>Liaisons ({liaisons.length})</span>
            {liaisonsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {liaisonsOpen && (
            <div className="space-y-1">
              {liaisons.map((l, i) => {
                const src = liaisonSource(l);
                const tgt = liaisonCible(l);
                const nomA = espaces.find(e => e.id === src)?.nom || src;
                const nomB = espaces.find(e => e.id === tgt)?.nom || tgt;
                const color = LIAISON_COLORS[l.type] || 'text-muted';
                return (
                  <div
                    key={l.id ?? i}
                    className="flex items-center gap-1.5 text-xs py-1 border-b border-border/40 last:border-0"
                  >
                    {l.obligation && (
                      <span className={clsx('flex-shrink-0 text-[9px]', color)} title={l.obligation}>
                        {OBLIGATION_LABELS[l.obligation] ?? '·'}
                      </span>
                    )}
                    <span className="text-white/70 truncate min-w-0 flex-1 text-right">{nomA}</span>
                    <span className={clsx('text-[9px] font-mono flex-shrink-0 whitespace-nowrap', color)}>
                      {l.type}
                    </span>
                    <span className="text-white/70 truncate min-w-0 flex-1">{nomB}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
