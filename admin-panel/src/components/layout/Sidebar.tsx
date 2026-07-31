import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarCheck, FileText,
  Settings, LogOut, Bell, Building2, Clock, ChevronRight,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { clearAuth } from "@/store/authSlice";
import apiClient from "@/api/client";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employees", icon: Users, label: "Employees", roles: ["admin", "hr"] },
  { to: "/attendance", icon: Clock, label: "Attendance" },
  { to: "/leave", icon: CalendarCheck, label: "Leave" },
  { to: "/reports", icon: FileText, label: "Reports", roles: ["admin", "hr", "manager"] },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/settings", icon: Settings, label: "Settings", roles: ["admin", "hr"] },
];

import { Sun, Moon } from "lucide-react";

export const Sidebar: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  const [theme, setTheme] = React.useState<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleLogout = async () => {
    try {
      const refresh_token = JSON.parse(localStorage.getItem("attendance_auth") ?? "{}").refresh_token;
      if (refresh_token) await apiClient.post("/auth/logout", { refresh_token });
    } finally {
      dispatch(clearAuth());
      navigate("/login");
    }
  };

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minHeight: "100vh",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "sticky",
        top: 0,
        flexShrink: 0,
      }}
    >
      {/* Logo / Brand */}
      <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "var(--color-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Building2 size={20} color="#fff" />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "15px", lineHeight: 1.2, color: "var(--color-text-primary)" }}>
              AttendHR
            </p>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Admin Panel</p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-primary)",
          }}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} color="#FBBF24" />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
              background: isActive ? "rgba(79, 70, 229, 0.08)" : "transparent",
              transition: "all var(--transition-fast)",
              textDecoration: "none",
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} color={isActive ? "var(--color-primary)" : "var(--color-text-secondary)"} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && <ChevronRight size={14} color="var(--color-primary)" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile + logout */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid var(--color-border)" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 12px", borderRadius: "10px",
            background: "var(--color-background)",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: "var(--color-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 700, color: "#fff",
              flexShrink: 0,
            }}
          >
            {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.full_name ?? user?.email}
            </p>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "capitalize" }}>
              {user?.role_name}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            width: "100%", padding: "9px 12px", borderRadius: "10px",
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: "13px", fontWeight: 500, color: "#E11D48",
            transition: "background var(--transition-fast)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(225,29,72,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <LogOut size={16} color="#E11D48" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
