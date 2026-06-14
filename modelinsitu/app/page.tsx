'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sessions, library } from '@/lib/api';
import type { Session, Template } from '@/lib/types';
import { TYPOLOGY_LABELS } from '@/lib/types';
import { Plus, ArrowRight, FolderOpen, Library, Clock } from 'lucide-react';
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
  generation_en_cours: 'En cours…',
  genere: 'Généré',
  erreur: 'Erreur',
  archive: 'Archivé',
};

function timeAgo(dateStr: string) {
  const d = Date.now() - new Date(dateStr).getTime();
  if (d < 60000) return 'à l\'instant';
  if (d < 3600000) return `il y a ${Math.floor(d / 60000)} min`;
  if (d < 86400000) return `il y a ${Math.floor(d / 3600000)} h`;
  return `il y a ${Math.floor(d / 86400000)} j`;
}

export default function DashboardPage() {
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sessions.list().then(s => setRecentSessions(s.slice(0, 5))),
      library.list({ validated: true }).then(t => setTemplates(t.slice(0, 4))),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Génération architecturale par IA</p>
        </div>
        <Link href="/sessions/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nouvelle session
        </Link>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sessions', value: recentSessions.length, icon: FolderOpen },
          { label: 'Templates', value: templates.length, icon: Library },
          { label: 'Générés', value: recentSessions.filter(s => s.status === 'genere').length, icon: ArrowRight },
          { label: 'En cours', value: recentSessions.filter(s => s.status === 'generation_en_cours').length, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{loading ? '—' : value}</div>
              <div className="text-xs text-muted">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions récentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Sessions récentes</h2>
          <Link href="/sessions" className="text-xs text-accent hover:underline flex items-center gap-1">
            Toutes <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="card animate-pulse h-16 bg-surface" />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="card text-center py-10">
            <FolderOpen size={32} className="text-muted mx-auto mb-2" />
            <p className="text-muted text-sm">Aucune session — commencez par créer un projet</p>
            <Link href="/sessions/new" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={14} /> Nouvelle session
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(s => (
              <Link key={s.id} href={`/sessions/${s.id}`}
                className="card flex items-center gap-4 hover:border-accent/40 transition-colors group cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.project_name}</p>
                  <p className="text-xs text-muted mt-0.5">{timeAgo(s.updated_at)}</p>
                </div>
                <span className={clsx('badge', STATUS_COLORS[s.status] || 'bg-muted/20 text-muted')}>
                  {STATUS_LABELS[s.status] || s.status}
                </span>
                <ArrowRight size={16} className="text-muted group-hover:text-white transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Templates validés */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Bibliothèque typologique</h2>
          <Link href="/library" className="text-xs text-accent hover:underline flex items-center gap-1">
            Gérer <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="card animate-pulse h-24" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="card text-center py-8">
            <Library size={28} className="text-muted mx-auto mb-2" />
            <p className="text-muted text-sm">Bibliothèque vide — importez des plans pour créer des templates</p>
            <Link href="/library" className="text-accent text-xs hover:underline mt-2 inline-block">
              Aller à la bibliothèque →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map(t => (
              <div key={t.id} className="card hover:border-accent/30 transition-colors">
                <div className="text-xs text-accent font-medium mb-1">
                  {TYPOLOGY_LABELS[t.typology] || t.typology}
                </div>
                <p className="text-sm font-medium text-white leading-tight">{t.nom}</p>
                <p className="text-xs text-muted mt-2">
                  {t.stats.nb_espaces} espaces · {t.stats.surface_totale} m²
                </p>
                {t.is_validated && (
                  <span className="badge bg-success/20 text-success mt-2">Validé</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
