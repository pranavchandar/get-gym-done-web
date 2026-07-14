export function initialsFor(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  color,
  photo,
  size = 56,
}: {
  name?: string | null;
  color?: string | null;
  photo?: string | null;
  size?: number;
}) {
  const bg = color || 'var(--accent-primary)';
  const fontSize = Math.round(size * 0.4);
  if (photo) {
    return (
      <div
        className="avatar"
        style={{ width: size, height: size, backgroundImage: `url(${photo})` }}
        aria-label="avatar"
      />
    );
  }
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: bg, color: 'var(--on-accent)', fontSize }}
      aria-label="avatar"
    >
      {initialsFor(name)}
    </div>
  );
}
