import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
}

export function ChartCard({ title, subtitle, children, footer, action }: ChartCardProps) {
  return (
    <section className="dash-chart-card">
      <div className="dash-chart-card-header">
        <div>
          <h3 className="dash-chart-title">{title}</h3>
          {subtitle && <p className="dash-chart-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="dash-chart-actions">{action}</div>}
      </div>
      <div className="dash-chart-body">{children}</div>
      {footer && <div className="dash-chart-footer">{footer}</div>}
    </section>
  );
}
