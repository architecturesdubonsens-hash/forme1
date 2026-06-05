'use client';
import { useState } from 'react';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(
    typeof window !== 'undefined'
      ? localStorage.getItem('capinsitu_api_url') || process.env.NEXT_PUBLIC_API_URL || ''
      : ''
  );
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('capinsitu_api_url', apiUrl);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-8">
        <Settings size={24} className="text-accent" /> Paramètres
      </h1>

      <div className="card space-y-6">
        <div>
          <label className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">
            URL du backend (Railway)
          </label>
          <input
            className="input font-mono"
            placeholder="https://your-service.railway.app"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
          />
          <p className="text-xs text-muted mt-1">
            URL du service FastAPI déployé sur Railway. Défini par défaut via la variable
            d&apos;environnement <code className="text-accent">NEXT_PUBLIC_API_URL</code>.
          </p>
        </div>

        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saved ? 'Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      <div className="mt-6 card space-y-3">
        <p className="text-xs font-semibold text-white uppercase tracking-wider">Stack technique</p>
        <div className="space-y-1 text-xs text-muted">
          <p>Frontend : Next.js 14 · Tailwind CSS · TypeScript</p>
          <p>Backend : FastAPI + Node.js 20 · Railway</p>
          <p>Base de données : Supabase (CapInSitu — fnfrusblyzndbzckkfir)</p>
          <p>IA : Claude API (Anthropic) — Vision + génération programme</p>
        </div>
      </div>
    </div>
  );
}
