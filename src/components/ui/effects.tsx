"use client";
import { useEffect } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/** One listener for the whole app: a soft ripple on every button and button-like link. */
export function RippleLayer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      const host = (e.target as HTMLElement | null)?.closest<HTMLElement>(".ripple-host");
      if (!host || host.hasAttribute("disabled")) return;
      const r = host.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - r.left - size / 2}px`;
      dot.style.top = `${e.clientY - r.top - size / 2}px`;
      host.appendChild(dot);
      setTimeout(() => dot.remove(), 750);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}

/** Gradient bar at the top that fills as the page scrolls. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, mass: 0.3 });
  if (reduce) return null;
  return <motion.div aria-hidden className="scroll-progress" style={{ scaleX }} />;
}
