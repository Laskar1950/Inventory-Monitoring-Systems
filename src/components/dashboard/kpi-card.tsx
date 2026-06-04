import Link from "next/link";
import { ReactNode } from "react";

type Tone = "blue" | "green" | "amber" | "red" | "purple" | "teal";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: Tone;
  href?: string;
  delta?: string;
  deltaDir?: "up" | "down" | "warn";
  deltaLabel?: string;
}

export function KpiCard({ label, value, icon, tone, href, delta, deltaDir, deltaLabel }: KpiCardProps) {
  const content = (
    <div className={`dash-kpi-card dash-kpi-${tone}`}>
      <div className="dash-kpi-header">
        <span className="dash-kpi-label">{label}</span>
        <div className="dash-kpi-icon">{icon}</div>
      </div>
      <div className="dash-kpi-value">{value}</div>
      {delta && (
        <div className={`dash-kpi-delta dash-kpi-delta-${deltaDir ?? "up"}`}>
          {deltaDir === "down" ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 9 12 15 6 9" /></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
          )}
          <span>{delta}</span>
          {deltaLabel && <span className="dash-kpi-delta-sub">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{content}</Link> : content;
}
