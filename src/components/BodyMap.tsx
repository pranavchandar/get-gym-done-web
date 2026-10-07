import { useEffect, useState } from 'react';
import type { MuscleLevels } from '../domain/muscles';
import type { BodyFigure } from '../types';

// Anatomical front/back body diagram, shaded per muscle by level 0–4. Geometry comes
// from MuscleMap by Melih Colpan (MIT) — see THIRD_PARTY_NOTICES.md. ~90 KB, so it is
// loaded on first use rather than shipped in the main bundle.

interface View {
  vb: string;
  p: Record<string, string[]>;
}
type BodyPaths = Record<BodyFigure, Record<'front' | 'back', View>>;

let cache: BodyPaths | null = null;
let pending: Promise<BodyPaths> | null = null;

function loadPaths(): Promise<BodyPaths> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('../data/body_paths.json').then((m) => {
      cache = (m.default ?? m) as unknown as BodyPaths;
      return cache;
    });
  }
  return pending;
}

// Not muscles: drawn as the silhouette, never shaded.
const INERT = new Set(['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']);
const OPACITY = [0, 0.28, 0.5, 0.75, 1];

function Figure({ view, levels, height }: { view: View; levels: MuscleLevels; height: number }) {
  const [, , w, h] = view.vb.split(' ').map(Number);
  return (
    <svg height={height} width={(height * w) / h} viewBox={view.vb} aria-hidden="true">
      {Object.entries(view.p).map(([slug, paths]) => {
        const lv = INERT.has(slug) ? 0 : levels[slug as keyof MuscleLevels] ?? 0;
        return (
          <g key={slug}>
            {paths.map((d, i) => (
              <g key={i}>
                <path d={d} fill={INERT.has(slug) ? 'var(--surface2)' : 'var(--surface3)'} stroke="var(--line)" strokeWidth={2} />
                {lv > 0 && <path d={d} fill="var(--accent-primary)" fillOpacity={OPACITY[lv]} />}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function BodyMap({
  levels,
  figure = 'male',
  sides = 'both',
  height = 180,
  label,
}: {
  levels: MuscleLevels;
  figure?: BodyFigure;
  sides?: 'front' | 'back' | 'both';
  height?: number;
  label?: string;
}) {
  const [paths, setPaths] = useState<BodyPaths | null>(cache);
  useEffect(() => {
    if (paths) return;
    let alive = true;
    loadPaths().then((p) => alive && setPaths(p)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [paths]);

  const show = sides === 'both' ? (['front', 'back'] as const) : ([sides] as const);
  return (
    <div className="row gap-8" role="img" aria-label={label ?? 'muscle map'} style={{ justifyContent: 'center', minHeight: height }}>
      {paths
        ? show.map((s) => <Figure key={s} view={paths[figure][s]} levels={levels} height={height} />)
        : null}
    </div>
  );
}

/** Highlight for a single exercise: primary fully lit, supporting muscles half. */
export function levelsForExercise(load: Partial<Record<string, number>>): MuscleLevels {
  const lv: MuscleLevels = {};
  for (const [slug, w] of Object.entries(load)) {
    if (!w) continue;
    lv[slug as keyof MuscleLevels] = w >= 0.99 ? 4 : w >= 0.5 ? 3 : 2;
  }
  return lv;
}
