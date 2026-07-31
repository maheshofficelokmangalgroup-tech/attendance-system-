import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  delta?: number;     // positive = up, negative = down, undefined = no delta
  deltaLabel?: string;
  color?: string;     // accent color for the icon background
  isLoading?: boolean;
}

/**
 * Dashboard KPI card — large number, icon, delta vs yesterday.
 * Used in the Section 3.7 KPI row.
 */
export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  delta,
  deltaLabel = "vs yesterday",
  color = "var(--color-primary)",
  isLoading = false,
}) => {
  const deltaColor =
    delta === undefined ? "var(--color-text-secondary)"
    : delta > 0 ? "#059669"
    : delta < 0 ? "#E11D48"
    : "var(--color-text-secondary)";

  const DeltaIcon = delta === undefined ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div
      className="card"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        transition: "transform 200ms ease-out, box-shadow 200ms ease-out",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            {title}
          </p>
          {isLoading ? (
            <div className="skeleton" style={{ width: "80px", height: "34px", borderRadius: "8px" }} />
          ) : (
            <p style={{ fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 700, lineHeight: 1, color: "var(--color-text-primary)" }}>
              {value}
            </p>
          )}
        </div>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ size?: number; color?: string }>, { size: 22, color })
            : icon}
        </div>
      </div>

      {delta !== undefined && !isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <DeltaIcon size={13} color={deltaColor} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: deltaColor }}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {deltaLabel}
          </span>
        </div>
      )}
    </div>
  );
};

export default KPICard;
