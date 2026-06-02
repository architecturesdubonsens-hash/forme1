import { useEffect, useState } from "react";

export type WatchSource = "apple_watch" | "garmin" | "coros" | "none";

const KEY = "forme1_watch_source";

export function useWatchSource() {
  const [source, setSourceState] = useState<WatchSource>("apple_watch");

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as WatchSource | null;
    if (saved) setSourceState(saved);
  }, []);

  const setSource = (s: WatchSource) => {
    localStorage.setItem(KEY, s);
    setSourceState(s);
  };

  return [source, setSource] as const;
}

export const WATCH_OPTIONS: { key: WatchSource; label: string; icon: string; desc: string }[] = [
  { key: "apple_watch", label: "Apple Watch", icon: "⌚", desc: "Sync via Raccourci iOS" },
  { key: "garmin",      label: "Garmin",      icon: "🟠", desc: "Via Apple Santé ou Garmin Connect" },
  { key: "coros",       label: "Coros",       icon: "🔵", desc: "Via Apple Santé" },
  { key: "none",        label: "Sans montre", icon: "✏️", desc: "Saisie manuelle uniquement" },
];
