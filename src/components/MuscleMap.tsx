interface Region {
  aliases: string[];
  render: (fill: string) => JSX.Element;
}

const LIT = 'var(--accent-primary)';
const DIM = 'var(--surface3)';
const STROKE = 'var(--line)';

function e(el: JSX.Element): JSX.Element {
  return el;
}

const REGIONS: Region[] = [
  {
    aliases: ['neck', 'traps'],
    render: (f) => e(<rect key="neck" x="44" y="26" width="12" height="8" rx="3" fill={f} stroke={STROKE} strokeWidth="0.7" />),
  },
  {
    aliases: ['shoulders', 'front delts', 'side delts', 'rear delts', 'delts', 'shoulder'],
    render: (f) => (
      <g key="delts">
        <ellipse cx="26" cy="40" rx="10" ry="8" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <ellipse cx="74" cy="40" rx="10" ry="8" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['upper chest', 'chest', 'pecs'],
    render: (f) => (
      <g key="upperchest">
        <path d="M36 38 Q50 34 50 34 L50 46 Q42 46 34 44 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M64 38 Q50 34 50 34 L50 46 Q58 46 66 44 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['chest', 'lower chest', 'pecs'],
    render: (f) => (
      <g key="chest">
        <path d="M34 44 Q50 47 50 47 L50 58 Q40 58 33 52 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M66 44 Q50 47 50 47 L50 58 Q60 58 67 52 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['biceps', 'arms'],
    render: (f) => (
      <g key="biceps">
        <path d="M20 46 Q16 58 20 70 L27 68 Q25 56 27 48 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M80 46 Q84 58 80 70 L73 68 Q75 56 73 48 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['forearms'],
    render: (f) => (
      <g key="forearms">
        <path d="M18 70 Q16 84 19 94 L25 92 Q24 80 26 70 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M82 70 Q84 84 81 94 L75 92 Q76 80 74 70 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['abs', 'core', 'obliques'],
    render: (f) => e(<path key="abs" d="M40 58 L60 58 Q60 82 50 92 Q40 82 40 58 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />),
  },
  {
    aliases: ['lats', 'mid back', 'back', 'lower back'],
    render: (f) => (
      <g key="lats">
        <path d="M33 52 Q30 70 38 82 L40 60 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M67 52 Q70 70 62 82 L60 60 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['quads', 'quadriceps', 'legs'],
    render: (f) => (
      <g key="quads">
        <path d="M38 96 Q36 120 40 140 L48 138 Q48 116 48 96 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M62 96 Q64 120 60 140 L52 138 Q52 116 52 96 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
  {
    aliases: ['adductors', 'abductors', 'glutes', 'hamstrings', 'posterior chain'],
    render: (f) => e(<path key="add" d="M48 96 L52 96 L52 136 L48 136 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />),
  },
  {
    aliases: ['calves'],
    render: (f) => (
      <g key="calves">
        <path d="M40 144 Q38 164 42 182 L47 180 Q47 162 47 144 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
        <path d="M60 144 Q62 164 58 182 L53 180 Q53 162 53 144 Z" fill={f} stroke={STROKE} strokeWidth="0.7" />
      </g>
    ),
  },
];

export function MuscleMap({ muscles, size = 96 }: { muscles: string[]; size?: number }) {
  const active = new Set(muscles.map((m) => m.toLowerCase()));
  const isLit = (aliases: string[]) => aliases.some((a) => active.has(a));
  return (
    <svg width={size} height={size * 2} viewBox="0 0 100 200" role="img" aria-label="muscle map">
      {/* torso base */}
      <path
        d="M38 34 Q30 40 32 56 Q30 78 40 94 L60 94 Q70 78 68 56 Q70 40 62 34 Z"
        fill={DIM}
        stroke={STROKE}
        strokeWidth="0.7"
      />
      {/* head */}
      <circle cx="50" cy="16" r="9" fill={DIM} stroke={STROKE} strokeWidth="0.7" />
      {REGIONS.map((r) => r.render(isLit(r.aliases) ? LIT : DIM))}
    </svg>
  );
}
