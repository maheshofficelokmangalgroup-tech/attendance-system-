import React from "react";
import {
  CheckCircle, Home, Briefcase, RefreshCcw, Clock, LogOut,
  XCircle, MinusCircle, CalendarCheck, Flag, Coffee, Clock9,
} from "lucide-react";
import { colors, type StatusKey } from "@/theme/tokens";

const iconMap: Record<StatusKey, React.ComponentType<{ size?: number; color?: string }>> = {
  present: CheckCircle,
  wfh: Home,
  on_duty: Briefcase,
  comp_off: RefreshCcw,
  late: Clock,
  half_day: Clock9,
  early_exit: LogOut,
  absent: XCircle,
  lwp: MinusCircle,
  on_leave: CalendarCheck,
  holiday: Flag,
  weekly_off: Coffee,
};

interface StatusBadgeProps {
  status: StatusKey;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

/**
 * Single shared component for all 12 attendance statuses.
 * Icon + label on colored background — never a bare dot.
 * Accessible: status communicated by icon + text, not color alone.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "md",
  showIcon = true,
}) => {
  const token = colors.status[status];
  const Icon = iconMap[status];

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { fontSize: "11px", padding: "2px 8px", gap: "4px" },
    md: { fontSize: "12px", padding: "4px 10px", gap: "5px" },
    lg: { fontSize: "13px", padding: "6px 12px", gap: "6px" },
  };

  const iconSize = size === "sm" ? 11 : size === "md" ? 13 : 14;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        backgroundColor: token.bg,
        color: token.hex,
        fontWeight: 600,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        ...sizeStyles[size],
      }}
      aria-label={`Status: ${token.label}`}
    >
      {showIcon && <Icon size={iconSize} color={token.hex} aria-hidden="true" />}
      {token.label}
    </span>
  );
};

export default StatusBadge;
