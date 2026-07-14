import { useEffect, useRef } from 'react';
import { CONFETTI_COLORS } from '../theme/palettes';

const DURATION = 2800;
const COUNT = 120;
type Shape = 'rect' | 'streamer' | 'dot';

interface Piece {
  burst: boolean;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  g: number;
  color: string;
  shape: Shape;
  size: number;
  spin: number;
  rot0: number;
  flipPhase: number;
  flipSpeed: number;
  swayAmp: number;
  swayFreq: number;
  delay: number;
}

function makePieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < COUNT; i++) {
    const burst = i < COUNT * 0.6;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const shapeR = Math.random();
    const shape: Shape = shapeR < 0.5 ? 'rect' : shapeR < 0.8 ? 'streamer' : 'dot';
    const common = {
      color,
      shape,
      size: 6 + Math.random() * 8,
      spin: (Math.random() - 0.5) * 20,
      rot0: Math.random() * Math.PI * 2,
      flipPhase: Math.random() * Math.PI * 2,
      flipSpeed: 6 + Math.random() * 10,
      swayAmp: 0.01 + Math.random() * 0.03,
      swayFreq: 4 + Math.random() * 6,
    };
    if (burst) {
      const left = i % 2 === 0;
      pieces.push({
        ...common,
        burst: true,
        x0: left ? 0.04 : 0.96,
        y0: 1.05,
        vx: (left ? 1 : -1) * (0.3 + Math.random() * 0.55),
        vy: -(1.15 + Math.random() * 0.85),
        g: 1.5 + Math.random() * 0.5,
        delay: Math.random() * 0.05,
      });
    } else {
      pieces.push({
        ...common,
        burst: false,
        x0: Math.random(),
        y0: -0.1 - Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.8 + Math.random() * 0.5,
        g: 0.2,
        delay: Math.random() * 0.5,
      });
    }
  }
  return pieces;
}

export function Confetti({ onFinished }: { onFinished?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces = makePieces();
    const startAt = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const elapsed = now - startAt;
      const t = Math.min(elapsed / DURATION, 1);
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        if (t < p.delay) continue;
        const lt = t;
        const x = (p.x0 + p.vx * lt + p.swayAmp * Math.sin(p.swayFreq * lt)) * W;
        const y = (p.y0 + p.vy * lt + 0.5 * p.g * lt * lt) * H;
        if (y > H + 40) continue;
        let alpha = Math.min(1, (t - p.delay) / 0.06);
        if (t > 0.8) alpha *= Math.max(0, (1 - t) / 0.2);
        if (alpha <= 0) continue;
        const flip = Math.abs(Math.cos(p.flipPhase + p.flipSpeed * lt));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(p.rot0 + p.spin * lt);
        ctx.scale(Math.max(0.1, flip), 1);
        ctx.fillStyle = p.color;
        if (p.shape === 'dot') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const w = p.shape === 'streamer' ? p.size * 0.4 : p.size;
          const h = p.shape === 'streamer' ? p.size * 1.6 : p.size * 0.6;
          const r = 2;
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, r);
          ctx.fill();
        }
        ctx.restore();
      }
      if (t >= 1) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished?.();
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}
