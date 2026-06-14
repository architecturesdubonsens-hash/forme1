'use client';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { LayoutData } from '@/lib/types';

const Scene3D = dynamic(() => import('./Scene3D'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-2 text-muted text-xs">
      <Loader2 size={14} className="animate-spin" /> Chargement 3D…
    </div>
  ),
});

interface Props {
  layout: LayoutData;
  selectedEspaceId?: string;
  onSelectEspace?: (id: string, nom: string) => void;
}

export default function Viewer3D({ layout, selectedEspaceId, onSelectEspace }: Props) {
  return (
    <div className="w-full h-full">
      <Scene3D
        layout={layout}
        selectedEspaceId={selectedEspaceId}
        onSelectEspace={onSelectEspace}
      />
    </div>
  );
}
