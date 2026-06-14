'use client';
import { useEffect, useState, useRef } from 'react';
import { library, analysis } from '@/lib/api';
import type { Template, AnalysisJob } from '@/lib/types';
import { TYPOLOGY_LABELS, TYPOLOGIES } from '@/lib/types';
import ProgrammeViewer from '@/components/ProgrammeViewer';
import {
  Upload, Library, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, X,
} from 'lucide-react';
import clsx from 'clsx';

type UploadState = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.8 ? 'bg-success' : value >= 0.6 ? 'bg-warning' : 'bg-danger';
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', color)} />
      <span className="text-xs text-muted">{Math.round(value * 100)}%</span>
    </span>
  );
}

export default function LibraryPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploadTypology, setUploadTypology] = useState<string>(TYPOLOGIES[0]);
  const [uploadNom, setUploadNom] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [jobSummary, setJobSummary] = useState<AnalysisJob['summary'] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    library.list().then(setTemplates).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload() {
    if (uploadFiles.length === 0) return;
    if (!uploadNom.trim()) { setUploadError('Donnez un nom au template'); return; }
    setUploadError('');
    setUploadState('uploading');
    try {
      const images = await Promise.all(uploadFiles.map(fileToBase64));
      const { id } = await analysis.start({
        images,
        typology: uploadTypology,
        save_as_template: true,
        template_nom: uploadNom.trim(),
      });
      setUploadState('polling');
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const job = await analysis.status(id);
        if (job.status === 'done') {
          setJobSummary(job.summary || null);
          setUploadState('done');
          load();
          setUploadFiles([]);
          setUploadNom('');
        } else if (job.status === 'error') {
          setUploadError(job.error || 'Erreur lors de l\'analyse');
          setUploadState('error');
        } else if (attempts < 40) {
          setTimeout(poll, 3000);
        } else {
          setUploadError('Délai dépassé — réessayez');
          setUploadState('error');
        }
      };
      await poll();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Erreur');
      setUploadState('error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce template ?')) return;
    await library.delete(id);
    load();
  }

  const busy = uploadState === 'uploading' || uploadState === 'polling';
  const filtered = filter
    ? templates.filter(t =>
        t.nom.toLowerCase().includes(filter.toLowerCase()) ||
        t.typology.includes(filter.toLowerCase())
      )
    : templates;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Library size={24} className="text-accent" /> Bibliothèque typologique
        </h1>
        <p className="text-muted text-sm mt-1">
          Analysez des plans exemples pour alimenter la bibliothèque de référence de l&apos;IA
        </p>
      </div>

      {/* Upload panel */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Importer des plans</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Nom du template</label>
            <input
              className="input"
              placeholder="ex. Maison individuelle 3ch — type haussmannien"
              value={uploadNom}
              onChange={e => setUploadNom(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Typologie</label>
            <select
              className="input bg-surface"
              value={uploadTypology}
              onChange={e => setUploadTypology(e.target.value)}
              disabled={busy}
            >
              {TYPOLOGIES.map(t => (
                <option key={t} value={t}>{TYPOLOGY_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => setUploadFiles(Array.from(e.target.files || []))}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={clsx(
              'w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              uploadFiles.length > 0
                ? 'border-accent/50 bg-accent/5'
                : 'border-border hover:border-accent/30'
            )}
          >
            <Upload size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">
              {uploadFiles.length > 0
                ? `${uploadFiles.length} fichier(s) sélectionné(s)`
                : 'Cliquez pour sélectionner 1 à 6 plans (images)'}
            </p>
            {uploadFiles.length > 0 && (
              <p className="text-xs text-muted mt-1 truncate px-4">
                {uploadFiles.map(f => f.name).join(', ')}
              </p>
            )}
          </button>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0" /> {uploadError}
          </div>
        )}

        {uploadState === 'done' && jobSummary && (
          <div className="flex items-center gap-2 text-success text-sm bg-success/10 border border-success/20 rounded-lg p-3">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            Template créé — {jobSummary.nb_espaces} espaces · {jobSummary.nb_liaisons} liaisons ·
            confiance {Math.round(jobSummary.confiance * 100)}%
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={busy || uploadFiles.length === 0 || !uploadNom.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy
              ? <Loader2 size={14} className="animate-spin" />
              : <Upload size={14} />}
            {uploadState === 'uploading' ? 'Envoi…'
              : uploadState === 'polling' ? 'Analyse en cours…'
              : 'Analyser et importer'}
          </button>
          {uploadFiles.length > 0 && (
            <button
              onClick={() => { setUploadFiles([]); setUploadState('idle'); setUploadError(''); }}
              className="btn-ghost flex items-center gap-1"
            >
              <X size={14} /> Annuler
            </button>
          )}
        </div>
      </div>

      {/* Template list */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <input
            className="input max-w-xs"
            placeholder="Filtrer par nom ou type…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <span className="text-xs text-muted ml-auto">{filtered.length} template(s)</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-14" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Library size={32} className="text-muted mx-auto mb-2" />
            <p className="text-muted text-sm">
              {filter ? 'Aucun résultat' : 'Bibliothèque vide — importez des plans pour commencer'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="card">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  {expanded === t.id
                    ? <ChevronDown size={16} className="text-muted flex-shrink-0" />
                    : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{t.nom}</p>
                      <span className="badge bg-accent/10 text-accent">
                        {TYPOLOGY_LABELS[t.typology] || t.typology}
                      </span>
                      {t.is_validated && (
                        <span className="badge bg-success/20 text-success">Validé</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {t.stats.nb_espaces} espaces · {t.stats.surface_totale} m² · {t.stats.nb_liaisons} liaisons
                    </p>
                  </div>
                  <ConfidenceDot value={t.confiance} />
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                    className="p-1.5 text-muted hover:text-danger transition-colors rounded flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {expanded === t.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <ProgrammeViewer programme={t.programme} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
