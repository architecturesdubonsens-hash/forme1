'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Library, Plus, FolderOpen, Settings } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/sessions', icon: FolderOpen, label: 'Sessions' },
  { href: '/sessions/new', icon: Plus, label: 'Nouvelle' },
  { href: '/library', icon: Library, label: 'Bibliothèque' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 h-full w-16 md:w-56 bg-surface border-r border-border flex flex-col z-40">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">CI</span>
          </div>
          <span className="hidden md:block text-sm font-semibold text-white truncate">CapInSitu</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="hidden md:block text-sm font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <Link href="/settings" className="flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors">
          <Settings size={18} className="flex-shrink-0" />
          <span className="hidden md:block text-sm">Paramètres</span>
        </Link>
      </div>
    </aside>
  );
}
