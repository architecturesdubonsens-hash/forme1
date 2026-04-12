"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import RadarChart from "@/components/RadarChart";
import PhaseTimeline from "@/components/PhaseTimeline";
import BottomNav from "@/components/BottomNav";

type Metrics = {
  score_vo2max: number; score_muscle: number;
  score_fat_loss: number; score_mobility: number;
  score_overall: number; week_number: number;
  sessions_done: number;
};

const OBJECTIVE_META = [
  { key: "score_fat_loss", label: "Graisse viscérale",   color: "bg-orange-500", target: "Réduire la graisse abdominale" },
  { key: "score_muscle",   label: "Masse musculaire",     color: "bg-blue-500",   target: "Gagner en force et volume" },
  { key: "score_mobility", label: "Mobilité",             color: "bg-purple-500", target: "Amplitude et fluidité" },
  { key: "score_vo2max",   label: "VO2max / Endurance",   color: "bg-brand-500",  target: "Capacité cardio-respiratoire" },
];

export default function ProgramPage() {
  const [metrics, setMetrics]       = useState<Metrics | null>(null);
  const [history, setHistory]       = useState<Metrics[]>([]);
  const [plan, setPlan]             = useState<any>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);

      // Dernières métriques
      const { data: mData } = await supabase
        .from("progress_metrics")
        .select("*")
        .eq("user_id", user.id)
        .order("week_number", { ascending: false })
        .limit(8);

      if (mData && mData.length > 0) {
        setMetrics(mData[0]);
        setHistory(mData.reverse());
      } else {
        // Pas encore de métriques : valeurs initiales à 0
        setMetrics({ score_vo2max: 0, score_muscle: 0, score_fat_loss: 0, score_mobility: 0, score_overall: 0, week_number: 1, sessions_done: 0 });
      }

      // Plan actif
      const { data: planData } = await supabase
        .from("weekly_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      setPlan(planData);

      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentWeek  = plan?.week_number ?? metrics?.week_number ?? 1;
  const currentPhase = plan?.phase ?? "base";
  const scores       = metrics ?? { score_vo2max: 0, score_muscle: 0, score_fat_loss: 0, score_mobility: 0 };

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-extrabold mb-1">Votre progression</h1>
      <p className="text-slate-400 text-sm mb-6">Semaine {currentWeek} du programme</p>

      {/* Radar multicritère */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-card rounded-2xl p-6 flex flex-col items-center mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Profil de performance
        </h2>
        <RadarChart scores={scores as Record<string, number>} size={220} />
        <p className="text-xs text-slate-500 mt-3 text-center">
          Score global : <span className="text-white font-bold text-base">{metrics?.score_overall ?? 0}</span>/100
        </p>
      </motion.div>

      {/* Barres de progression par objectif */}
      <div className="bg-surface-card rounded-2xl p-5 mb-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Détail par objectif</h2>
        {OBJECTIVE_META.map((obj, i) => {
          const val = (scores as any)[obj.key] ?? 0;
          return (
            <motion.div key={obj.key}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}>
              <div className="flex justify-between items-center mb-1.5">
                <div>
                  <span className="text-sm font-medium text-white">{obj.label}</span>
                  <span className="text-xs text-slate-500 ml-2">{obj.target}</span>
                </div>
                <span className="text-sm font-bold text-white">{val}%</span>
              </div>
              <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${obj.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Phase timeline */}
      <div className="bg-surface-card rounded-2xl p-5 mb-4">
        <PhaseTimeline currentPhase={currentPhase} currentWeek={currentWeek} />
      </div>

      {/* Explication stratégique */}
      <div className="bg-surface-card rounded-2xl p-5 mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Stratégie du programme</h2>
        <StrategyExplain phase={currentPhase} week={currentWeek} />
      </div>

      {/* Historique graphique simplifié */}
      {history.length > 1 && (
        <div className="bg-surface-card rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Évolution semaine par semaine</h2>
          <WeeklyChart history={history} />
        </div>
      )}

      {/* Stats clés */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Séances réalisées" value={metrics?.sessions_done ?? 0} unit="au total" />
        <StatCard label="Semaine en cours" value={currentWeek} unit="du cycle" />
      </div>

      <BottomNav active="program" />
    </div>
  );
}

function StrategyExplain({ phase, week }: { phase: string; week: number }) {
  const content: Record<string, { title: string; body: string; objective: string }> = {
    base: {
      title: "Construire les fondations",
      body: "Ces premières semaines visent à établir des bases solides : technique d'exécution, conditionnement articulaire, habitude d'entraînement. Le volume est modéré pour permettre une adaptation progressive sans surcharger le système musculo-squelettique.",
      objective: "Objectif : exécuter chaque mouvement proprement, établir le rythme hebdomadaire.",
    },
    build: {
      title: "Monter en charge",
      body: "Le volume et l'intensité augmentent progressivement (+10% max/semaine). C'est la phase de stimulation principale : c'est ici que se construisent force, endurance et composition corporelle. Les séances HIIT s'intensifient pour booster le VO2max.",
      objective: "Objectif : progresser sur les charges, améliorer les temps sur les efforts cardio.",
    },
    peak: {
      title: "Performance maximale",
      body: "Volume réduit, intensité maximale. L'objectif est de tirer le meilleur de l'adaptation construite en phase Build. Les séances sont courtes mais denses. Récupération renforcée entre les efforts.",
      objective: "Objectif : battre vos records de la phase Base, sentir la forme.",
    },
    deload: {
      title: "Récupération active",
      body: "Semaine stratégique : -50% de volume. Les muscles et le système nerveux se reconstruisent. Ne pas sauter cette semaine — la supercompensation se produit pendant le repos, pas pendant l'effort.",
      objective: "Objectif : récupérer complètement pour repartir plus fort.",
    },
  };

  const c = content[phase] ?? content.base;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-white">{c.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{c.body}</p>
      <p className="text-sm text-brand-400 font-medium">{c.objective}</p>
    </div>
  );
}

function WeeklyChart({ history }: { history: Metrics[] }) {
  const maxVal = 100;
  const h = 60;

  return (
    <div className="flex items-end gap-1.5">
      {history.map((m, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col gap-0.5" style={{ height: h }}>
            {[
              { val: m.score_vo2max, color: "bg-brand-500" },
              { val: m.score_muscle, color: "bg-blue-500" },
              { val: m.score_fat_loss, color: "bg-orange-500" },
              { val: m.score_mobility, color: "bg-purple-500" },
            ].map((s, j) => (
              <div key={j} className={`${s.color} rounded-sm opacity-70`}
                style={{ height: `${(s.val / maxVal) * (h / 4)}px`, minHeight: 2 }} />
            ))}
          </div>
          <span className="text-xs text-slate-500">S{m.week_number}</span>
        </div>
      ))}
      <div className="ml-2 flex flex-col justify-between text-xs text-slate-600" style={{ height: h }}>
        <span>100</span><span>0</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-surface-card rounded-xl p-4 text-center">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{unit}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
