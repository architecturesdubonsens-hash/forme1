'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sessions } from '@/lib/api';
import type { Session } from '@/lib/types';
import { Plus, FolderOpen, ArrowRight, Clock } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-muted/20 text-muted',
  schema_fonctionnel: 'bg-blue-500/20 text-blue-400',
  schema_valide: 'bg-accent/20 text-accent',
  generation_en_cours: 'bg-warning/20 text-warning',
  genere: 'bg-success/20 text-success',
  erreur: 'bg-danger/20 text-danger',
  archive: 'bg-muted/10 text-muted',
};

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  schema_fonctionnel: 'Schéma fonctionnel',
  schema_valide: 'Schéma validé',
  generation_en_cours: 'Génération…',
  genere: 'Généré',
  erreur: 'Erreur',
  archive: 'Archivé',
};

const PHASE_LABELS = ['', 'Programme', 'Génération', 'Export'];

function timeAgo(dateStr: string) {
  const d = Date.now() - new Date(dateStr).getTime();
  if (d < 60000) return 'à l\'instant';
  if (d < 3600000) return `il y a ${Math.floor(d / 60000)} min`;
  if (d < 86400000) return `il y a ${Math.floor(d / 3600000)} h`;
  return `il y a ${Math.floor(d / 86400000)} j`;
}

export default function SessionsPage() {
  const [list, setList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessions.list().then(setList).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-muted text-sm mt-1">{list.length} projet(s)</p>
        </div>
        <Link href="/sessions/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle session
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card animate-pulse h-20" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen size={40} className="text-muted mx-auto mb-3" />
          <p className="text-white font-medium">Aucune session</p>
          <p className="text-muted text-sm mt-1">Commencez par créer un projet depuis un cahier des charges</p>
          <Link href="/sessions/new" className="btn-primary inline-flex items-center gap-2 mt-6">
            <Plus size={14} /> Nouvelle session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(s => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="card flex items-center gap-4 hover:border-accent/40 transition-colors group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.project_name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Clock size={10} /> {timeAgo(s.updated_at)}
                  </span>
                  <span className="text-xs text-muted">
                    {s.phase ? `Phase ${s.phase} — ${PHASE_LABELS[s.phase] || ''}` : ''}
                  </span>
                </div>
              </div>
              <span className={clsx('badge flex-shrink-0', STATUS_COLORS[s.status] || 'bg-muted/20 text-muted')}>
                {STATUS_LABELS[s.status] || s.status}
              </span>
              <ArrowRight size={16} className="text-muted group-hover:text-white transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
