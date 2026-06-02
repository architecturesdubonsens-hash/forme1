"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import {
  getWearableHistory,
  getWearableToday,
  syncWearable,
  type WearableData,
} from "@/lib/api";
import BottomNav from "@/components/BottomNav";

type Tab = "status" | "setup" | "history";

export default function WearablePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [today, setToday] = useState<WearableData | null>(null);
  const [history, setHistory] = useState<WearableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);
      const [t, h] = await Promise.all([
        getWearableToday(user.id).catch(() => null),
        getWearableHistory(user.id, 14).catch(() => []),
      ]);
      setToday(t);
      setHistory(h as WearableData[]);
      setLoading(false);
    };
    init();
  }, [router]);

  const copyId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://votre-app.railway.app";

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition">
          ←
        </button>
        <div>
          <h1 className="text-2xl font-extrabold">Apple Watch</h1>
          <p className="text-slate-400 text-sm">Connexion & données de santé</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-6 bg-surface-card rounded-xl p-1">
        {(["status", "setup", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === t ? "bg-brand-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "status" ? "Aujourd'hui" : t === "setup" ? "Installation" : "Historique"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "status" && (
          <motion.div key="status" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <StatusTab
              today={today}
              userId={userId}
              onUpdated={(d, h) => { setToday(d); setHistory(h); }}
            />
          </motion.div>
        )}
        {activeTab === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <SetupTab userId={userId} backendUrl={backendUrl} copied={copied} onCopy={copyId} />
          </motion.div>
        )}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <HistoryTab history={history} />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav active="profile" />
    </div>
  );
}

// ── Onglet Aujourd'hui ──────────────────────────────────────────────────────

const FIELDS = [
  { key: "resting_hr",         label: "FC repos",       unit: "bpm",  placeholder: "58",  hint: "< 60 = excellent" },
  { key: "hrv_rmssd",          label: "HRV (RMSSD)",    unit: "ms",   placeholder: "45",  hint: "> 50 = bon" },
  { key: "sleep_duration_min", label: "Sommeil",        unit: "min",  placeholder: "450", hint: "7h = 420 min" },
  { key: "sleep_quality",      label: "Qualité sommeil",unit: "/5",   placeholder: "4",   hint: "1 = mauvais, 5 = excellent" },
  { key: "active_calories",    label: "Cal. actives",   unit: "kcal", placeholder: "420", hint: "Hier" },
  { key: "steps",              label: "Pas",            unit: "",     placeholder: "8500", hint: "> 8 000 recommandé" },
] as const;

type FormKey = typeof FIELDS[number]["key"];

function StatusTab({
  today,
  userId,
  onUpdated,
}: {
  today: WearableData | null;
  userId: string | null;
  onUpdated: (data: WearableData, history: WearableData[]) => void;
}) {
  const [form, setForm] = useState<Record<FormKey, string>>({
    resting_hr: "",
    hrv_rmssd: "",
    sleep_duration_min: "",
    sleep_quality: "",
    active_calories: "",
    steps: "",
  });
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(!today);

  // Pré-remplir avec les données du jour si elles existent
  useEffect(() => {
    if (today) {
      setForm({
        resting_hr:          today.resting_hr?.toString() ?? "",
        hrv_rmssd:           today.hrv_rmssd?.toString() ?? "",
        sleep_duration_min:  today.sleep_duration_min?.toString() ?? "",
        sleep_quality:       today.sleep_quality?.toString() ?? "",
        active_calories:     today.active_calories?.toString() ?? "",
        steps:               today.steps?.toString() ?? "",
      });
    }
  }, [today]);

  const handleSync = async () => {
    if (!userId) return;
    setSyncing(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        date: new Date().toISOString().split("T")[0],
      };
      if (form.resting_hr)         payload.resting_hr = parseInt(form.resting_hr);
      if (form.hrv_rmssd)          payload.hrv_rmssd = parseFloat(form.hrv_rmssd);
      if (form.sleep_duration_min) payload.sleep_duration_min = parseInt(form.sleep_duration_min);
      if (form.sleep_quality)      payload.sleep_quality = parseInt(form.sleep_quality);
      if (form.active_calories)    payload.active_calories = parseInt(form.active_calories);
      if (form.steps)              payload.steps = parseInt(form.steps);

      const result = await syncWearable(userId, payload) as WearableData;
      const { getWearableHistory } = await import("@/lib/api");
      const h = await getWearableHistory(userId, 14).catch(() => []) as WearableData[];
      onUpdated(result, h);
      setShowForm(false);
      setMsg({ text: `Score de récupération : ${result.recovery_score ?? "—"} / 100`, ok: true });
    } catch {
      setMsg({ text: "Erreur lors de la synchronisation.", ok: false });
    } finally {
      setSyncing(false);
    }
  };

  const score = today?.recovery_score ?? null;
  const scoreColor =
    score == null ? "text-slate-400" :
    score >= 70   ? "text-green-400" :
    score >= 40   ? "text-yellow-400" :
                    "text-red-400";
  const scoreBg =
    score == null ? "border-slate-500/20 bg-slate-500/5" :
    score >= 70   ? "border-green-500/30 bg-green-500/5" :
    score >= 40   ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-red-500/30 bg-red-500/5";
  const scoreLabel =
    score == null ? "—" :
    score >= 70   ? "Bonne récupération" :
    score >= 40   ? "Récupération normale" :
                    "Récupération faible";
  const scoreAdvice =
    score == null ? "Remplis au moins FC repos + HRV pour obtenir un score." :
    score >= 70   ? "Tu peux viser une séance d'intensité élevée aujourd'hui." :
    score >= 40   ? "Programme standard recommandé." :
                    "Privilégie une séance légère ou du repos actif.";

  return (
    <div className="space-y-4">

      {/* Message résultat */}
      {msg && (
        <div className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-brand-500/10 border border-brand-500/30 text-brand-300" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {/* Score du jour */}
      {today && (
        <div className={`rounded-2xl border p-5 ${scoreBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Score de récupération</span>
            <span className="text-xs text-slate-500">
              {new Date(today.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          {score != null ? (
            <div className="flex items-end gap-3 mb-1">
              <span className={`text-5xl font-extrabold ${scoreColor}`}>{score}</span>
              <span className={`text-sm font-medium mb-1 ${scoreColor}`}>{scoreLabel}</span>
            </div>
          ) : (
            <p className={`text-lg font-bold mb-1 ${scoreColor}`}>{scoreLabel}</p>
          )}
          <p className="text-xs text-slate-400">{scoreAdvice}</p>
        </div>
      )}

      {/* Formulaire de saisie */}
      <div className="bg-surface-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-surface-muted/30 transition"
        >
          <span>{today ? "Modifier les données du jour" : "Saisir mes données"}</span>
          <span className="text-slate-400 text-xs">{showForm ? "▲" : "▼"}</span>
        </button>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4">
                <p className="text-xs text-slate-400">
                  Saisis tes données pour calculer ton score de récupération.
                  Tous les champs sont optionnels — plus tu en remplis, plus le score est précis.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {FIELDS.map(({ key, label, unit, placeholder, hint }) => (
                    <div key={key}>
                      <label className="text-xs text-slate-400 mb-1 block">
                        {label}{unit && <span className="text-slate-600 ml-1">{unit}</span>}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                      />
                      <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Calcul en cours…
                    </>
                  ) : (today ? "Mettre à jour" : "Calculer mon score")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Métriques détaillées */}
      {today && (
        <div className="bg-surface-card rounded-2xl p-4 grid grid-cols-2 gap-3">
          <Metric icon="❤️" label="FC repos"       value={today.resting_hr != null ? `${today.resting_hr} bpm` : "—"} />
          <Metric icon="📈" label="HRV"             value={today.hrv_rmssd != null ? `${Math.round(today.hrv_rmssd)} ms` : "—"} />
          <Metric icon="🌙" label="Sommeil"         value={today.sleep_duration_min != null ? formatSleep(today.sleep_duration_min) : "—"} />
          <Metric icon="⭐" label="Qualité sommeil" value={today.sleep_quality != null ? `${today.sleep_quality}/5` : "—"} />
          <Metric icon="🔥" label="Cal. actives"   value={today.active_calories != null ? `${today.active_calories} kcal` : "—"} />
          <Metric icon="👟" label="Pas"             value={today.steps != null ? today.steps.toLocaleString("fr") : "—"} />
        </div>
      )}
    </div>
  );
}

// ── Onglet Installation ─────────────────────────────────────────────────────

function SetupTab({
  userId,
  backendUrl,
  copied,
  onCopy,
}: {
  userId: string | null;
  backendUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const actions = [
    {
      num: 1,
      emoji: "📱",
      title: "Ouvrir Raccourcis → + → Nouveau raccourci",
      detail: null,
    },
    {
      num: 2,
      emoji: "❤️",
      title: 'Chercher "Obtenir des échantillons de santé"',
      detail: "Ajouter 3 fois cette action :\n• FC repos — Dernières 24h\n• Variabilité FC — Dernières 24h\n• Énergie active — Hier (activer Somme)",
    },
    {
      num: 3,
      emoji: "📅",
      title: 'Ajouter "Date" puis "Formater la date"',
      detail: 'Format personnalisé : yyyy-MM-dd',
    },
    {
      num: 4,
      emoji: "🔢",
      title: 'Ajouter "Obtenir l\'élément de la liste"',
      detail: "3 fois : une pour FC, une pour HRV, une pour Calories\nChoisir le 1er élément de chaque liste",
    },
    {
      num: 5,
      emoji: "🌐",
      title: 'Ajouter "Contenu d\'URL"',
      detail: `Méthode : POST\nURL : ${backendUrl}/api/wearable/sync\nEn-têtes : Content-Type = application/json\n           x-user-id = [ton UUID ci-dessous]\nCorps JSON : date, resting_hr, hrv_rmssd, active_calories`,
    },
    {
      num: 6,
      emoji: "⏰",
      title: "Automatisation → Heure du jour → 7h00",
      detail: "Exécuter le raccourci — désactiver \"Demander avant\"",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300">
        <strong>iOS 15+ :</strong> Apple ne permet plus d'importer des raccourcis depuis des fichiers externes. Il faut le créer manuellement une seule fois — environ 5 minutes.
      </div>

      <div className="bg-surface-card rounded-2xl p-4">
        <p className="text-xs text-slate-400 mb-2">
          Ton identifiant — à coller dans l'en-tête <code className="bg-surface-muted px-1 rounded text-brand-300">x-user-id</code> à l'étape 5 :
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-surface-muted rounded-lg px-3 py-2 text-xs text-slate-300 break-all">
            {userId ?? "Chargement…"}
          </code>
          <button
            onClick={onCopy}
            className="px-3 py-2 bg-brand-500 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition hover:bg-brand-600"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {actions.map((a) => (
          <div key={a.num} className="bg-surface-card rounded-xl p-4 flex gap-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="text-lg">{a.emoji}</span>
              <span className="text-xs text-brand-400 font-bold">{a.num}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">{a.title}</p>
              {a.detail && (
                <p className="text-xs text-slate-400 whitespace-pre-line">{a.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-card rounded-2xl p-4">
        <p className="text-xs text-slate-400 mb-2 font-semibold">Corps JSON de référence (étape 5) :</p>
        <pre className="bg-surface-muted rounded-lg p-3 text-xs text-slate-300 overflow-x-auto">{`{
  "date": "[Date formatée]",
  "resting_hr": [FC valeur],
  "hrv_rmssd": [HRV valeur],
  "active_calories": [Calories valeur]
}`}</pre>
      </div>
    </div>
  );
}

// ── Onglet Historique ───────────────────────────────────────────────────────

function HistoryTab({ history }: { history: WearableData[] }) {
  if (history.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl p-8 text-center text-slate-400">
        Aucune donnée pour les 14 derniers jours.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((d) => {
        const score = d.recovery_score;
        const color =
          score == null ? "text-slate-400" :
          score >= 70   ? "text-green-400" :
          score >= 40   ? "text-yellow-400" :
                          "text-red-400";
        return (
          <div key={d.date} className="bg-surface-card rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-12 text-center">
              <p className="text-xs text-slate-500">
                {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" })}
              </p>
              <p className="text-xs font-semibold text-slate-300">
                {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </div>
            <div className="flex-1 flex gap-3 flex-wrap text-xs text-slate-400">
              {d.resting_hr != null && <span>❤️ {d.resting_hr}</span>}
              {d.hrv_rmssd != null && <span>📈 {Math.round(d.hrv_rmssd)}</span>}
              {d.sleep_duration_min != null && <span>🌙 {formatSleep(d.sleep_duration_min)}</span>}
              {d.steps != null && <span>👟 {d.steps.toLocaleString("fr")}</span>}
            </div>
            {score != null && (
              <span className={`text-lg font-extrabold ${color}`}>{score}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}
