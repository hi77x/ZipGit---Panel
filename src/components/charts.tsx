import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import type { ActivityDay, LanguageSlice } from "@/shared/contracts/audit";

export function Donut({ slices, size = 150, thickness = 15, center }: { slices: Array<{ name: string; percent: number; color: string }>; size?: number; thickness?: number; center?: ReactNode }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<Array<{ name: string; color: string; length: number; offset: number }>>((accumulator, slice) => {
    const previous = accumulator[accumulator.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    accumulator.push({ name: slice.name, color: slice.color, length: (slice.percent / 100) * circumference, offset });
    return accumulator;
  }, []);
  return <div className="gauge" style={{ position: "relative" }}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Distribution" style={{ transform: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={thickness}/>
      {segments.map((segment) => <circle key={segment.name} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={segment.color} strokeWidth={thickness} strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} strokeLinecap="butt" transform={`rotate(-90 ${size / 2} ${size / 2})`}/>)}
    </svg>
    {center ? <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>{center}</div> : null}
  </div>;
}

export function LanguageBreakdown({ languages, limit = 7 }: { languages: LanguageSlice[]; limit?: number }) {
  const visible = languages.slice(0, limit);
  return <div className="spread" style={{ alignItems: "center", gap: 20, flexWrap: "wrap" }}>
    <Donut slices={visible.map((language) => ({ name: language.name, percent: language.percent, color: language.color }))} center={<><b style={{ fontSize: "1.05rem" }}>{visible[0]?.name ?? "—"}</b><span className="muted text-xs">{visible[0]?.percent ?? 0}%</span></>}/>
    <div className="bar-list" style={{ flex: 1, minWidth: 220 }}>
      {visible.map((language) => <div className="bar-row" key={language.name} style={{ gridTemplateColumns: "minmax(90px, 130px) 1fr auto" }}>
        <span className="truncate"><span className="language-dot" style={{ background: language.color }}/>{language.name}</span>
        <span className="bar-track"><span className="bar-fill" style={{ width: `${language.percent}%`, background: language.color }}/></span>
        <span className="bar-value">{language.percent}%</span>
      </div>)}
    </div>
  </div>;
}

export function BarList({ items }: { items: Array<{ label: string; value: number; percent: number; color?: string; hint?: string }> }) {
  return <div className="bar-list">{items.map((item) => <div className="bar-row" key={item.label}>
    <span className="truncate" title={item.label}>{item.label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(2, item.percent)}%`, background: item.color }}/></span>
    <span className="bar-value">{item.hint ?? formatNumber(item.value)}</span>
  </div>)}</div>;
}

export function Heatmap({ days, label = "commits" }: { days: ActivityDay[]; label?: string }) {
  if (!days.length) return <p className="muted text-sm">No activity data.</p>;
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const values = days.map((day) => day.count);
  const max = Math.max(1, ...values);
  const start = new Date(`${days[0]?.date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(`${days[days.length - 1]?.date}T00:00:00Z`);
  const cells: Array<{ date: string; count: number }> = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10);
    cells.push({ date: iso, count: counts.get(iso) ?? 0 });
  }
  const level = (count: number) => count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
  return <div className="stack-sm">
    <div className="heatmap" role="img" aria-label={`Activity heatmap of ${label}`}>
      {cells.map((cell) => <span className={`heat-cell heat-${level(cell.count)}`} key={cell.date} title={`${cell.date}: ${cell.count} ${label}`}/>)}
    </div>
    <div className="heat-legend"><span>Less</span><span className="heat-cell heat-0"/><span className="heat-cell heat-1"/><span className="heat-cell heat-2"/><span className="heat-cell heat-3"/><span className="heat-cell heat-4"/><span>More</span></div>
  </div>;
}

export function ScoreGauge({ score, grade, caption }: { score: number; grade: string; caption?: string }) {
  const size = 170, thickness = 12, radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 85 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  return <div className="gauge">
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Health score ${score} out of 100, grade ${grade}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={thickness}/>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={thickness} strokeDasharray={`${filled} ${circumference - filled}`} strokeLinecap="round"/>
    </svg>
    <span className="gauge-value">{score}</span>
    <span className="gauge-label">Grade {grade}{caption ? ` · ${caption}` : ""}</span>
  </div>;
}

export function Sparkline({ values, width = 220, height = 44, stroke = "var(--text-2)" }: { values: number[]; width?: number; height?: number; stroke?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * (height - 6) - 3).toFixed(1)}`);
  return <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Trend">
    <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>;
}
