"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Props = { userId: string | null };

export default function RecoveryBadge({ userId }: Props) {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("wearable_data")
      .select("recovery_score")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.recovery_score != null) setScore(data.recovery_score);
      });
  }, [userId]);

  if (score === null) return null;

  const color =
    score >= 70 ? "text-green-400 bg-green-500/10 border-green-500/30" :
    score >= 40 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                  "text-red-400 bg-red-500/10 border-red-500/30";

  const label =
    score >= 70 ? "Bonne récupération" :
    score >= 40 ? "Récupération normale" :
                  "Récupération faible";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${color}`}>
      <span className="font-bold">{score}</span>
      <span>{label}</span>
    </div>
  );
}
