'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sessions } from '@/lib/api';
import { Loader2, ArrowRight, FileText } from 'lucide-react';

const CDC_PLACEHOLDER = `Exemple :
Maison individuelle de 150 m² environ, 3 chambres, séjour ouvert sur terrasse sud, cuisine semi-ouverte, bureau à domicile, garage simple.
Contrainte : parcelle de 600 m² avec voisinage nord proche.`;

export default function NewSessionPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [cdcTexte, setCdcTexte] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!projectName.trim()) { setError('Donnez un nom au projet'); return; }
    setError('');
    setLoading(true);
    try {
      const session = await sessions.create({
        project_name: projectName.trim(),
        cdc_texte: cdcTexte.trim() || undefined,
      });
      router.push(`/sessions/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={24} className="text-accent" /> Nouvelle session
        </h1>
        <p className="text-muted text-sm mt-1">
          Saisissez le cahier des charges — l&apos;IA génère le programme spatial et engage le dialogue
        </p>
      </div>

      <div className="card space-y-6">
        <div>
          <label className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">
            Nom du projet <span className="text-danger">*</span>
          </label>
          <input
            className="input"
            placeholder="ex. Résidence Les Chênes — lot A"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">
            Cahier des charges (texte libre)
          </label>
          <textarea
            className="textarea"
            rows={10}
            placeholder={CDC_PLACEHOLDER}
            value={cdcTexte}
            onChange={e => setCdcTexte(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-muted mt-1">
            Décrivez librement : surfaces, ambiances, contraintes, nombre de pièces, orientation…
            L&apos;IA en tire un programme structuré que vous pourrez affiner en dialogue.
          </p>
        </div>

        {error && (
          <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !projectName.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          {loading ? 'Création…' : 'Créer et lancer l\'analyse'}
        </button>
      </div>

      <div className="mt-6 p-4 bg-surface rounded-xl border border-border">
        <p className="text-xs font-semibold text-white mb-3">Comment ça marche ?</p>
        <ol className="space-y-2">
          {[
            'Le CdC est analysé pour extraire le programme spatial (espaces, liaisons, flux)',
            'Les templates typologiques correspondants sont auto-sélectionnés comme guides',
            'Vous affinez en dialogue : "augmente la cuisine à 25 m²", "crée une liaison entre bureau et terrasse"',
            'Quand le schéma fonctionnel est validé, la génération 2D/IFC/GLB se lance',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted">
              <span className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
