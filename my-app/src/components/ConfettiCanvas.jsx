import { useRef, useEffect, useCallback } from "react";

const COLORS = [
  "#A84D48", "#e07a6e", "#f5c6c2", "#ffd700",
  "#ff6b6b", "#fff", "#7a2929", "#ffb347",
];

export default function ConfettiCanvas({ active }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animFrame = useRef(null);

  const spawn = useCallback(() => {
    const arr = [];
    for (let i = 0; i < 150; i++) {
      arr.push({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 200,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: 0.003 + Math.random() * 0.004,
      });
    }
    particles.current = arr;
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    spawn();

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.vy += 0.12;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity -= p.decay;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) animFrame.current = requestAnimationFrame(loop);
    };
    animFrame.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animFrame.current);
  }, [active, spawn]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}
