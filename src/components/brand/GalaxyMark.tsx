// Símbolo ATLAS: galáxia de perfil feita de palitos (grade 10×15, disco a
// −26°, luz vindo da esquerda). Geometria calculada uma vez, no módulo.

type Cell = { x: number; y: number; w: number; h: number };

function build(): Cell[] {
  const g = (x: number, y: number, s: number) => Math.exp(-(x * x + y * y) / (2 * s * s));
  const galaxy = (x: number, y: number) => {
    const a = -0.45;
    const u = x * Math.cos(a) - y * Math.sin(a);
    const w = x * Math.sin(a) + y * Math.cos(a);
    return Math.max(Math.exp(-(u * u) / 144.5 - (w * w) / 5.78) * 1.15, g(u, w, 3.4) * 1.25);
  };
  const nc = 10;
  const nr = 15;
  const px = 30 / nc;
  const py = 30 / nr;
  const h = +(py * 0.58).toFixed(2);
  const out: Cell[] = [];
  for (let r = 0; r < nr; r++)
    for (let c = 0; c < nc; c++) {
      const cx = 1 + px * (c + 0.5);
      const cy = 1 + py * (r + 0.5);
      const v = Math.min(1, galaxy(cx - 16, cy - 16));
      if (v < 0.2) continue;
      const w = px * (0.18 + 0.72 * v) * (1 - (0.3 * c) / (nc - 1));
      out.push({ x: +(cx - w / 2).toFixed(2), y: +(cy - h / 2).toFixed(2), w: +w.toFixed(2), h });
    }
  return out;
}

export const GALAXY_CELLS = build();

export function GalaxyMark({ size = 24, color = "currentColor", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill={color} className={className}>
      {GALAXY_CELLS.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} />
      ))}
    </svg>
  );
}

/** Ícone do app: fundo ouro, galáxia em grafite. */
export function AtlasIcon({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: "24%", background: "#F2C66D", display: "inline-grid", placeItems: "center", flexShrink: 0 }}
    >
      <GalaxyMark size={Math.round(size * 0.72)} color="#15161A" />
    </span>
  );
}
