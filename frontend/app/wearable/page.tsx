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
  const [manualOpen, setManualOpen] = useState(false);
  const router = useRouter();

  // Formulaire sync manuelle
  const [form, setForm] = useState({
    resting_hr: "",
    hrv_rmssd: "",
    sleep_duration_min: "",
    sleep_quality: "",
    active_calories: "",
    steps: "",
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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

  const handleManualSync = async () => {
    if (!userId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const payload: Record<string, unknown> = {
        date: new Date().toISOString().split("T")[0],
      };
      if (form.resting_hr)       payload.resting_hr = parseInt(form.resting_hr);
      if (form.hrv_rmssd)        payload.hrv_rmssd = parseFloat(form.hrv_rmssd);
      if (form.sleep_duration_min) payload.sleep_duration_min = parseInt(form.sleep_duration_min);
      if (form.sleep_quality)    payload.sleep_quality = parseInt(form.sleep_quality);
      if (form.active_calories)  payload.active_calories = parseInt(form.active_calories);
      if (form.steps)            payload.steps = parseInt(form.steps);

      const result = await syncWearable(userId, payload) as WearableData;
      setToday(result);
      const h = await getWearableHistory(userId, 14).catch(() => []);
      setHistory(h as WearableData[]);
      setSyncMsg(`Score de récupération : ${result.recovery_score ?? "—"}`);
      setManualOpen(false);
      setActiveTab("status");
    } catch (e: unknown) {
      setSyncMsg("Erreur lors de la synchronisation.");
    } finally {
      setSyncing(false);
    }
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
              activeTab === t
                ? "bg-brand-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "status" ? "Aujourd'hui" : t === "setup" ? "Installation" : "Historique"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "status" && (
          <motion.div key="status" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <StatusTab today={today} syncMsg={syncMsg} onManualSync={() => { setManualOpen(true); setSyncMsg(null); }} />
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

      {/* Modal sync manuelle */}
      <AnimatePresence>
        {manualOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setManualOpen(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="bg-surface w-full max-w-lg rounded-t-3xl p-6 space-y-4"
            >
              <h2 className="text-lg font-bold">Saisie manuelle</h2>
              <p className="text-xs text-slate-400">Sans Apple Watch, vous pouvez saisir vos données manuellement.</p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "resting_hr",        label: "FC repos (bpm)",   placeholder: "ex : 58" },
                  { key: "hrv_rmssd",         label: "HRV RMSSD (ms)",   placeholder: "ex : 45" },
                  { key: "sleep_duration_min",label: "Sommeil (minutes)", placeholder: "ex : 450" },
                  { key: "sleep_quality",     label: "Qualité sommeil (1–5)", placeholder: "ex : 4" },
                  { key: "active_calories",   label: "Cal. actives",     placeholder: "ex : 420" },
                  { key: "steps",             label: "Pas",               placeholder: "ex : 8500" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                    <input
                      type="number"
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-surface-card border border-surface-muted rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Calcul en cours…
                  </>
                ) : "Calculer mon score"}
              </button>
              <button onClick={() => setManualOpen(false)} className="w-full py-2 text-slate-400 text-sm">
                Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav active="profile" />
    </div>
  );
}

// ── Onglet Statut ───────────────────────────────────────────────────────────

function StatusTab({
  today,
  syncMsg,
  onManualSync,
}: {
  today: WearableData | null;
  syncMsg: string | null;
  onManualSync: () => void;
}) {
  if (!today) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-card rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">⌚</div>
          <h2 className="text-lg font-bold mb-1">Pas encore de données aujourd'hui</h2>
          <p className="text-sm text-slate-400 mb-5">
            Le Raccourci iOS n'a pas encore synchronisé vos données Apple Watch.
            Vérifiez qu'il s'exécute bien à 7h00.
          </p>
          <button
            onClick={() => {}}
            className="w-full mb-3 py-3 bg-brand-500 rounded-xl font-semibold text-white"
            disabled
          >
            En attente de sync automatique
          </button>
          <button
            onClick={onManualSync}
            className="w-full py-3 border border-surface-muted rounded-xl text-slate-300 text-sm hover:bg-surface-card transition"
          >
            Saisie manuelle (sans Apple Watch)
          </button>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
          <strong>Conseil :</strong> Portez votre Apple Watch au moins 2 nuits pour obtenir des données HRV fiables.
        </div>
      </div>
    );
  }

  const score = today.recovery_score;
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
    score == null ? "Données incomplètes" :
    score >= 70   ? "Bonne récupération" :
    score >= 40   ? "Récupération normale" :
                    "Récupération faible";
  const scoreAdvice =
    score == null ? "Ajoutez HRV ou FC repos pour affiner le score." :
    score >= 70   ? "Vous pouvez viser une séance d'intensité élevée aujourd'hui." :
    score >= 40   ? "Programme standard recommandé." :
                    "Privilégiez une séance légère ou du repos actif.";

  return (
    <div className="space-y-4">
      {syncMsg && (
        <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-3 text-sm text-brand-300">
          {syncMsg}
        </div>
      )}

      {/* Score principal */}
      <div className={`rounded-2xl border p-5 ${scoreBg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-400">Score de récupération</span>
          <span className="text-xs text-slate-500">
            {new Date(today.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        {score != null ? (
          <div className="flex items-end gap-3 mb-2">
            <span className={`text-5xl font-extrabold ${scoreColor}`}>{score}</span>
            <span className={`text-sm font-medium mb-1 ${scoreColor}`}>{scoreLabel}</span>
          </div>
        ) : (
          <p className={`text-lg font-bold ${scoreColor} mb-2`}>{scoreLabel}</p>
        )}
        <p className="text-xs text-slate-400">{scoreAdvice}</p>
      </div>

      {/* Détail des métriques */}
      <div className="bg-surface-card rounded-2xl p-4 grid grid-cols-2 gap-3">
        <Metric icon="❤️" label="FC repos" value={today.resting_hr != null ? `${today.resting_hr} bpm` : "—"} optimal="< 60 bpm" />
        <Metric icon="📈" label="HRV (RMSSD)" value={today.hrv_rmssd != null ? `${Math.round(today.hrv_rmssd)} ms` : "—"} optimal="> 50 ms" />
        <Metric icon="🌙" label="Sommeil" value={today.sleep_duration_min != null ? formatSleep(today.sleep_duration_min) : "—"} optimal="7h–9h" />
        <Metric icon="⭐" label="Qualité sommeil" value={today.sleep_quality != null ? `${today.sleep_quality}/5` : "—"} optimal="4–5/5" />
        <Metric icon="🔥" label="Cal. actives" value={today.active_calories != null ? `${today.active_calories} kcal` : "—"} optimal="" />
        <Metric icon="👟" label="Pas" value={today.steps != null ? today.steps.toLocaleString("fr") : "—"} optimal="> 8 000" />
      </div>

      <button
        onClick={onManualSync}
        className="w-full py-3 border border-surface-muted rounded-xl text-slate-300 text-sm hover:bg-surface-card transition"
      >
        Mettre à jour manuellement
      </button>
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

      {/* Note iOS 15+ */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300">
        <strong>iOS 15+ :</strong> Apple ne permet plus d'importer des raccourcis depuis des fichiers externes. Il faut le créer manuellement une seule fois — ça prend environ 5 minutes.
      </div>

      {/* UUID à copier */}
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

      {/* Étapes */}
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

      {/* Corps JSON de référence */}
      <div className="bg-surface-card rounded-2xl p-4">
        <p className="text-xs text-slate-400 mb-2 font-semibold">Corps JSON de référence (étape 5) :</p>
        <pre className="bg-surface-muted rounded-lg p-3 text-xs text-slate-300 overflow-x-auto">{`{
  "date": "[Date formatée]",
  "resting_hr": [FC valeur],
  "hrv_rmssd": [HRV valeur],
  "active_calories": [Calories valeur]
}`}</pre>
      </div>

      {/* Données collectées */}
      <div className="bg-surface-card rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ce que ça collecte</h2>
        <div className="space-y-2">
          {[
            ["❤️", "FC repos",        "30% du score récup."],
            ["📈", "HRV (RMSSD)",     "50% du score récup."],
            ["🔥", "Calories actives","Calibrage séance"],
            ["🌙", "Sommeil",         "Saisie manuelle (20%)"],
          ].map(([icon, name, use]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span>{icon}</span>
              <span className="flex-1 text-slate-300">{name}</span>
              <span className="text-brand-400">{use}</span>
            </div>
          ))}
        </div>
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
            <div className="w-10 text-center">
              <p className="text-xs text-slate-500">
                {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" })}
              </p>
              <p className="text-xs font-semibold text-slate-300">
                {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </div>
            <div className="flex-1 flex gap-2 flex-wrap text-xs text-slate-400">
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function Metric({ icon, label, value, optimal }: { icon: string; label: string; value: string; optimal: string }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
      {optimal && <p className="text-[10px] text-slate-500 mt-0.5">Optimal : {optimal}</p>}
    </div>
  );
}

function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}
