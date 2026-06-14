'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { sessions } from '@/lib/api';
import type { Session, HistoryEntry, Programme } from '@/lib/types';
import ProgrammeViewer from '@/components/ProgrammeViewer';
import {
  Send, Lock, Zap, Loader2, CheckCircle2, AlertCircle,
  ChevronRight, ChevronDown, RotateCcw, Download,
} from 'lucide-react';
import clsx from 'clsx';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  schema_fonctionnel: 'Schéma fonctionnel',
  schema_valide: 'Schéma validé',
  generation_en_cours: 'Génération…',
  genere: 'Généré',
  erreur: 'Erreur',
  archive: 'Archivé',
};

const SUGGESTIONS = [
  'Augmente la surface du séjour à 35 m²',
  'Crée une liaison directe entre cuisine et terrasse',
  'Ajoute un bureau de 12 m² au RDC',
  'Supprime la chambre 3 et agrandit la chambre principale',
  'Ajoute un contact extérieur sud sur le séjour',
  'Crée une liaison visuelle entre salon et jardin',
];

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<(Session & { history: HistoryEntry[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [locking, setLocking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genJobId, setGenJobId] = useState('');
  const [svgContent, setSvgContent] = useState('');
  const [programmeOpen, setProgrammeOpen] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const s = await sessions.get(id);
      setSession(s);
      if (s.programme && messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: `Programme généré depuis le cahier des charges.\n${s.programme.espaces?.length ?? 0} espaces · ${s.programme.liaisons?.length ?? 0} liaisons · ~${s.programme.surface_totale_estimee ?? '?'} m²\n\nVous pouvez affiner le schéma en dialogue, puis valider pour lancer la génération.`,
          timestamp: new Date(s.created_at),
        }]);
      }
      if (s.status === 'genere') {
        const { svg } = await sessions.svg(id);
        setSvgContent(svg);
      }
    } catch {
      setError('Impossible de charger la session');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const cmd = input.trim();
    if (!cmd || sending || !session) return;
    if (session.status === 'schema_valide' || session.status === 'genere') return;
    setInput('');
    setSending(true);
    setMessages(m => [...m, { role: 'user', content: cmd, timestamp: new Date() }]);
    try {
      const result = await sessions.command(id, cmd);
      setMessages(m => [...m, {
        role: 'assistant',
        content: result.summary || 'Programme mis à jour.',
        timestamp: new Date(),
      }]);
      setSession(prev => prev ? { ...prev, programme: result.programme } : prev);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Erreur : ${msg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleLock() {
    if (!session || locking) return;
    setLocking(true);
    try {
      const updated = await sessions.lock(id);
      setSession(prev => prev ? { ...prev, ...updated } : prev);
      setMessages(m => [...m, {
        role: 'assistant',
        content: '✓ Schéma fonctionnel verrouillé. Vous pouvez maintenant lancer la génération.',
        timestamp: new Date(),
      }]);
    } catch (e: unknown) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Erreur verrouillage : ${e instanceof Error ? e.message : 'Erreur'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLocking(false);
    }
  }

  async function handleGenerate() {
    if (!session || generating) return;
    setGenerating(true);
    try {
      const { job_id } = await sessions.generate(id);
      setGenJobId(job_id);
      setSession(prev => prev ? { ...prev, status: 'generation_en_cours' } : prev);
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Génération lancée (job ${job_id.slice(0, 8)}…). Actualisation automatique dans 30 s.`,
        timestamp: new Date(),
      }]);
      setTimeout(async () => {
        await load();
        setGenerating(false);
      }, 30000);
    } catch (e: unknown) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Erreur génération : ${e instanceof Error ? e.message : 'Erreur'}`,
        timestamp: new Date(),
      }]);
      setGenerating(false);
    }
  }

  const isLocked = session?.status === 'schema_valide' || session?.status === 'genere' || session?.status === 'generation_en_cours';
  const canGenerate = session?.status === 'schema_valide';
  const isGenerated = session?.status === 'genere';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle size={32} className="text-danger mx-auto mb-2" />
          <p className="text-muted">{error || 'Session introuvable'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left — programme viewer */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden">
        <div
          className="p-4 border-b border-border flex items-center justify-between cursor-pointer"
          onClick={() => setProgrammeOpen(o => !o)}
        >
          <div>
            <p className="text-xs text-muted">Programme spatial</p>
            <p className="text-sm font-semibold text-white truncate">{session.project_name}</p>
          </div>
          {programmeOpen ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
        </div>

        <div className="p-3">
          <span className={clsx(
            'badge text-xs',
            session.status === 'genere' ? 'bg-success/20 text-success' :
            session.status === 'schema_valide' ? 'bg-accent/20 text-accent' :
            session.status === 'generation_en_cours' ? 'bg-warning/20 text-warning' :
            'bg-muted/20 text-muted'
          )}>
            {STATUS_LABELS[session.status] || session.status}
          </span>
        </div>

        {programmeOpen && session.programme && (
          <div className="flex-1 overflow-y-auto p-4">
            <ProgrammeViewer programme={session.programme} compact />
          </div>
        )}

        {/* SVG result */}
        {isGenerated && svgContent && (
          <div className="border-t border-border p-4">
            <p className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Layout 2D</p>
            <div
              className="w-full bg-canvas rounded-lg overflow-hidden border border-border"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
            <button
              onClick={() => {
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${session.project_name}.svg`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-ghost w-full mt-2 flex items-center justify-center gap-2 text-xs"
            >
              <Download size={13} /> Télécharger SVG
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2">
          {!isLocked && session.programme && (
            <button
              onClick={handleLock}
              disabled={locking}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {locking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Valider le schéma
            </button>
          )}
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-success/20 hover:bg-success/30 text-success font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Lancer la génération
            </button>
          )}
          {session.status === 'generation_en_cours' && (
            <div className="flex items-center justify-center gap-2 text-warning text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> Génération en cours…
            </div>
          )}
          {isGenerated && (
            <div className="flex items-center justify-center gap-2 text-success text-sm py-2">
              <CheckCircle2 size={14} /> Bâtiment généré
            </div>
          )}
        </div>
      </div>

      {/* Right — chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">{session.project_name}</h1>
            <p className="text-xs text-muted">Dialogue de conception — affinez le programme en langage naturel</p>
          </div>
          <button onClick={load} className="btn-ghost p-2" title="Actualiser">
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted text-sm">Saisissez votre cahier des charges pour démarrer</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx(
                'max-w-[80%] rounded-xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border text-white/90'
              )}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                <p className="text-[10px] opacity-50 mt-1">
                  {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <Loader2 size={14} className="animate-spin text-accent" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {!isLocked && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {SUGGESTIONS.slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs text-muted hover:text-white border border-border hover:border-accent/40 rounded-full px-3 py-1 whitespace-nowrap transition-colors flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          {isLocked ? (
            <div className="text-center text-muted text-sm py-3 bg-surface rounded-xl border border-border">
              <Lock size={14} className="inline mr-1" />
              Schéma verrouillé — {canGenerate ? 'lancez la génération →' : 'génération en cours ou terminée'}
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                className="textarea flex-1 resize-none"
                rows={2}
                placeholder="ex. Augmente la surface du séjour à 40 m², crée une liaison directe avec la terrasse…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={sending}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="btn-primary p-3 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted mt-1">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
        </div>
      </div>
    </div>
  );
}
