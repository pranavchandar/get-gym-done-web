import { useEffect, useRef } from 'react';

function bucketColor(count: number): string {
  if (count <= 0) return 'var(--surface2)';
  if (count < 4) return 'color-mix(in srgb, var(--accent-primary) 40%, var(--surface2))';
  if (count < 8) return 'color-mix(in srgb, var(--accent-primary) 70%, var(--surface2))';
  return 'var(--accent-primary)';
}

export function Heatmap({
  count,
  today,
  weeks = 18,
}: {
  count: (epochDay: number) => number;
  today: number;
  weeks?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);

  const todayDate = new Date(today * 86400000);
  const weekday = todayDate.getUTCDay(); // 0=Sun
  const lastSunday = today - weekday;
  const start = lastSunday - (weeks - 1) * 7;

  const cols: JSX.Element[] = [];
  for (let w = 0; w < weeks; w++) {
    const cells: JSX.Element[] = [];
    for (let r = 0; r < 7; r++) {
      const ed = start + w * 7 + r;
      if (ed > today) {
        cells.push(<div key={r} className="hm-cell" style={{ background: 'transparent' }} />);
      } else {
        const c = count(ed);
        cells.push(<div key={r} className="hm-cell" style={{ background: bucketColor(c) }} />);
      }
    }
    cols.push(
      <div key={w} className="col">
        {cells}
      </div>,
    );
  }

  return (
    <div className="heatmap" ref={ref}>
      {cols}
    </div>
  );
}
