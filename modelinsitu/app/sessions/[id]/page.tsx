'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { sessions } from '@/lib/api';
import type { Session, HistoryEntry, Programme, Espace, LayoutData } from '@/lib/types';
import ProgrammeViewer from '@/components/ProgrammeViewer';
import SvgSchematic from '@/components/SvgSchematic';
import {
  Send, Lock, Zap, Loader2, CheckCircle2, AlertCircle,
  ChevronRight, ChevronDown, RotateCcw, Download, MousePointerClick,
  LayoutGrid, List,
} from 'lucide-react';
import clsx from 'clsx';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STATUS_LABELS: Record<string, string> = {
  parsing:             'Analyse CdC…',
  brouillon:           'Brouillon',
  functional_schema:   'Schéma fonctionnel',
  schema_fonctionnel:  'Schéma fonctionnel',
  schema_valide:       'Schéma validé',
  schema_locked:       'Schéma verrouillé',
  generation_en_cours: 'Génération…',
  genere:              'Généré',
  done:                'Généré',
  erreur:              'Erreur',
  archive:             'Archivé',
};

// ── Suggestions dynamiques tirées des espaces réels ──────────────────────────
function buildSuggestions(programme: Programme | undefined | null): string[] {
  if (!programme?.espaces?.length) {
    return [
      'Ajoute un bureau de 12 m² au rez-de-chaussée',
      'Crée une liaison directe entre cuisine et terrasse',
      'Ajoute une suite parentale avec salle de bain privative',
      'Déplace le séjour en façade sud',
    ];
  }
  const espaces = programme.espaces;
  const liaisons = programme.liaisons ?? [];
  const suggestions: string[] = [];

  const avecSurf = espaces.filter(e => e.dimensions?.surface_cible_m2);
  if (avecSurf.length > 0) {
    const e = avecSurf[0];
    const target = Math.round((e.dimensions!.surface_cible_m2! * 1.2) / 5) * 5;
    suggestions.push(`Augmente "${e.nom}" à ${target} m²`);
  }

  const linked = new Set(liaisons.flatMap(l => [
    `${l.source ?? l.espace_a}-${l.cible ?? l.espace_b}`,
    `${l.cible ?? l.espace_b}-${l.source ?? l.espace_a}`,
  ]));
  outer:
  for (let i = 0; i < espaces.length - 1; i++) {
    for (let j = i + 1; j < espaces.length; j++) {
      if (!linked.has(`${espaces[i].id}-${espaces[j].id}`)) {
        suggestions.push(`Crée une liaison directe entre "${espaces[i].nom}" et "${espaces[j].nom}"`);
        break outer;
      }
    }
  }

  const sansniveau = espaces.filter(e => !e.niveau || e.niveau === 'rdc');
  if (sansniveau.length > 2) {
    suggestions.push(`Déplace "${sansniveau[sansniveau.length - 1].nom}" à l'étage`);
  }
  if (suggestions.length < 4) suggestions.push('Ajoute une terrasse orientée sud');
  if (suggestions.length < 4) suggestions.push('Ajoute une chambre supplémentaire de 14 m²');
  if (suggestions.length < 4) suggestions.push("Crée un accès PMR depuis l'entrée");
  return suggestions.slice(0, 4);
}

// ── Rendu markdown minimal sans dangerouslySetInnerHTML ─────────────────────
function MdContent({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n\n+/).map((para, pi) => (
        <div key={pi}>
          {para.split('\n').map((line, li) => {
            const isBullet = line.startsWith('• ') || line.startsWith('- ');
            const content  = isBullet ? line.slice(2) : line;
            if (!content.trim()) return null;
            const parts = content.split(/(\*\*[^*]+\*\*)/g);
            return (
              <p key={li} className={clsx('leading-snug', isBullet && 'pl-3 relative before:absolute before:left-0 before:content-["•"] before:text-accent/50')}>
                {parts.map((p, k) =>
                  p.startsWith('**') && p.endsWith('**')
                    ? <strong key={k} className="text-white font-semibold">{p.slice(2, -2)}</strong>
                    : p
                )}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<(Session & { history: HistoryEntry[] }) | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [locking, setLocking]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [svgContent, setSvgContent] = useState('');

  // Panneau gauche
  const [leftTab, setLeftTab]           = useState<'espaces' | 'schema'>('espaces');
  const [layoutData, setLayoutData]     = useState<LayoutData | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [selectedEspaceId, setSelectedEspaceId] = useState<string | undefined>();

  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Chargement du layout (fonctionnel, pas la génération complète) ──────
  const fetchLayout = useCallback(async () => {
    setLayoutLoading(true);
    try {
      const data = await sessions.layout(id);
      setLayoutData(data);
    } catch { /* silencieux — layout indisponible */ }
    finally { setLayoutLoading(false); }
  }, [id]);

  async function load(silent = false) {
    try {
      const s = await sessions.get(id);
      setSession(s);

      if (!silent && messages.length === 0) {
        if (s.status === 'parsing') {
          setMessages([{
            role: 'assistant',
            content: 'Analyse du cahier des charges en cours… Je génère le programme spatial.',
            timestamp: new Date(s.created_at),
          }]);
        } else if (s.programme?.espaces?.length) {
          const nb   = s.programme.espaces.length;
          const nl   = s.programme.liaisons?.length ?? 0;
          const surf = s.programme.espaces.reduce((t, e) => t + (e.dimensions?.surface_cible_m2 ?? 0), 0);
          const conf = s.programme.metadata?.confiance;
          const questions = s.programme.metadata?.questions_clarification ?? [];
          let msg = `**Programme extrait du cahier des charges.**\n${nb} espaces · ${nl} liaisons · ~${Math.round(surf)} m²${conf !== undefined ? ` · confiance ${Math.round(conf * 100)} %` : ''}\n\nVous pouvez affiner en dialogue naturel, puis valider pour lancer la génération.`;
          if (questions.length > 0) {
            msg += `\n\n**Questions de clarification :**\n${questions.slice(0, 4).map(q => `• ${q}`).join('\n')}`;
          }
          setMessages([{ role: 'assistant', content: msg, timestamp: new Date(s.created_at) }]);
        }
      }

      if ((s.status === 'genere' || s.status === 'done') && !svgContent) {
        try { const { svg } = await sessions.svg(id); setSvgContent(svg); } catch { /* ok */ }
      }

      // Charger le schéma fonctionnel si on a un programme
      if (s.programme?.espaces?.length) {
        fetchLayout();
      }
    } catch {
      setError('Impossible de charger la session');
    } finally {
      setLoading(false);
    }
  }

  // Polling pendant parsing
  useEffect(() => {
    if (session?.status !== 'parsing') return;
    const timer = setInterval(async () => {
      try {
        const s = await sessions.get(id);
        if (s.status === 'parsing') return;
        setSession(s);
        clearInterval(timer);
        const nb   = s.programme?.espaces?.length ?? 0;
        const nl   = s.programme?.liaisons?.length ?? 0;
        const surf = (s.programme?.espaces ?? []).reduce((t, e) => t + (e.dimensions?.surface_cible_m2 ?? 0), 0);
        const conf = s.programme?.metadata?.confiance;
        const questions: string[] = s.programme?.metadata?.questions_clarification ?? [];
        let msg = s.status === 'erreur'
          ? 'Erreur lors de l\'analyse. Essayez de saisir une commande pour démarrer manuellement.'
          : `**Programme généré.**\n${nb} espaces · ${nl} liaisons · ~${Math.round(surf)} m²${conf !== undefined ? ` · confiance ${Math.round(conf * 100)} %` : ''}\n\nVous pouvez affiner en dialogue, puis valider pour lancer la génération.`;
        if (s.status !== 'erreur' && questions.length > 0) {
          msg += `\n\n**Questions de clarification :**\n${questions.slice(0, 4).map(q => `• ${q}`).join('\n')}`;
        }
        setMessages(m => [...m, { role: 'assistant', content: msg, timestamp: new Date() }]);
        if (s.programme?.espaces?.length) fetchLayout();
      } catch { /* silencieux */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [session?.status, id]);

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clic espace → pré-remplit input
  const handleSelectEspace = useCallback((espaceOrId: Espace | string, nom?: string) => {
    let eid: string, enom: string;
    if (typeof espaceOrId === 'string') {
      eid = espaceOrId; enom = nom ?? espaceOrId;
    } else {
      eid = espaceOrId.id;
      enom = espaceOrId.nom;
      nom = (espaceOrId.dimensions?.surface_cible_m2 !== undefined)
        ? `(${espaceOrId.dimensions.surface_cible_m2} m²)` : undefined;
    }
    setSelectedEspaceId(eid);
    const surfTxt = (typeof espaceOrId !== 'string' && espaceOrId.dimensions?.surface_cible_m2)
      ? ` (${espaceOrId.dimensions.surface_cible_m2} m²)` : '';
    setInput(`Modifie "${enom}"${surfTxt} : `);
    setTimeout(() => {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  }, []);

  const handleSelectEspaceFromSvg = useCallback((eid: string, enom: string) => {
    setSelectedEspaceId(eid);
    setInput(`Modifie "${enom}" : `);
    setTimeout(() => {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  }, []);

  const suggestions = useMemo(() => buildSuggestions(session?.programme), [session?.programme]);

  async function handleSend() {
    const cmd = input.trim();
    if (!cmd || sending || !session || isLocked) return;
    setInput('');
    setSelectedEspaceId(undefined);
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
      // Refresh schéma après chaque commande
      fetchLayout();
    } catch (e: unknown) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Erreur : ${e instanceof Error ? e.message : 'Erreur'}`,
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
      setSession(prev => prev ? { ...prev, status: 'generation_en_cours' } : prev);
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Génération lancée (job ${job_id.slice(0, 8)}…). Actualisation automatique dans 30 s.`,
        timestamp: new Date(),
      }]);
      setTimeout(async () => { await load(true); setGenerating(false); }, 30000);
    } catch (e: unknown) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Erreur génération : ${e instanceof Error ? e.message : 'Erreur'}`,
        timestamp: new Date(),
      }]);
      setGenerating(false);
    }
  }

  const isParsing   = session?.status === 'parsing';
  const isLocked    = ['schema_valide', 'schema_locked', 'genere', 'done', 'generation_en_cours'].includes(session?.status ?? '');
  const canGenerate = session?.status === 'schema_valide' || session?.status === 'schema_locked';
  const isGenerated = session?.status === 'genere' || session?.status === 'done';
  const hasProgramme = (session?.programme?.espaces?.length ?? 0) > 0;

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

      {/* ── Panneau gauche ─────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted">Programme spatial</p>
          <p className="text-sm font-semibold text-white truncate">{session.project_name}</p>
        </div>

        {/* Status + hint */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50">
          <span className={clsx(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
            isGenerated                      ? 'bg-success/20 text-success' :
            session.status === 'schema_valide' ? 'bg-accent/20 text-accent' :
            session.status === 'generation_en_cours' ? 'bg-warning/20 text-warning' :
            session.status === 'parsing'     ? 'bg-blue-500/20 text-blue-400' :
            'bg-muted/20 text-muted'
          )}>
            {STATUS_LABELS[session.status] || session.status}
          </span>
          {!isLocked && !isParsing && hasProgramme && (
            <span className="text-[10px] text-muted/50 flex items-center gap-1">
              <MousePointerClick size={10} /> cliquer un espace
            </span>
          )}
        </div>

        {/* Parsing state */}
        {isParsing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-white font-medium">Analyse du cahier des charges</p>
            <p className="text-xs text-muted">L&apos;IA extrait le programme spatial…</p>
          </div>
        )}

        {/* Tabs (espaces / schéma) — seulement si programme disponible */}
        {!isParsing && hasProgramme && (
          <>
            <div className="flex border-b border-border flex-shrink-0">
              <button
                onClick={() => setLeftTab('espaces')}
                className={clsx(
                  'flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors',
                  leftTab === 'espaces'
                    ? 'text-white border-b-2 border-accent'
                    : 'text-muted hover:text-white/70'
                )}
              >
                <List size={11} /> Espaces
              </button>
              <button
                onClick={() => setLeftTab('schema')}
                className={clsx(
                  'flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors',
                  leftTab === 'schema'
                    ? 'text-white border-b-2 border-accent'
                    : 'text-muted hover:text-white/70'
                )}
              >
                <LayoutGrid size={11} /> Schéma
                {layoutLoading && <Loader2 size={9} className="animate-spin" />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === 'espaces' && (
                <ProgrammeViewer
                  programme={session.programme!}
                  compact
                  onSelectEspace={isLocked ? undefined : handleSelectEspace}
                  selectedEspaceId={selectedEspaceId}
                />
              )}
              {leftTab === 'schema' && (
                layoutData
                  ? <SvgSchematic
                      layout={layoutData}
                      selectedEspaceId={selectedEspaceId}
                      onSelectEspace={isLocked ? undefined : handleSelectEspaceFromSvg}
                    />
                  : layoutLoading
                    ? <div className="flex items-center justify-center py-12 gap-2 text-muted text-xs">
                        <Loader2 size={14} className="animate-spin" /> Calcul du schéma…
                      </div>
                    : <div className="text-center py-12 text-muted text-xs">
                        Schéma non disponible
                      </div>
              )}
            </div>
          </>
        )}

        {/* SVG téléchargeable après génération */}
        {isGenerated && svgContent && (
          <div className="border-t border-border p-3 flex-shrink-0">
            <button
              onClick={() => {
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url; a.download = `${session.project_name}.svg`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-ghost w-full flex items-center justify-center gap-2 text-xs"
            >
              <Download size={12} /> Télécharger SVG généré
            </button>
          </div>
        )}

        {/* Actions bas */}
        <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
          {!isLocked && hasProgramme && (
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

      {/* ── Panneau droit — dialogue ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{session.project_name}</h1>
            <p className="text-xs text-muted">Dialogue de conception — affinez le programme en langage naturel</p>
          </div>
          <button
            onClick={() => load(true)}
            className="btn-ghost p-2 flex-shrink-0"
            title="Actualiser"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted text-sm">Décrivez votre projet pour démarrer</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx(
                'max-w-[82%] rounded-xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border text-white/90'
              )}>
                {msg.role === 'assistant'
                  ? <MdContent text={msg.content} />
                  : <p className="whitespace-pre-wrap">{msg.content}</p>
                }
                <p className="text-[10px] opacity-40 mt-1.5 text-right">
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
        {!isLocked && !isParsing && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  setSelectedEspaceId(undefined);
                  inputRef.current?.focus();
                }}
                className="text-[11px] text-muted hover:text-white border border-border hover:border-accent/40 rounded-full px-3 py-1.5 whitespace-nowrap transition-colors flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          {isParsing ? (
            <div className="text-center text-muted text-sm py-3 bg-surface rounded-xl border border-border">
              <Loader2 size={14} className="inline mr-2 animate-spin" />
              Analyse en cours — dialogue disponible dans quelques secondes
            </div>
          ) : isLocked ? (
            <div className="text-center text-muted text-sm py-3 bg-surface rounded-xl border border-border">
              <Lock size={14} className="inline mr-1" />
              Schéma verrouillé —{' '}
              {canGenerate ? 'lancez la génération →' : 'génération en cours ou terminée'}
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                className="textarea flex-1 resize-none"
                rows={2}
                placeholder='ex. Augmente le séjour à 40 m², ajoute une liaison directe avec la terrasse…'
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (!e.target.value) setSelectedEspaceId(undefined);
                }}
                disabled={sending}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
