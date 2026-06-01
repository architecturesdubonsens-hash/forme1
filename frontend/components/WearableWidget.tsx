"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getWearableToday, getWearableHistory, type WearableData } from "@/lib/api";

type Props = { userId: string };

export default function WearableWidget({ userId }: Props) {
  const [today, setToday] = useState<WearableData | null | undefined>(undefined);
  const [history, setHistory] = useState<WearableData[]>([]);

  useEffect(() => {
    Promise.all([
      getWearableToday(userId).catch(() => null),
      getWearableHistory(userId, 7).catch(() => []),
    ]).then(([t, h]) => {
      setToday(t);
      setHistory(h as WearableData[]);
    });
  }, [userId]);

  // Chargement
  if (today === undefined) {
    return (
      <div className="bg-surface-card rounded-2xl p-4 animate-pulse h-24" />
    );
  }

  // Pas encore de données : invite à connecter
  if (!today) {
    return (
      <Link
        href="/wearable"
        className="flex items-center gap-4 bg-surface-card border border-surface-muted rounded-2xl p-4 hover:border-brand-500/40 transition group"
      >
        <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center text-xl shrink-0">
          ⌚
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Connecter Apple Watch</p>
          <p className="text-xs text-slate-400 mt-0.5">Sync quotidienne via Raccourci iOS</p>
        </div>
        <span className="text-slate-500 group-hover:text-brand-400 transition text-sm">→</span>
      </Link>
    );
  }

  const score = today.recovery_score;
  const scoreColor =
    score == null ? "text-slate-400" :
    score >= 70   ? "text-green-400" :
    score >= 40   ? "text-yellow-400" :
                    "text-red-400";

  const scoreLabel =
    score == null ? "Données incomplètes" :
    score >= 70   ? "Bonne récupération" :
    score >= 40   ? "Récupération normale" :
                    "Récupération faible";

  const scoreBg =
    score == null ? "bg-slate-500/10 border-slate-500/20" :
    score >= 70   ? "bg-green-500/10 border-green-500/20" :
    score >= 40   ? "bg-yellow-500/10 border-yellow-500/20" :
                    "bg-red-500/10 border-red-500/20";

  return (
    <Link href="/wearable" className="block">
      <div className={`rounded-2xl border p-4 transition hover:brightness-110 ${scoreBg}`}>
        {/* Ligne principale */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">⌚</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              {score != null && (
                <span className={`text-2xl font-extrabold ${scoreColor}`}>{score}</span>
              )}
              <span className={`text-sm font-medium ${scoreColor}`}>{scoreLabel}</span>
            </div>
          </div>
          <span className="text-slate-500 text-xs">→</span>
        </div>

        {/* Métriques */}
        <div className="flex gap-3 text-xs text-slate-400">
          {today.resting_hr != null && (
            <MetricPill icon="❤️" value={`${today.resting_hr} bpm`} />
          )}
          {today.hrv_rmssd != null && (
            <MetricPill icon="📈" value={`HRV ${Math.round(today.hrv_rmssd)} ms`} />
          )}
          {today.sleep_duration_min != null && (
            <MetricPill icon="🌙" value={formatSleep(today.sleep_duration_min)} />
          )}
          {today.steps != null && (
            <MetricPill icon="👟" value={`${today.steps.toLocaleString("fr")} pas`} />
          )}
        </div>

        {/* Mini barchart 7 jours */}
        {history.length > 1 && (
          <MiniChart data={history} />
        )}
      </div>
    </Link>
  );
}

function MetricPill({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span>{icon}</span>
      <span>{value}</span>
    </span>
  );
}

function MiniChart({ data }: { data: WearableData[] }) {
  // Du plus ancien au plus récent
  const sorted = [...data].reverse();
  const maxScore = 100;

  return (
    <div className="flex items-end gap-1 mt-3 h-8">
      {sorted.map((d, i) => {
        const s = d.recovery_score ?? 0;
        const pct = Math.max(4, (s / maxScore) * 100);
        const color =
          s >= 70 ? "bg-green-500/60" :
          s >= 40 ? "bg-yellow-500/60" :
                    "bg-red-500/60";
        const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "narrow" });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full rounded-sm ${color}`}
              style={{ height: `${pct}%` }}
            />
            <span className="text-[9px] text-slate-600">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}
