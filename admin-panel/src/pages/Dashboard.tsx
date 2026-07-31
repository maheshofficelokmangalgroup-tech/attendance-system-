import React, { useEffect, useState } from "react";
import { Users, Clock, CalendarCheck, UserCheck, UserX, Home, MapPin, Activity } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import KPICard from "@/components/ui/KPICard";
import { fetchDashboardAnalytics, DashboardAnalyticsData } from "@/api/reports";

const COLORS = ["#4F46E5", "#059669", "#D97706", "#7C3AED", "#0891B2", "#E11D48"];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardAnalytics(1)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const kpis = data?.kpis ?? {
    total_employees: 0,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
    on_leave_today: 0,
    wfh_today: 0,
    on_duty_today: 0,
  };

  const kpiData = [
    { title: "Total Employees", value: kpis.total_employees, icon: <Users />, color: "#4F46E5" },
    { title: "Present Today", value: kpis.present_today, icon: <UserCheck />, color: "#059669" },
    { title: "Absent Today", value: kpis.absent_today, icon: <UserX />, color: "#E11D48" },
    { title: "Late Today", value: kpis.late_today, icon: <Clock />, color: "#D97706" },
    { title: "On Leave", value: kpis.on_leave_today, icon: <CalendarCheck />, color: "#7C3AED" },
    { title: "WFH Today", value: kpis.wfh_today, icon: <Home />, color: "#0D9488" },
    { title: "On Duty", value: kpis.on_duty_today, icon: <MapPin />, color: "#0891B2" },
  ];

  const pieData = data?.department_distribution?.map((d) => ({
    name: d.department_name,
    value: d.employee_count,
  })) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "4px" }}>
          Dashboard Analytics
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Real-time attendance metrics — {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "16px" }}>
        {kpiData.map((kpi) => (
          <KPICard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Recharts Analytics Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* 30-Day Attendance Trend */}
        <div className="card" style={{ padding: "24px", minHeight: "340px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--color-text-primary)", marginBottom: "16px" }}>
            30-Day Attendance Trend
          </h3>
          <div style={{ flex: 1, width: "100%", height: "260px" }}>
            {isLoading ? (
              <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: "12px" }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.trend_30_days ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickFormatter={(str) => str.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="present" stroke="#059669" strokeWidth={2.5} name="Present" dot={false} />
                  <Line type="monotone" dataKey="late" stroke="#D97706" strokeWidth={2} name="Late" dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#E11D48" strokeWidth={2} name="Absent" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department Workforce Distribution */}
        <div className="card" style={{ padding: "24px", minHeight: "340px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--color-text-primary)", marginBottom: "16px" }}>
            Department Workforce Distribution
          </h3>
          <div style={{ flex: 1, width: "100%", height: "260px" }}>
            {isLoading ? (
              <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: "12px" }} />
            ) : pieData.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
                No department data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
                  <Legend verticalAlign="bottom" height={36} formatter={(val) => <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <Activity size={18} color="var(--color-primary)" />
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--color-text-primary)" }}>
            Real-Time Activity Feed
          </h3>
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "10px", marginBottom: "10px" }} />)
        ) : !data?.recent_activity || data.recent_activity.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "13px", textAlign: "center", padding: "20px" }}>
            No recent activity recorded today.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.recent_activity.map((act) => (
              <div
                key={act.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: "10px", background: "var(--color-background)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: act.event_type === "check_in" ? "rgba(5,150,105,0.12)" : "rgba(79,70,229,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: act.event_type === "check_in" ? "#059669" : "#4F46E5",
                      fontWeight: 700, fontSize: "12px",
                    }}
                  >
                    {act.employee_name[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{act.title}</p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{act.subtitle}</p>
                  </div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  {new Date(act.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
