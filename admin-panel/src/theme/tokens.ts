/**
 * Design tokens — Section 3 of the project brief, as TypeScript constants.
 * Single source of truth. Import from here, never hard-code hex values.
 */

export const colors = {
  // Brand
  primary: {
    light: "#4F46E5",
    dark: "#818CF8",
    hoverLight: "#4338CA",
    hoverDark: "#6366F1",
  },
  accent: {
    light: "#F59E0B",
    dark: "#FBBF24",
  },

  // Backgrounds
  background: {
    light: "#F8FAFC",
    dark: "#0F172A",
  },
  surface: {
    light: "#FFFFFF",
    dark: "#1E293B",
  },
  border: {
    light: "#E2E8F0",
    dark: "#334155",
  },

  // Text
  text: {
    primary: { light: "#0F172A", dark: "#F1F5F9" },
    secondary: { light: "#64748B", dark: "#94A3B8" },
  },

  // Attendance statuses — 12 statuses, colorblind-safe groupings
  status: {
    present:   { hex: "#059669", bg: "rgba(5,150,105,0.12)",   label: "Present",    icon: "check-circle" },
    wfh:       { hex: "#0D9488", bg: "rgba(13,148,136,0.12)",  label: "WFH",        icon: "home" },
    on_duty:   { hex: "#0891B2", bg: "rgba(8,145,178,0.12)",   label: "On Duty",    icon: "briefcase" },
    comp_off:  { hex: "#65A30D", bg: "rgba(101,163,13,0.12)",  label: "Comp-Off",   icon: "refresh-ccw" },
    late:      { hex: "#D97706", bg: "rgba(217,119,6,0.12)",   label: "Late",       icon: "clock" },
    half_day:  { hex: "#EA580C", bg: "rgba(234,88,12,0.12)",   label: "Half Day",   icon: "clock-9" },
    early_exit:{ hex: "#CA8A04", bg: "rgba(202,138,4,0.12)",   label: "Early Exit", icon: "log-out" },
    absent:    { hex: "#E11D48", bg: "rgba(225,29,72,0.12)",   label: "Absent",     icon: "x-circle" },
    lwp:       { hex: "#DC2626", bg: "rgba(220,38,38,0.12)",   label: "LWP",        icon: "minus-circle" },
    on_leave:  { hex: "#7C3AED", bg: "rgba(124,58,237,0.12)",  label: "On Leave",   icon: "calendar-check" },
    holiday:   { hex: "#0284C7", bg: "rgba(2,132,199,0.12)",   label: "Holiday",    icon: "flag" },
    weekly_off:{ hex: "#64748B", bg: "rgba(100,116,139,0.12)", label: "Weekly Off", icon: "coffee" },
  },
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  base: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
} as const;

export const radius = {
  card: "16px",
  button: "10px",
  badge: "9999px",
  input: "10px",
} as const;

export const shadows = {
  card: "0 8px 24px rgba(79, 70, 229, 0.08)",
  cardHover: "0 12px 32px rgba(79, 70, 229, 0.16)",
  button: "0 4px 12px rgba(79, 70, 229, 0.24)",
} as const;

export const typography = {
  fontUI: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontDisplay: "'Sora', 'Inter', sans-serif",
  scale: {
    display: { size: "32px", lineHeight: "40px", weight: 700 },
    h1: { size: "26px", lineHeight: "34px", weight: 700 },
    h2: { size: "20px", lineHeight: "28px", weight: 600 },
    h3: { size: "16px", lineHeight: "24px", weight: 600 },
    body: { size: "14px", lineHeight: "22px", weight: 400 },
    caption: { size: "12px", lineHeight: "18px", weight: 400 },
  },
} as const;

export const motion = {
  fast: "150ms ease-out",
  base: "200ms ease-out",
  slow: "250ms ease-out",
} as const;

export type StatusKey = keyof typeof colors.status;
