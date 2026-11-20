"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { useReducedMotion } from "motion/react";
import { formatDateShort, formatNumber } from "@/lib/utils/format";

export interface TrendPoint { date: string; value: number | null }

/**
 * Single-series trend. One hue (accent), 2px line, ≥8px markers, recessive grid,
 * crosshair tooltip. The card title names the series, so there is no legend.
 */
export function TrendChart({ data, unit, height = 220, digits = 1, kind = "line", ariaLabel, format, invert }: { data: TrendPoint[]; unit?: string; height?: number; digits?: number; kind?: "line" | "bar"; ariaLabel: string; format?: (v: number) => string; invert?: boolean }) {
  const fmt = format ?? ((v: number) => formatNumber(v, digits));
  const reduce = useReducedMotion();
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = kind === "bar" ? 0 : Math.max((max - min) * 0.15, max * 0.01, 0.5);
  const domain: [number, number] = kind === "bar" ? [0, Math.ceil(max * 1.1)] : [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  const tick = { fill: "var(--color-muted)", fontSize: 12 };
  const tooltip = (
    <Tooltip
      cursor={kind === "bar" ? { fill: "var(--color-hover)" } : { stroke: "var(--color-line-strong)", strokeWidth: 1 }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload as TrendPoint;
        return (
          <div className="rounded-[12px] border border-line bg-surface px-3 py-2 text-[13px] shadow-[var(--shadow-pop)]">
            <div className="text-muted">{formatDateShort(p.date)}</div>
            <div className="font-bold tabular text-ink">{p.value == null ? "–" : `${fmt(p.value)}${unit ? ` ${unit}` : ""}`}</div>
          </div>
        );
      }}
    />
  );
  const common = { data, margin: { top: 8, right: 8, bottom: 0, left: -8 } };
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart {...common}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="2 4" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={domain} tick={tick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => formatNumber(v, 0)} />
            {tooltip}
            <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={700} animationEasing="ease-out" activeBar={{ fill: "var(--color-accent-hover)" }} />
          </BarChart>
        ) : (
          <LineChart {...common}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="2 4" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={domain} reversed={invert} tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (format ? format(v) : formatNumber(v, 1))} />
            {tooltip}
            <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} connectNulls
              dot={data.length <= 24 ? { r: 4, fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2 } : false}
              activeDot={{ r: 6, fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2 }} isAnimationActive={!reduce} animationDuration={900} animationEasing="ease-out" />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
