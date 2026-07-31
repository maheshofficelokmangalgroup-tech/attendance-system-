import React, { useEffect, useState } from "react";
import {
  FileText, Download, Filter, Calendar, Users, Clock, AlertTriangle,
  FileSpreadsheet, ShieldCheck, Layers, Award, MapPin, Grid, RefreshCw, Search, User,
} from "lucide-react";
import DataTable, { Column } from "@/components/ui/DataTable";
import {
  fetchReportData, fetchMusterRoll, downloadReportCSV, downloadEmployeeExcelReport,
  GenericReportData, MusterRollData,
} from "@/api/reports";
import apiClient from "@/api/client";

interface Department { id: number; name: string; }

interface ReportMeta {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  description: string;
}

const REPORT_TYPES: ReportMeta[] = [
  { id: "employee_excel", name: "Employee Attendance (Excel)", category: "Employee", icon: FileSpreadsheet, description: "Search an employee, pick a period, download full attendance + daily task summary as Excel" },
  { id: "daily_summary", name: "Daily Attendance Summary", category: "Attendance", icon: Calendar, description: "Daily check-in, check-out, working hours, and statuses" },
  { id: "muster_roll", name: "Monthly Muster Roll Matrix", category: "Attendance", icon: Grid, description: "Grid view of Days 1–31 vs Employees for payroll" },
  { id: "late_early", name: "Late Coming & Early Exit", category: "Compliance", icon: Clock, description: "Employees arriving past grace period or leaving early" },
  { id: "absenteeism", name: "Absenteeism & Unplanned Leaves", category: "Compliance", icon: AlertTriangle, description: "Unexcused absences and continuous leave flags" },
  { id: "leave_utilization", name: "Leave Balance & Utilization", category: "Leaves", icon: FileSpreadsheet, description: "PL/SL/CL/Comp-Off balances, accrued vs used days" },
  { id: "overtime", name: "Overtime & Extra Hours", category: "Payroll", icon: Award, description: "Hours worked beyond shift schedule" },
  { id: "wfh_onduty", name: "WFH & On-Duty Field Logs", category: "Attendance", icon: MapPin, description: "Remote work and client-site attendance logs" },
  { id: "audit_trail", name: "Regularization & Audit Trail", category: "Audit", icon: ShieldCheck, description: "Manual status overrides and admin audit history" },
  { id: "employee_master", name: "Employee Master Directory", category: "HR", icon: Users, description: "Complete employee profile directory and roles" },
  { id: "shift_compliance", name: "Shift & Holiday Compliance", category: "Compliance", icon: Layers, description: "Shift assignments, weekend work, and holiday logs" },
];

interface EmployeeSearchResult {
  id: number;
  employee_code: string;
  full_name: string;
  department?: { name: string } | null;
}

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const EmployeeExcelReportPanel: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(toISODate(firstOfMonth));
  const [toDate, setToDate] = useState(toISODate(today));
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(() => {
      apiClient.get("/employees", { params: { company_id: 1, search: query, page_size: 10 } })
        .then(({ data }) => setResults(Array.isArray(data) ? data : data?.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 300); // debounce
    return () => clearTimeout(handle);
  }, [query]);

  const applyPreset = (preset: "this_month" | "last_month" | "this_week") => {
    const now = new Date();
    if (preset === "this_month") {
      setFromDate(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(toISODate(now));
    } else if (preset === "last_month") {
      setFromDate(toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setToDate(toISODate(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (preset === "this_week") {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      setFromDate(toISODate(monday));
      setToDate(toISODate(now));
    }
  };

  const handleDownload = async () => {
    if (!selectedEmployee) return;
    setError("");
    setIsDownloading(true);
    try {
      await downloadEmployeeExcelReport(selectedEmployee.id, fromDate, toDate, selectedEmployee.full_name);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to generate Excel report");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700 }}>Employee Attendance (Excel)</h2>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
          Search an employee, pick a period, and download their full attendance + daily task summary as a real Excel file.
        </p>
      </div>

      {/* Step 1: Search + select employee */}
      <div>
        <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          1. Search Employee
        </label>
        <div style={{ position: "relative", marginTop: "8px" }}>
          <Search size={16} color="var(--color-text-secondary)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            className="input"
            style={{ paddingLeft: "36px", width: "100%", maxWidth: "420px" }}
            placeholder="Type employee name or code…"
            value={selectedEmployee ? selectedEmployee.full_name : query}
            onChange={(e) => { setSelectedEmployee(null); setQuery(e.target.value); }}
          />
        </div>

        {!selectedEmployee && query.trim() && (
          <div style={{ marginTop: "8px", maxWidth: "420px", border: "1px solid var(--color-border)", borderRadius: "10px", overflow: "hidden" }}>
            {isSearching ? (
              <div className="skeleton" style={{ height: "60px" }} />
            ) : results.length === 0 ? (
              <p style={{ padding: "12px", fontSize: "13px", color: "var(--color-text-secondary)" }}>No employees found.</p>
            ) : (
              results.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedEmployee(emp); setQuery(""); setResults([]); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "10px 14px", background: "var(--color-surface)", border: "none",
                    borderBottom: "1px solid var(--color-border)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <User size={16} color="var(--color-primary)" />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>{emp.full_name}</p>
                    <p style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                      {emp.employee_code} · {emp.department?.name ?? "—"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {selectedEmployee && (
          <div style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "9999px", background: "rgba(79,70,229,0.08)" }}>
            <User size={14} color="var(--color-primary)" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary)" }}>{selectedEmployee.full_name}</span>
            <button onClick={() => setSelectedEmployee(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "13px" }}>✕</button>
          </div>
        )}
      </div>

      {/* Step 2: Period */}
      <div style={{ opacity: selectedEmployee ? 1 : 0.5, pointerEvents: selectedEmployee ? "auto" : "none" }}>
        <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          2. Select Period
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginTop: "8px" }}>
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => applyPreset("this_week")}>This Week</button>
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => applyPreset("this_month")}>This Month</button>
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => applyPreset("last_month")}>Last Month</button>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>From:</span>
          <input className="input" type="date" style={{ width: "150px" }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>To:</span>
          <input className="input" type="date" style={{ width: "150px" }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {error && <p style={{ fontSize: "13px", color: "#E11D48" }}>{error}</p>}

      {/* Step 3: Download */}
      <button
        className="btn-primary"
        style={{ alignSelf: "flex-start", opacity: selectedEmployee ? 1 : 0.5 }}
        disabled={!selectedEmployee || isDownloading}
        onClick={handleDownload}
      >
        <Download size={16} /> {isDownloading ? "Generating…" : "Download Excel Report"}
      </button>
    </div>
  );
};

const ReportsHub: React.FC = () => {
  const [selectedReportId, setSelectedReportId] = useState<string>("daily_summary");
  const [reportData, setReportData] = useState<GenericReportData | null>(null);
  const [musterData, setMusterData] = useState<MusterRollData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptId, setDeptId] = useState<number | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2026);

  useEffect(() => {
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : data?.data ?? []))
      .catch(console.error);
  }, []);

  const loadData = () => {
    if (selectedReportId === "employee_excel") return; // self-contained panel, fetches on its own
    setIsLoading(true);
    if (selectedReportId === "muster_roll") {
      fetchMusterRoll(year, month, deptId || undefined)
        .then(setMusterData)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      fetchReportData(selectedReportId, fromDate || undefined, toDate || undefined, deptId || undefined)
        .then(setReportData)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedReportId, deptId, fromDate, toDate, month, year]);

  const currentMeta = REPORT_TYPES.find((r) => r.id === selectedReportId) ?? REPORT_TYPES[0];

  const genericColumns: Column<Record<string, unknown>>[] = (reportData?.headers ?? []).map((h, idx) => ({
    key: `col_${idx}`,
    header: h,
    render: (_, row) => <span style={{ fontSize: "13px" }}>{String((row as any)[`col_${idx}`] ?? "—")}</span>,
  }));

  const genericTableData = (reportData?.rows ?? []).map((r, rowIdx) => {
    const rowObj: Record<string, unknown> = { id: rowIdx };
    r.forEach((val, colIdx) => {
      rowObj[`col_${colIdx}`] = val;
    });
    return rowObj;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Enterprise Reports Hub
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
            11 report types with filter customization and one-click export
          </p>
        </div>
        {selectedReportId !== "employee_excel" && (
          <button
            className="btn-primary"
            onClick={() => downloadReportCSV(selectedReportId).catch((e: any) => alert(e?.response?.data?.detail ?? "Export failed"))}
            id="export-csv-btn"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* Main Layout Grid: Report Selector Sidebar + Main Report Content */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
        {/* Report Selector Sidebar */}
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 12px" }}>
            REPORT TYPES (11)
          </p>

          {REPORT_TYPES.map((rep) => {
            const Icon = rep.icon;
            const isSelected = selectedReportId === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedReportId(rep.id)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px",
                  background: isSelected ? "rgba(79,70,229,0.08)" : "transparent",
                  border: isSelected ? "1px solid rgba(79,70,229,0.2)" : "1px solid transparent",
                  textAlign: "left", cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
              >
                <div style={{ marginTop: "2px", flexShrink: 0 }}>
                  <Icon size={18} color={isSelected ? "var(--color-primary)" : "var(--color-text-secondary)"} />
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--color-primary)" : "var(--color-text-primary)" }}>
                    {rep.name}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                    {rep.category}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {selectedReportId === "employee_excel" ? (
            <EmployeeExcelReportPanel />
          ) : (
          <>
          {/* Header Info & Filters */}
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700 }}>
                  {currentMeta.name}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                  {currentMeta.description}
                </p>
              </div>
              <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={loadData}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={15} color="var(--color-text-secondary)" />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>FILTER:</span>
              </div>

              {selectedReportId === "muster_roll" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <select className="input" style={{ width: "120px" }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                  <select className="input" style={{ width: "100px" }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>From:</span>
                  <input className="input" type="date" style={{ width: "140px" }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>To:</span>
                  <input className="input" type="date" style={{ width: "140px" }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              )}

              <select className="input" style={{ width: "160px" }} value={deptId} onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Report Data Renderers */}
          {selectedReportId === "muster_roll" ? (
            /* Special Muster Roll Matrix View */
            <div className="card" style={{ padding: "20px", overflowX: "auto" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
                MUSTERN ROLL GRID — {month}/{year}
              </p>

              {isLoading ? (
                <div className="skeleton" style={{ height: "300px", borderRadius: "12px" }} />
              ) : !musterData || musterData.rows.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--color-text-secondary)", padding: "40px" }}>No muster roll data for this period.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-background)" }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>Emp Code</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
                      {Array.from({ length: musterData.total_days }).map((_, i) => (
                        <th key={i + 1} style={{ padding: "4px", textAlign: "center", minWidth: "26px" }}>{i + 1}</th>
                      ))}
                      <th style={{ padding: "8px", textAlign: "center" }}>P</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {musterData.rows.map((row) => (
                      <tr key={row.employee_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{row.employee_code}</td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{row.full_name}</td>
                        {Array.from({ length: musterData.total_days }).map((_, i) => {
                          const code = row.days[i + 1] ?? "A";
                          const isP = code === "P";
                          const isA = code === "A";
                          const isL = code === "L";
                          return (
                            <td key={i + 1} style={{ padding: "4px", textAlign: "center" }}>
                              <span
                                style={{
                                  fontSize: "10px", fontWeight: 700, padding: "2px 4px", borderRadius: "4px",
                                  background: isP ? "rgba(5,150,105,0.12)" : isL ? "rgba(217,119,6,0.12)" : isA ? "rgba(225,29,72,0.12)" : "rgba(100,116,139,0.12)",
                                  color: isP ? "#059669" : isL ? "#D97706" : isA ? "#E11D48" : "#64748B",
                                }}
                              >
                                {code}
                              </span>
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: "#059669" }}>{row.total_present}</td>
                        <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: "#E11D48" }}>{row.total_absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* Standard Generic Table View for Reports #1, #3–#10 */
            <div className="card" style={{ padding: "24px" }}>
              <DataTable<Record<string, unknown>>
                columns={genericColumns}
                data={genericTableData}
                isLoading={isLoading}
                keyExtractor={(row) => row.id as number}
                emptyState={{
                  icon: <FileText size={40} color="var(--color-text-secondary)" />,
                  title: "No records found for this report and filter selection",
                }}
              />
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsHub;
