"use client";

import { useEffect, useRef } from "react";

// Fundo "Warp" do ATLAS: grade de quadradinhos que esticam em cruz em volta
// do cursor (largos na linha, altos na coluna) e voltam com mola. O ponto
// de foco persegue o cursor com atraso; sem cursor (ou no toque), passeia
// sozinho. Com "reduzir movimento", fica parado.

export function WarpField({ ink, ground, alpha = 1, className }: { ink: string; ground: string; alpha?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const smooth = (t: number) => t * t * (3 - 2 * t);
    type C = { x: number; y: number; sx: number; sy: number; vx: number; vy: number };
    let W = 0;
    let H = 0;
    let pitch = 0;
    let cells: C[] = [];
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      W = cv.width = Math.max(1, Math.round(r.width * dpr));
      H = cv.height = Math.max(1, Math.round(r.height * dpr));
      pitch = Math.max(26 * dpr, Math.min(W, H) / 18);
      const nx = Math.ceil(W / pitch) + 1;
      const ny = Math.ceil(H / pitch) + 1;
      const ox = (W - (nx - 1) * pitch) / 2;
      const oy = (H - (ny - 1) * pitch) / 2;
      cells = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cells.push({ x: ox + i * pitch, y: oy + j * pitch, sx: 0, sy: 0, vx: 0, vy: 0 });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const P = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, user: 0, t: Math.random() * 9, on: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = cv.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      P.tx = (e.clientX - r.left) / r.width;
      P.ty = (e.clientY - r.top) / r.height;
      P.user = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = reduce.matches ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const live = P.user && now - P.user < 2500;
      P.t += dt;
      if (!live) {
        P.tx = 0.5 + 0.36 * Math.sin(P.t * 0.55) + 0.08 * Math.sin(P.t * 1.3);
        P.ty = 0.5 + 0.3 * Math.sin(P.t * 0.41 + 1) + 0.06 * Math.sin(P.t * 1.1);
      }
      const k = Math.min(1, dt * (live ? 7 : 3));
      P.x += (P.tx - P.x) * k;
      P.y += (P.ty - P.y) * k;
      P.on += (1 - P.on) * Math.min(1, dt * 2);
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ink;
      ctx.globalAlpha = alpha;
      const R = Math.min(W, H) * 0.38;
      const cx = P.x * W;
      const cy = P.y * H;
      const base = pitch * 0.2;
      for (const c of cells) {
        const fx = Math.abs(cx - c.x) / R;
        const fy = Math.abs(cy - c.y) / R;
        const d = Math.hypot(cx - c.x, cy - c.y) / (R * 1.6);
        const near = d < 1 ? smooth(1 - d) : 0;
        const gx = (fx < 1 ? smooth(1 - fx) : 0) * near * P.on;
        const gy = (fy < 1 ? smooth(1 - fy) : 0) * near * P.on;
        if (dt > 0) {
          c.vx += ((gx - c.sx) * 220 - c.vx * 26) * dt;
          c.vy += ((gy - c.sy) * 220 - c.vy * 26) * dt;
          c.sx += c.vx * dt;
          c.sy += c.vy * dt;
        }
        const w = Math.min(pitch * 0.92, base * (1 + c.sx * 3.2));
        const h = Math.min(pitch * 0.92, base * (1 + c.sy * 3));
        ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [ink, ground, alpha]);

  return <canvas ref={ref} aria-hidden="true" className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
