"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { request } from "@/lib/api";
import ChallengeCard from "@/components/ChallengeCard";
import BottomNav from "@/components/BottomNav";

const TYPE_ICONS: Record<string, string> = {
  trail:"🏔️", exercise_mastery:"💪", metric:"📈", endurance:"🚴", multi_domain:"⚡",
};
const TYPE_LABELS: Record<string, string> = {
  trail:"Trail / Randonnée", exercise_mastery:"Maîtrise technique", metric:"Métrique cible", endurance:"Endurance", multi_domain:"Multi-domaines",
};

export default function ChallengesPage() {
  const [challenges, setChallenges]   = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [userId, setUserId]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [suggesting, setSuggesting]   = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [customHint, setCustomHint]   = useState("");
  const [customType, setCustomType]   = useState("trail");
  const [customWeeks, setCustomWeeks] = useState(8);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);
      const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges`, {
        headers: { "x-user-id": user.id },
      }).then((r) => r.json());
      setChallenges(data);
      setLoading(false);
    };
    init();
  }, [router]);

  const loadSuggestions = async () => {
    if (!userId) return;
    setSuggesting(true);
    const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges/suggest`, {
      method: "POST",
      headers: { "x-user-id": userId },
    }).then((r) => r.json());
    setSuggestions(data);
    setSuggesting(false);
  };

  const acceptSuggestion = async (ch: any) => {
    if (!userId) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(ch),
    });
    setSuggestions((s) => s.filter((s2) => s2.title !== ch.title));
    const refreshed = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges`, { headers: { "x-user-id": userId } }).then((r) => r.json());
    setChallenges(refreshed);
  };

  const createCustom = async () => {
    if (!userId || !customHint) return;
    setGeneratingCustom(true);
    const ch = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges/custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ challenge_type: customType, hint: customHint, duration_weeks: customWeeks }),
    }).then((r) => r.json());
    setSuggestions([ch]);
    setShowCreate(false);
    setGeneratingCustom(false);
    setCustomHint("");
  };

  const toggleMilestone = async (challengeId: string, week: number, done: boolean) => {
    if (!userId) return;
    const updated = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges/${challengeId}/milestone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ week, done }),
    }).then((r) => r.json());
    setChallenges((prev) => prev.map((c) => c.id === challengeId ? { ...c, milestones: updated.milestones } : c));
  };

  const completeChallenge = async (challengeId: string) => {
    if (!userId) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges/${challengeId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ status: "completed" }),
    });
    setChallenges((prev) => prev.map((c) => c.id === challengeId ? { ...c, status: "completed" } : c));
  };

  const active    = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status === "completed");

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Défis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Objectifs concrets sur plusieurs semaines</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)}
          className="px-3 py-2 bg-brand-500 rounded-xl text-sm font-semibold text-white hover:bg-brand-600 transition">
          + Créer
        </button>
      </div>

      {/* Formulaire défi custom */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-surface-card rounded-2xl p-5 mb-5 space-y-4">
            <h3 className="font-bold text-white">Défi personnalisé</h3>
            <div>
              <label className="text-sm text-slate-300 block mb-1">Type de défi</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setCustomType(k)}
                    className={`px-3 py-2 rounded-xl text-xs text-left transition border ${
                      customType === k ? "border-brand-500 bg-brand-500/10 text-white" : "border-surface-muted text-slate-400 hover:border-slate-500"
                    }`}>
                    {TYPE_ICONS[k]} {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">Votre idée</label>
              <textarea value={customHint} onChange={(e) => setCustomHint(e.target.value)}
                placeholder="Ex: Courir un trail de 15km avec 700m de dénivelé positif"
                rows={2} className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">Durée : <span className="text-brand-400 font-bold">{customWeeks} semaines</span></label>
              <input type="range" min={4} max={16} step={2} value={customWeeks} onChange={(e) => setCustomWeeks(+e.target.value)}
                className="w-full accent-brand-500" />
            </div>
            <button onClick={createCustom} disabled={!customHint || generatingCustom}
              className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
              {generatingCustom ? "Génération IA en cours…" : "Générer ce défi"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions IA */}
      {suggestions.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Suggestions pour vous</div>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-surface-card border border-brand-500/30 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">{s.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.target_description}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.duration_weeks} semaines · {s.generation_notes}</div>
                  </div>
                </div>
                <button onClick={() => acceptSuggestion(s)}
                  className="w-full mt-3 py-2 bg-brand-500 rounded-xl text-sm font-semibold text-white hover:bg-brand-600 transition">
                  Accepter ce défi
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Défis actifs */}
      {active.length > 0 ? (
        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">En cours</div>
          {active.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <ChallengeCard challenge={c} onToggleMilestone={toggleMilestone} onComplete={completeChallenge} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-lg font-bold mb-2">Aucun défi en cours</h2>
          <p className="text-slate-400 text-sm mb-5">Les défis vous donnent un objectif concret vers lequel progresser sur plusieurs semaines.</p>
          <button onClick={loadSuggestions} disabled={suggesting}
            className="px-6 py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
            {suggesting ? "Génération…" : "Voir des suggestions IA"}
          </button>
        </div>
      )}

      {/* Bouton suggestions si des défis actifs existent déjà */}
      {active.length > 0 && (
        <button onClick={loadSuggestions} disabled={suggesting}
          className="w-full py-2.5 border border-surface-muted rounded-xl text-sm text-slate-400 hover:border-slate-500 transition disabled:opacity-50 mb-4">
          {suggesting ? "Génération…" : "💡 Nouvelles suggestions IA"}
        </button>
      )}

      {/* Défis accomplis */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accomplis 🏆</div>
          {completed.map((c) => (
            <ChallengeCard key={c.id} challenge={c} onToggleMilestone={toggleMilestone} onComplete={completeChallenge} />
          ))}
        </div>
      )}

      <BottomNav active="challenges" />
    </div>
  );
}
