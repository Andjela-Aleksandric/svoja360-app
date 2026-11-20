"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * Counts the first number in a value up from zero when it comes into view,
 * keeping the formatting (decimal comma, units) of the original text.
 */
export function CountUp({ value, duration = 0.9 }: { value: string | number; duration?: number }) {
  const text = String(value);
  // Dates (17.11.2026.) and times (6:08) are shown as they are.
  const countable = !/\d+\.\d+\.|\d:\d/.test(text);
  const match = countable ? text.match(/-?\d+(?:[.,]\d+)?/) : null;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(match && !reduce ? text.replace(match[0], "0") : text);

  useEffect(() => {
    if (!match || reduce || !inView) { setShown(text); return; }
    const raw = match[0];
    const decimals = raw.includes(",") || raw.includes(".") ? raw.split(/[.,]/)[1].length : 0;
    const target = Number(raw.replace(",", "."));
    const sep = raw.includes(".") ? "." : ",";
    const controls = animate(0, target, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => setShown(text.replace(raw, v.toFixed(decimals).replace(".", sep))),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, text, reduce]);

  return <span ref={ref}>{shown}</span>;
}
