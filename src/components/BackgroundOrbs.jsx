import { useEffect, useRef } from "react";

const ORBS = [
  { size: 600, color: "radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 70%)", speedX: 0.04, speedY: 0.04, offsetX: 0, offsetY: -80 },
  { size: 500, color: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)", speedX: 0.025, speedY: 0.03, offsetX: 180, offsetY: 120 },
  { size: 420, color: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)", speedX: 0.05, speedY: 0.035, offsetX: -200, offsetY: 160 },
  { size: 350, color: "radial-gradient(circle, rgba(167,243,208,0.16) 0%, transparent 70%)", speedX: 0.06, speedY: 0.05, offsetX: 100, offsetY: -150 },
];

export function BackgroundOrbs() {
  const orbRefs = useRef([]);
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const positions = useRef(ORBS.map((_, i) => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  })));
  const rafId = useRef(null);

  useEffect(() => {
    function onMouseMove(e) {
      mouse.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", onMouseMove);

    function tick() {
      ORBS.forEach((orb, i) => {
        const pos = positions.current[i];
        const targetX = mouse.current.x + orb.offsetX;
        const targetY = mouse.current.y + orb.offsetY;

        pos.x += (targetX - pos.x) * orb.speedX;
        pos.y += (targetY - pos.y) * orb.speedY;

        const el = orbRefs.current[i];
        if (el) {
          el.style.transform = `translate(${pos.x - orb.size / 2}px, ${pos.y - orb.size / 2}px)`;
        }
      });
      rafId.current = requestAnimationFrame(tick);
    }

    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {ORBS.map((orb, i) => (
        <div
          key={i}
          ref={(el) => (orbRefs.current[i] = el)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            borderRadius: "50%",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
