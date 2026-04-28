"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { getCurrentProgram, generateProgram, recommendedSnacks } from "@/lib/api";
import SessionCard from "@/components/SessionCard";
import RecoveryBadge from "@/components/RecoveryBadge";
import BottomNav from "@/components/BottomNav";
import WeekSchedulePicker, { type DaySchedule } from "@/components/WeekSchedulePicker";
import SnackCard, { type SnackActivity } from "@/components/SnackCard";
import SnackPlayer from "@/components/SnackPlayer";
import { AnimatePresence } from "framer-motion";

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function Dashboard() {
  const [program, setProgram] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userName, setUserName] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [pendingWeekStart, setPendingWeekStart] = useState<Date | null>(null);
  const [snacks, setSnacks] = useState<SnackActivity[]>([]);
  const [playingSnack, setPlayingSnack] = useState<SnackActivity | null>(null);
  const router = useRouter();

  useEffect(() => {
    let currentUserId: string | null = null;

    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/onboarding"); return; }

      currentUserId = user.id;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("first_name").eq("id", user.id).maybeSingle();
      if (profile?.first_name) setUserName((profile as { first_name: string }).first_name);

      const [progResult, snackResult] = await Promise.allSettled([
        getCurrentProgram(user.id),
        recommendedSnacks(user.id),
      ]);
      setProgram(progResult.status === "fulfilled" ? progResult.value : null);
      if (snackResult.status === "fulfilled") setSnacks(snackResult.value as SnackActivity[]);
      setLoading(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && currentUserId) {
        getCurrentProgram(currentUserId).then((prog) => {
          if (prog) {
            setProgram(prog);
            setGenerating(false);
          }
        }).catch(() => {});
      }
    };

    init();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [router]);

  const getMondayOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return monday;
  };

  // Ouvre le picker de semaine avant de générer
  const openSchedulePicker = () => {
    setPendingWeekStart(getMondayOfWeek());
    setShowSchedulePicker(true);
  };

  // Appelé quand l'utilisateur confirme le planning
  const handleGenerate = async (schedule: DaySchedule[], weekContext: string) => {
    if (!userId) return;
    setShowSchedulePicker(false);
    setGenerating(true);
    try {
      const monday = getMondayOfWeek();
      const weekStart = monday.toISOString().split("T")[0];
      const weekNumber = Math.ceil(
        (monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 604800000
      );
      const result = await generateProgram(userId, weekNumber, weekStart, schedule, weekContext);
      setProgram(result);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sessions = program?.sessions ?? [];
  const today = new Date().getDay();

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">
            {userName ? `Bonjour, ${userName}` : "Bonjour"}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <RecoveryBadge userId={userId} />
      </div>

      {/* Pas de programme → CTA */}
      {!program || sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card rounded-2xl p-8 text-center"
        >
          <div className="text-5xl mb-4">🏋️</div>
          <h2 className="text-xl font-bold mb-2">Votre programme vous attend</h2>
          <p className="text-slate-400 text-sm mb-6">
            Je génère votre première semaine d'entraînement personnalisée en quelques secondes.
          </p>
          <button
            onClick={openSchedulePicker}
            disabled={generating}
            className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Génération en cours…
              </span>
            ) : (
              "Générer mon programme"
            )}
          </button>
        </motion.div>
      ) : (
        <>
          {/* Semaine */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Cette semaine
            </h2>
            <button
              onClick={openSchedulePicker}
              disabled={generating}
              className="text-xs text-brand-400 hover:text-brand-300 transition disabled:opacity-50"
            >
              {generating ? "Génération…" : "Regénérer"}
            </button>
          </div>

          {/* Note du coach */}
          {program.generation_notes && (
            <div className="bg-surface-card border border-surface-muted rounded-xl px-4 py-3 mb-5 text-sm text-slate-400">
              <span className="text-brand-400 font-medium">Coach : </span>
              {program.generation_notes}
            </div>
          )}

          {/* Séances */}
          <div className="space-y-3">
            {sessions
              .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
              .map((session: any, i: number) => (
                <motion.div
                  key={session.id ?? i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <SessionCard
                    session={session}
                    dayLabel={DAYS_FR[session.day_of_week]}
                    isToday={session.day_of_week === today}
                    userId={userId!}
                    onFeedbackSubmit={() => {
                      /* refresh après feedback */
                      getCurrentProgram(userId!).then(setProgram);
                    }}
                  />
                </motion.div>
              ))}
          </div>
        </>
      )}

      {/* Widget Snacks du moment */}
      {snacks.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              ⚡ Snacks du moment
            </h2>
            <a href="/snacks" className="text-xs text-brand-400 hover:text-brand-300 transition">
              Voir tout
            </a>
          </div>
          <div className="space-y-2">
            {snacks.slice(0, 2).map((s) => (
              <SnackCard key={s.id} snack={s} onPlay={setPlayingSnack} compact />
            ))}
          </div>
        </div>
      )}

      <BottomNav active="dashboard" />

      {showSchedulePicker && pendingWeekStart && (
        <WeekSchedulePicker
          weekStart={pendingWeekStart}
          showCheckin={!!program}
          onConfirm={handleGenerate}
          onCancel={() => setShowSchedulePicker(false)}
        />
      )}

      <AnimatePresence>
        {playingSnack && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-0 z-50"
          >
            <SnackPlayer snack={playingSnack} onClose={() => setPlayingSnack(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
