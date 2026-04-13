"use client";
import Link from "next/link";

type Tab = "dashboard" | "snacks" | "challenges" | "program" | "profile";

const TABS: { key: Tab; href: string; icon: string; label: string }[] = [
  { key: "dashboard",  href: "/dashboard",  icon: "🏠", label: "Semaine" },
  { key: "snacks",     href: "/snacks",     icon: "⚡", label: "Snacks" },
  { key: "challenges", href: "/challenges", icon: "🎯", label: "Défis" },
  { key: "program",    href: "/program",    icon: "📊", label: "Progression" },
  { key: "profile",    href: "/profile",    icon: "👤", label: "Profil" },
];

export default function BottomNav({ active }: { active: Tab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-t border-surface-muted">
      <div className="flex max-w-lg mx-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition ${
              active === tab.key ? "text-brand-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
            {active === tab.key && (
              <span className="absolute bottom-1 w-1 h-1 bg-brand-400 rounded-full" />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
