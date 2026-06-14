'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sessions } from '@/lib/api';
import {
  Loader2, ArrowRight, FileText, MapPin, Ruler,
  ChevronDown, ChevronRight, Building2,
} from 'lucide-react';

const CDC_PLACEHOLDER = `Décrivez librement le projet :
• Programme : maison individuelle de 150 m² environ, 3 chambres, séjour ouvert sur terrasse sud, cuisine semi-ouverte, bureau à domicile, garage simple.
• Ambiances souhaitées, orientations préférées, contraintes particulières.
• L'IA en tire un programme structuré que vous pourrez affiner en dialogue.`;

interface AdresseFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string; postcode: string; city: string };
}

export default function NewSessionPage() {
  const router = useRouter();

  // Projet
  const [projectName, setProjectName] = useState('');
  const [cdcTexte, setCdcTexte]       = useState('');

  // Terrain
  const [adresseQuery, setAdresseQuery]   = useState('');
  const [adresseSuggestions, setAdresseSuggestions] = useState<AdresseFeature[]>([]);
  const [adresseSelected, setAdresseSelected] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [largeur, setLargeur]   = useState(20);
  const [profondeur, setProfondeur] = useState(15);

  // PLU
  const [pluOpen, setPluOpen]             = useState(false);
  const [pluZone, setPluZone]             = useState('');
  const [pluHauteur, setPluHauteur]       = useState('');
  const [pluNiveaux, setPluNiveaux]       = useState('');
  const [pluSurface, setPluSurface]       = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete adresse (api-adresse.data.gouv.fr)
  useEffect(() => {
    if (adresseQuery.length < 3) { setAdresseSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresseQuery)}&limit=5`
        );
        const data = await res.json();
        setAdresseSuggestions(data.features || []);
      } catch { /* silencieux */ }
    }, 300);
  }, [adresseQuery]);

  const selectAdresse = useCallback((f: AdresseFeature) => {
    const [lng, lat] = f.geometry.coordinates;
    setAdresseSelected(f.properties.label);
    setAdresseQuery(f.properties.label);
    setLocation({ lat, lng });
    setAdresseSuggestions([]);
  }, []);

  async function handleCreate() {
    if (!projectName.trim()) { setError('Donnez un nom au projet'); return; }
    setError('');
    setLoading(true);
    try {
      const plu: Record<string, string | number> = {};
      if (pluZone)    plu.zone = pluZone;
      if (pluHauteur) plu.hauteur_max_m = parseFloat(pluHauteur);
      if (pluNiveaux) plu.niveaux_max   = parseInt(pluNiveaux);
      if (pluSurface) plu.surface_plancher_max_m2 = parseFloat(pluSurface);

      const session = await sessions.create({
        project_name: projectName.trim(),
        cdc_texte:    cdcTexte.trim() || undefined,
        location:     location ? { lat: location.lat, lng: location.lng } : undefined,
        emprise:      { largeur, profondeur },
        plu:          Object.keys(plu).length > 0 ? plu : undefined,
        adresse:      adresseSelected || undefined,
      });
      router.push(`/sessions/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={24} className="text-accent" /> Nouvelle session
        </h1>
        <p className="text-muted text-sm mt-1">
          Décrivez le projet — l&apos;IA génère le programme spatial et engage le dialogue
        </p>
      </div>

      {/* Section Projet */}
      <Section icon={<Building2 size={15} />} title="Projet">
        <div>
          <label className="label">Nom du projet <span className="text-danger">*</span></label>
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
          <label className="label">Cahier des charges</label>
          <textarea
            className="textarea"
            rows={9}
            placeholder={CDC_PLACEHOLDER}
            value={cdcTexte}
            onChange={e => setCdcTexte(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-muted mt-1">
            Texte libre — surfaces, ambiances, contraintes, nombre de pièces, orientations souhaitées…
          </p>
        </div>
      </Section>

      {/* Section Terrain */}
      <Section icon={<MapPin size={15} />} title="Terrain">
        <div className="relative">
          <label className="label">Adresse du projet</label>
          <input
            className="input"
            placeholder="ex. 12 rue de la Paix, Montauban"
            value={adresseQuery}
            onChange={e => {
              setAdresseQuery(e.target.value);
              if (e.target.value !== adresseSelected) setLocation(null);
            }}
            disabled={loading}
            autoComplete="off"
          />
          {adresseSuggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-xl overflow-hidden shadow-xl">
              {adresseSuggestions.map((f, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-accent/10 transition-colors"
                    onClick={() => selectAdresse(f)}
                  >
                    <span className="font-medium">{f.properties.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {location && (
            <p className="text-xs text-success mt-1">
              ✓ Géolocalisé — {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div>
          <label className="label flex items-center gap-1"><Ruler size={12} /> Emprise disponible</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Largeur (m)</label>
              <input
                type="number" min={3} max={200} step={0.5}
                className="input text-center"
                value={largeur}
                onChange={e => setLargeur(parseFloat(e.target.value) || 20)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Profondeur (m)</label>
              <input
                type="number" min={3} max={200} step={0.5}
                className="input text-center"
                value={profondeur}
                onChange={e => setProfondeur(parseFloat(e.target.value) || 15)}
                disabled={loading}
              />
            </div>
          </div>
          <p className="text-xs text-muted mt-1">
            Surface d&apos;emprise : <span className="text-white font-medium">{(largeur * profondeur).toFixed(0)} m²</span>
          </p>
        </div>
      </Section>

      {/* Section PLU (collapsable) */}
      <div className="card">
        <button
          type="button"
          className="w-full flex items-center justify-between text-sm font-semibold text-white"
          onClick={() => setPluOpen(o => !o)}
        >
          <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
            Contraintes PLU
            <span className="text-[10px] normal-case text-muted/60 font-normal">(optionnel)</span>
          </span>
          {pluOpen ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </button>

        {pluOpen && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Zone PLU</label>
              <input className="input" placeholder="ex. UA, UB, 1AU…" value={pluZone} onChange={e => setPluZone(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Hauteur max (m)</label>
              <input type="number" min={2} max={100} className="input" placeholder="ex. 9" value={pluHauteur} onChange={e => setPluHauteur(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Niveaux max</label>
              <input type="number" min={1} max={20} className="input" placeholder="ex. 2" value={pluNiveaux} onChange={e => setPluNiveaux(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">SHON max (m²)</label>
              <input type="number" min={10} className="input" placeholder="ex. 250" value={pluSurface} onChange={e => setPluSurface(e.target.value)} disabled={loading} />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleCreate}
        disabled={loading || !projectName.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-3"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {loading ? 'Création…' : 'Créer et analyser le programme'}
      </button>

      {/* How it works */}
      <div className="p-4 bg-surface rounded-xl border border-border">
        <p className="text-xs font-semibold text-white mb-3">Comment ça marche ?</p>
        <ol className="space-y-2">
          {[
            'Le CdC est analysé par l\'IA — programme spatial extrait automatiquement (espaces, liaisons, surfaces)',
            'Les contraintes terrain et PLU enrichissent les règles de placement',
            'Vous affinez en dialogue naturel : "agrandis le séjour", "ajoute une liaison cuisine→terrasse"',
            'Quand le schéma est validé, la génération 2D/IFC/GLB se lance',
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

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}
