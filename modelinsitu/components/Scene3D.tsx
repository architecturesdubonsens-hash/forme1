'use client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { LayoutData, LayoutRect } from '@/lib/types';

const FLOOR_H    = 2.7;   // hauteur libre standard (m)
const FLOOR_GAP  = 0.3;   // épaisseur dalle entre niveaux

const NIVEAU_Y: Record<string, number> = {
  sous_sol: -(FLOOR_H + FLOOR_GAP),
  rdc:      0,
  etage:    FLOOR_H + FLOOR_GAP,
};

const TYPE_COLOR: Record<string, string> = {
  sejour:          '#2563eb',
  cuisine:         '#d97706',
  salle_a_manger:  '#65a30d',
  chambre:         '#7c3aed',
  salle_de_bain:   '#0891b2',
  wc:              '#4f46e5',
  bureau:          '#1d4ed8',
  dressing:        '#9333ea',
  hall:            '#64748b',
  entree:          '#64748b',
  couloir:         '#475569',
  garage:          '#374151',
  cave:            '#1f2937',
  local_technique: '#111827',
  terrasse:        '#16a34a',
  balcon:          '#22c55e',
  loggia:          '#15803d',
  jardin:          '#14532d',
  autre:           '#6b7280',
};

// ── Espace box ────────────────────────────────────────────────────────────────
interface BoxProps {
  rect: LayoutRect;
  niveauY: number;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string, nom: string) => void;
}

function EspaceBox({ rect, niveauY, selected, hovered, onHover, onClick }: BoxProps) {
  const baseColor = TYPE_COLOR[rect.type] ?? '#6b7280';

  const color = selected
    ? '#60a5fa'
    : hovered
    ? new THREE.Color(baseColor).lerp(new THREE.Color('#fff'), 0.25).getStyle()
    : baseColor;

  return (
    <group>
      <mesh
        position={[rect.x + rect.w / 2, niveauY + FLOOR_H / 2, rect.y + rect.h / 2]}
        onPointerEnter={e => { e.stopPropagation(); onHover(rect.id); }}
        onPointerLeave={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(rect.id, rect.nom); }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[rect.w, FLOOR_H, rect.h]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={selected ? 0.95 : hovered ? 0.9 : 0.78}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {/* Wireframe overlay on selection */}
      {selected && (
        <lineSegments
          position={[rect.x + rect.w / 2, niveauY + FLOOR_H / 2, rect.y + rect.h / 2]}
        >
          <edgesGeometry args={[new THREE.BoxGeometry(rect.w, FLOOR_H, rect.h)]} />
          <lineBasicMaterial color="#93c5fd" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

// ── Dalle de niveau ───────────────────────────────────────────────────────────
function LevelSlab({ rects, niveauY }: { rects: LayoutRect[]; niveauY: number }) {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map(r => r.x));
  const minZ = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.w));
  const maxZ = Math.max(...rects.map(r => r.y + r.h));
  const w = maxX - minX;
  const d = maxZ - minZ;
  return (
    <mesh
      position={[minX + w / 2, niveauY - FLOOR_GAP / 2, minZ + d / 2]}
      receiveShadow
    >
      <boxGeometry args={[w + 1, FLOOR_GAP, d + 1]} />
      <meshStandardMaterial color="#1e293b" roughness={0.8} />
    </mesh>
  );
}

// ── Camera auto-fit ────────────────────────────────────────────────────────────
function CameraRig({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const dist = radius * 2.5 + 5;
    camera.position.set(center.x + dist, dist * 0.8, center.z + dist);
    camera.lookAt(center);
  }, [center, radius]);
  return null;
}

// ── Scène principale ──────────────────────────────────────────────────────────
interface SceneProps {
  layout: LayoutData;
  selectedEspaceId?: string;
  onSelectEspace?: (id: string, nom: string) => void;
}

function SceneContent({ layout, selectedEspaceId, onSelectEspace }: SceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { allRects, center, radius } = useMemo(() => {
    const rects: Array<{ rect: LayoutRect; niveau: string; niveauY: number }> = [];
    for (const [niveau, rs] of Object.entries(layout.rectangles)) {
      const y = NIVEAU_Y[niveau] ?? 0;
      for (const r of rs) rects.push({ rect: r, niveau, niveauY: y });
    }

    const xs = rects.flatMap(({ rect }) => [rect.x, rect.x + rect.w]);
    const zs = rects.flatMap(({ rect }) => [rect.y, rect.y + rect.h]);
    const cx  = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cz  = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    const rad = Math.max(
      xs.length ? (Math.max(...xs) - Math.min(...xs)) : 10,
      zs.length ? (Math.max(...zs) - Math.min(...zs)) : 10
    ) / 2;

    return { allRects: rects, center: new THREE.Vector3(cx, 0, cz), radius: rad };
  }, [layout]);

  const niveauxOrder = ['sous_sol', 'rdc', 'etage'];

  return (
    <>
      <CameraRig center={center} radius={radius} />
      <OrbitControls target={center.toArray()} enableDamping dampingFactor={0.08} />

      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[center.x + 20, 30, center.z + 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[center.x - 15, 10, center.z - 10]} intensity={0.4} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.05, center.z]} receiveShadow>
        <planeGeometry args={[radius * 6 + 20, radius * 6 + 20]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      {/* Grid */}
      <gridHelper
        args={[radius * 6 + 20, Math.round(radius * 6 + 20), '#1a1a1a', '#1a1a1a']}
        position={[center.x, 0, center.z]}
      />

      {/* Dalles de niveau */}
      {niveauxOrder.map(niveau => {
        const rects = allRects.filter(r => r.niveau === niveau).map(r => r.rect);
        if (!rects.length) return null;
        return <LevelSlab key={niveau} rects={rects} niveauY={NIVEAU_Y[niveau] ?? 0} />;
      })}

      {/* Espaces */}
      {allRects.map(({ rect, niveauY }) => (
        <EspaceBox
          key={rect.id}
          rect={rect}
          niveauY={niveauY}
          selected={rect.id === selectedEspaceId}
          hovered={rect.id === hoveredId}
          onHover={setHoveredId}
          onClick={onSelectEspace ?? (() => {})}
        />
      ))}

      {/* Fog subtle */}
      <fog attach="fog" args={['#0a0a0a', radius * 8, radius * 20]} />
    </>
  );
}

export default function Scene3D({ layout, selectedEspaceId, onSelectEspace }: SceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0a0a' }}
      className="w-full h-full"
    >
      <SceneContent
        layout={layout}
        selectedEspaceId={selectedEspaceId}
        onSelectEspace={onSelectEspace}
      />
    </Canvas>
  );
}
