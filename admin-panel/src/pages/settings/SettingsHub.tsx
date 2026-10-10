import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon, Building2, GitBranch, Award, Clock,
  CalendarDays, FileSpreadsheet, SlidersHorizontal, ChevronRight,
} from "lucide-react";

interface SettingsCategory {
  to: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
}

const CATEGORIES: SettingsCategory[] = [
  { to: "/settings/company", icon: Building2, title: "Company", description: "Company profile, address, contact details" },
  { to: "/settings/departments", icon: GitBranch, title: "Departments", description: "Manage departments per company" },
  { to: "/settings/designations", icon: Award, title: "Designations", description: "Job titles within each department" },
  { to: "/settings/shifts", icon: Clock, title: "Shifts", description: "Work timings and grace periods" },
  { to: "/settings/holidays", icon: CalendarDays, title: "Holidays", description: "Company holiday calendar" },
  { to: "/settings/leave-types", icon: FileSpreadsheet, title: "Leave Types", description: "CL, SL, PL, COL and other leave policies" },
  { to: "/settings/attendance-rules", icon: SlidersHorizontal, title: "Attendance Rules", description: "Grace period, overtime, comp-off thresholds" },
];

const SettingsHub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SettingsIcon size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Settings</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Configure your organisation, policies, and attendance rules</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {CATEGORIES.map(({ to, icon: Icon, title, description }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="card"
            style={{
              display: "flex", alignItems: "flex-start", gap: "14px",
              padding: "20px", textAlign: "left", cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-surface)",
              transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(79,70,229,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={19} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</p>
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "3px", lineHeight: 1.4 }}>{description}</p>
            </div>
            <ChevronRight size={16} color="var(--color-text-secondary)" style={{ flexShrink: 0, marginTop: "2px" }} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsHub;
