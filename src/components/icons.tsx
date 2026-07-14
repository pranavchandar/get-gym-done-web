interface IconProps {
  size?: number;
  className?: string;
}

const S = (size = 24) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const ChevronLeft = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="15 18 9 12 15 6" /></svg>
);
export const ChevronRight = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="9 18 15 12 9 6" /></svg>
);
export const ChevronUp = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="18 15 12 9 6 15" /></svg>
);
export const ChevronDown = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="6 9 12 15 18 9" /></svg>
);
export const ArrowRight = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
export const Home = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
);
export const Dumbbell = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11" /></svg>
);
export const BarChart = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="14" /></svg>
);
export const Gear = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
);
export const Plus = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const Minus = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const X = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
);
export const Check = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="20 6 9 17 4 12" /></svg>
);
export const Swap = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
);
export const Reset = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></svg>
);
export const Bed = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><path d="M2 17v-5h16a4 4 0 0 1 4 4v1" /><path d="M2 7v10M22 17v3M2 20v-3" /><circle cx="7" cy="10" r="1.6" /></svg>
);
export const Edit = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
);
export const More = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></svg>
);
export const MinusCircle = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><circle cx="12" cy="12" r="9" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
);
export const Trash = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
export const Search = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
export const Activity = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
);
export const Flame = ({ size, className }: IconProps) => (
  <svg {...S(size)} className={className}><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.6-2.8 1.4-3.8C8 9 9 10 9 10s-.5-3 3-8z" /></svg>
);
