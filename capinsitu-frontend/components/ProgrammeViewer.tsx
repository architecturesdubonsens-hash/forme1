'use client';
import type { Programme } from '@/lib/types';
import { Home, ArrowLeftRight, Wind, Layers } from 'lucide-react';
import clsx from 'clsx';

const LIAISON_COLORS: Record<string, string> = {
  directe: 'text-accent',
  couloir: 'text-yellow-400',
  visuelle: 'text-purple-400',
  acoustique: 'text-orange-400',
  fonctionnelle: 'text-green-400',
};

interface Props {
  programme: Programme;
  compact?: boolean;
}

export default function ProgrammeViewer({ programme, compact }: Props) {
  const { espaces = [], liaisons = [], niveaux, surface_totale_estimee } = programme;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><Home size={12} /> {espaces.length} espaces</span>
        <span className="flex items-center gap-1"><ArrowLeftRight size={12} /> {liaisons.length} liaisons</span>
        {niveaux && <span className="flex items-center gap-1"><Layers size={12} /> {niveaux.length} niveau(x)</span>}
        {surface_totale_estimee && (
          <span className="flex items-center gap-1"><Wind size={12} /> ~{Math.round(surface_totale_estimee)} m²</span>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Espaces</h3>
        <div className={clsx('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
          {espaces.map(e => (
            <div key={e.id} className="bg-canvas border border-border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{e.nom}</p>
                  <p className="text-xs text-muted">{e.type}{e.niveau ? ` · ${e.niveau}` : ''}</p>
                </div>
                {e.surface_estimee_m2 && (
                  <span className="text-xs text-accent font-mono flex-shrink-0">{e.surface_estimee_m2} m²</span>
                )}
              </div>
              {(e.contacts_exterieurs?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {e.contacts_exterieurs!.map(c => (
                    <span key={c} className="badge bg-accent/10 text-accent">{c}</span>
                  ))}
                </div>
              )}
              {(e.qualites?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.qualites!.map(q => (
                    <span key={q} className="badge bg-white/5 text-muted">{q}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {liaisons.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Liaisons</h3>
          <div className="space-y-1">
            {liaisons.map(l => {
              const a = espaces.find(e => e.id === l.espace_a)?.nom || l.espace_a;
              const b = espaces.find(e => e.id === l.espace_b)?.nom || l.espace_b;
              return (
                <div key={l.id} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="text-white/70 truncate max-w-[35%]">{a}</span>
                  <span className={clsx('text-xs font-mono flex-shrink-0', LIAISON_COLORS[l.type] || 'text-muted')}>
                    —{l.type}—
                  </span>
                  <span className="text-white/70 truncate max-w-[35%]">{b}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
