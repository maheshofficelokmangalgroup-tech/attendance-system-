/**
 * Mobile Design Tokens — Section 3 of the project brief.
 * Single source of truth for the React Native mobile app.
 */

export const colors = {
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  primaryDark: "#818CF8",
  accent: "#F59E0B",
  accentDark: "#FBBF24",
  background: "#F8FAFC",
  backgroundDark: "#0F172A",
  surface: "#FFFFFF",
  surfaceDark: "#1E293B",
  border: "#E2E8F0",
  borderDark: "#334155",
  textPrimary: "#0F172A",
  textPrimaryDark: "#F1F5F9",
  textSecondary: "#64748B",
  textSecondaryDark: "#94A3B8",

  // 12 Attendance statuses
  status: {
    present:   { hex: "#059669", bg: "rgba(5,150,105,0.12)",   label: "Present" },
    wfh:       { hex: "#0D9488", bg: "rgba(13,148,136,0.12)",  label: "WFH" },
    on_duty:   { hex: "#0891B2", bg: "rgba(8,145,178,0.12)",   label: "On Duty" },
    comp_off:  { hex: "#65A30D", bg: "rgba(101,163,13,0.12)",  label: "Comp-Off" },
    late:      { hex: "#D97706", bg: "rgba(217,119,6,0.12)",   label: "Late" },
    half_day:  { hex: "#EA580C", bg: "rgba(234,88,12,0.12)",   label: "Half Day" },
    early_exit:{ hex: "#CA8A04", bg: "rgba(202,138,4,0.12)",   label: "Early Exit" },
    absent:    { hex: "#E11D48", bg: "rgba(225,29,72,0.12)",   label: "Absent" },
    lwp:       { hex: "#DC2626", bg: "rgba(220,38,38,0.12)",   label: "LWP" },
    on_leave:  { hex: "#7C3AED", bg: "rgba(124,58,237,0.12)",  label: "On Leave" },
    holiday:   { hex: "#0284C7", bg: "rgba(2,132,199,0.12)",   label: "Holiday" },
    weekly_off:{ hex: "#64748B", bg: "rgba(100,116,139,0.12)", label: "Weekly Off" },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  card: 16,
  button: 10,
  badge: 9999,
  input: 10,
} as const;

export const shadows = {
  card: {
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export type StatusKey = keyof typeof colors.status;
