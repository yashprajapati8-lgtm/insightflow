"use client";

import { useEffect, useRef } from "react";

/**
 * A field of fine dust behind the hero. Particles drift slowly; near the cursor they part,
 * brighten and warm toward amber, then settle back. Stops when off-screen or the tab is hidden,
 * and stays still for people who prefer reduced motion.
 */
export function DustField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    type P = { x: number; y: number; hx: number; hy: number; vx: number; vy: number; r: number; a: number; seed: number };
    let ps: P[] = [];
    type B = { x: number; y: number; r: number; a: number; vx: number; vy: number; seed: number };
    let bokeh: B[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    const glow = { x: -9999, y: -9999, k: 0 };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      w = box.width;
      h = box.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(1300, (w * h) / 1000));
      ps = Array.from({ length: n }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return { x, y, hx: x, hy: y, vx: 0, vy: 0, r: 0.4 + Math.random() * 1.1, a: 0.2 + Math.random() * 0.45, seed: Math.random() * 1000 };
      });
      // A few large, out-of-focus motes, like dust caught in a light beam.
      bokeh = Array.from({ length: Math.round(Math.min(34, (w * h) / 40000)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 6 + Math.random() * 26,
        a: 0.025 + Math.random() * 0.06,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - Math.random() * 0.1,
        seed: Math.random() * 1000,
      }));
    };

    const light = () => document.documentElement.getAttribute("data-theme") === "light";
    let raf = 0;
    let visible = true;
    let t = 0;

    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);
      const isLight = light();
      const R = 140;

      // Soft light that trails the cursor.
      glow.k += ((mouse.active ? 1 : 0) - glow.k) * 0.06;
      if (glow.x < -1000) {
        glow.x = mouse.x;
        glow.y = mouse.y;
      }
      glow.x += (mouse.x - glow.x) * 0.12;
      glow.y += (mouse.y - glow.y) * 0.12;
      if (glow.k > 0.01) {
        const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 260);
        const c = isLight ? "245, 170, 60" : "255, 214, 150";
        g.addColorStop(0, `rgba(${c}, ${0.13 * glow.k})`);
        g.addColorStop(0.45, `rgba(${c}, ${0.05 * glow.k})`);
        g.addColorStop(1, `rgba(${c}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(glow.x - 260, glow.y - 260, 520, 520);
      }

      // Bokeh motes: brighten as the light passes over them.
      for (const b of bokeh) {
        b.x += b.vx + Math.sin(t * 2 + b.seed) * 0.05;
        b.y += b.vy;
        if (b.y < -40) b.y = h + 40;
        if (b.x < -40) b.x = w + 40;
        if (b.x > w + 40) b.x = -40;
        const d = Math.hypot(b.x - glow.x, b.y - glow.y);
        const lit = glow.k * Math.max(0, 1 - d / 320);
        const a = b.a + lit * 0.22;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        const c = lit > 0.05 ? "255, 210, 140" : isLight ? "60, 64, 72" : "230, 235, 245";
        g.addColorStop(0, `rgba(${c}, ${a})`);
        g.addColorStop(0.6, `rgba(${c}, ${a * 0.35})`);
        g.addColorStop(1, `rgba(${c}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of ps) {
        // Slow drift around a home position.
        const dx0 = Math.sin(t + p.seed) * 6;
        const dy0 = Math.cos(t * 0.8 + p.seed) * 6;
        let fx = (p.hx + dx0 - p.x) * 0.012;
        let fy = (p.hy + dy0 - p.y) * 0.012;
        let near = 0;
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < R && d > 0.01) {
            near = 1 - d / R;
            const push = near * near * 2.4;
            // Push outward with a slight swirl, so the dust parts like smoke rather than a hard circle.
            fx += (dx / d) * push - (dy / d) * push * 0.35;
            fy += (dy / d) * push + (dx / d) * push * 0.35;
          }
        }
        p.vx = (p.vx + fx) * 0.9;
        p.vy = (p.vy + fy) * 0.9;
        p.x += p.vx;
        p.y += p.vy;
        // Dust inside the light glows; the rest stays faint.
        const dl = Math.hypot(p.x - glow.x, p.y - glow.y);
        const inLight = glow.k * Math.max(0, 1 - dl / 230);
        const alpha = Math.min(1, p.a + near * 0.6 + inLight * 0.5);
        if (near > 0.05 || inLight > 0.15) {
          ctx.fillStyle = `rgba(255, ${Math.round(200 - near * 30)}, ${Math.round(120 - near * 50)}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (p.r + near * 0.8) * 2.6, 0, Math.PI * 2);
          ctx.globalAlpha = 0.18;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else ctx.fillStyle = isLight ? `rgba(40, 44, 52, ${p.a * 0.7})` : `rgba(235, 238, 245, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + near * 0.8 + inLight * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible && !reduce) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mouse.x = e.clientX - box.left;
      mouse.y = e.clientY - box.top;
      mouse.active = mouse.y > -40 && mouse.y < h + 40;
    };
    const onLeave = () => (mouse.active = false);

    resize();
    draw();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden;
      cancelAnimationFrame(raf);
      if (visible && !reduce) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
