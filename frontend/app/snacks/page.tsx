"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { listSnacks, recommendedSnacks } from "@/lib/api";
import SnackCard, { type SnackActivity } from "@/components/SnackCard";
import SnackPlayer from "@/components/SnackPlayer";
import BottomNav from "@/components/BottomNav";

const DURATION_FILTERS = [
  { label: "Tous", value: null },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
];

const CONTEXT_FILTERS = [
  { label: "Tous", value: null, icon: "🌐" },
  { label: "Bureau", value: "office", icon: "💼" },
  { label: "Maison", value: "home", icon: "🏠" },
  { label: "Voyage", value: "travel", icon: "✈️" },
  { label: "Hôtel", value: "hotel", icon: "🏨" },
];

const CATEGORY_FILTERS = [
  { label: "Tous", value: null },
  { label: "Mobilité", value: "mobility" },
  { label: "Force", value: "strength" },
  { label: "Cardio", value: "cardio" },
  { label: "Posture", value: "posture" },
  { label: "Respiration", value: "breathing" },
  { label: "Étirements", value: "stretching" },
];

export default function SnacksPage() {
  const [snacks, setSnacks]           = useState<SnackActivity[]>([]);
  const [recommended, setRecommended] = useState<SnackActivity[]>([]);
  const [userId, setUserId]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [playing, setPlaying]         = useState<SnackActivity | null>(null);

  const [duration, setDuration]   = useState<number | null>(null);
  const [context, setContext]     = useState<string | null>(null);
  const [category, setCategory]   = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);

      const [all, rec] = await Promise.all([
        listSnacks(),
        recommendedSnacks(user.id),
      ]);
      setSnacks(all);
      setRecommended(rec);
      setLoading(false);
    };
    init();
  }, [router]);

  // Filtrage local
  const filtered = snacks.filter((s) => {
    if (duration && s.duration_min !== duration) return false;
    if (category && s.category !== category) return false;
    if (context) {
      const ctxs = s.contexts ?? [];
      if (!ctxs.includes(context) && !ctxs.includes("any")) return false;
    }
    return true;
  });

  // Retire les recommandés de la liste principale pour éviter les doublons
  const recIds = new Set(recommended.map((r) => r.id));
  const library = filtered.filter((s) => !recIds.has(s.id));

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <div className="min-h-screen pb-28 px-4 py-8 max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold">Snacks</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Micro-activités de 5 à 20 min — accessibles partout, à tout moment
          </p>
        </div>

        {/* Recommandés du jour */}
        {recommended.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              ⚡ Recommandés pour aujourd'hui
            </h2>
            <div className="space-y-2">
              {recommended.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <SnackCard snack={s} onPlay={setPlaying} compact />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Filtres durée */}
        <div className="mb-3 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {DURATION_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setDuration(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  duration === f.value
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "border-surface-muted text-slate-400 hover:border-slate-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtres contexte */}
        <div className="mb-3 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {CONTEXT_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setContext(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  context === f.value
                    ? "bg-surface-card border-brand-500 text-brand-400"
                    : "border-surface-muted text-slate-400 hover:border-slate-500"
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtres catégorie */}
        <div className="mb-5 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setCategory(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  category === f.value
                    ? "bg-surface-card border-purple-500 text-purple-400"
                    : "border-surface-muted text-slate-400 hover:border-slate-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bibliothèque */}
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Bibliothèque {library.length > 0 && `— ${library.length} activités`}
        </h2>

        {library.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm">Aucune activité pour ces filtres.</p>
            <button onClick={() => { setDuration(null); setContext(null); setCategory(null); }}
              className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition">
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {library.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <SnackCard snack={s} onPlay={setPlaying} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="snacks" />

      {/* Player */}
      <AnimatePresence>
        {playing && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-0 z-50"
          >
            <SnackPlayer snack={playing} onClose={() => setPlaying(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
