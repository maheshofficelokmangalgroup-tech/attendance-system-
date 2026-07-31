import React, { useEffect, useState } from "react";
import {
  Calendar, MapPin, Eye, Edit3, X, Check, ExternalLink,
  Smartphone, Wifi, ShieldAlert, Filter, UserCheck, UserX, Clock, Home, CalendarCheck,
} from "lucide-react";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import KPICard from "@/components/ui/KPICard";
import { type StatusKey } from "@/theme/tokens";
import {
  fetchAttendanceList, fetchTodaySummary, fetchAttendanceDetail,
  regularizeAttendance, AttendanceItem, AttendanceTodaySummaryData,
} from "@/api/attendance";
import apiClient, { resolvePhotoUrl } from "@/api/client";

interface Department { id: number; name: string; }

const AttendanceList: React.FC = () => {
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceTodaySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Drill-down Modal State
  const [selectedItem, setSelectedItem] = useState<AttendanceItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegularizeMode, setIsRegularizeMode] = useState(false);
  const [regStatus, setRegStatus] = useState<string>("present");
  const [regRemarks, setRegRemarks] = useState<string>("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    const params: any = { company_id: 1, page_size: 100 };
    if (search) params.search = search;
    if (departmentId) params.department_id = departmentId;
    if (statusFilter) params.status = statusFilter;
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;

    Promise.all([
      fetchAttendanceList(params),
      fetchTodaySummary(1),
    ])
      .then(([listData, summaryData]) => {
        setItems(Array.isArray(listData) ? listData : listData?.data ?? []);
        setSummary(summaryData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : data?.data ?? []))
      .catch(console.error);

    loadData();
  }, [departmentId, statusFilter, fromDate, toDate]);

  const openDrillDown = async (item: AttendanceItem) => {
    try {
      const detail = await fetchAttendanceDetail(item.id);
      setSelectedItem(detail);
    } catch {
      setSelectedItem(item);
    }
    setIsModalOpen(true);
    setIsRegularizeMode(false);
  };

  const handleRegularizeSubmit = async () => {
    if (!selectedItem || !regRemarks.trim()) return;
    setRegSubmitting(true);
    try {
      await regularizeAttendance(selectedItem.id, {
        status: regStatus,
        remarks: regRemarks.trim(),
      });
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Regularization failed");
    } finally {
      setRegSubmitting(false);
    }
  };

  const columns: Column<AttendanceItem>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      width: "110px",
      render: (_, row) => (
        <span style={{ fontWeight: 600, fontSize: "13px" }}>
          {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: "var(--color-primary)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}
          >
            {row.employee?.full_name?.[0] ?? "E"}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "14px" }}>
              {row.employee?.full_name ?? `Employee #${row.employee_id}`}
            </p>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
              {row.employee?.employee_code}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "check_in_time",
      header: "Check-In",
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {row.check_in_photo_path && (
            <img
              src={resolvePhotoUrl(row.check_in_photo_path)}
              alt="Selfie"
              style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--color-border)" }}
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
            />
          )}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" }}>
              {row.check_in_time ? row.check_in_time.slice(0, 5) : "—"}
            </p>
            {row.check_in_google_maps_url && (
              <a
                href={row.check_in_google_maps_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "11px", color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "2px" }}
              >
                <MapPin size={10} /> Map
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "check_out_time",
      header: "Check-Out",
      render: (_, row) => (
        <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
          {row.check_out_time ? row.check_out_time.slice(0, 5) : "—"}
        </span>
      ),
    },
    {
      key: "working_hours",
      header: "Hours",
      render: (v) => (
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
          {v ? `${v} hrs` : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (v) => <StatusBadge status={(v as string).toLowerCase() as StatusKey} size="md" />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "90px",
      render: (_, row) => (
        <button
          className="btn-ghost"
          style={{ padding: "4px 8px", fontSize: "12px" }}
          onClick={() => openDrillDown(row)}
        >
          <Eye size={14} /> Detail
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)" }}>
          Attendance Monitoring
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
          Real-time check-in logs, GPS verification, and photo drill-down
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "16px" }}>
        <KPICard title="Present Today" value={summary?.present_today ?? "—"} icon={<UserCheck />} color="#059669" />
        <KPICard title="Late Today" value={summary?.late_today ?? "—"} icon={<Clock />} color="#D97706" />
        <KPICard title="Absent Today" value={summary?.absent_today ?? "—"} icon={<UserX />} color="#E11D48" />
        <KPICard title="On Leave" value={summary?.on_leave_today ?? "—"} icon={<CalendarCheck />} color="#7C3AED" />
        <KPICard title="WFH" value={summary?.wfh_today ?? "—"} icon={<Home />} color="#0D9488" />
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Filter size={16} color="var(--color-text-secondary)" />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>FILTERS:</span>
        </div>

        {/* Department Filter */}
        <select
          className="input"
          style={{ width: "160px" }}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="input"
          style={{ width: "140px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="absent">Absent</option>
          <option value="wfh">WFH</option>
          <option value="on_duty">On Duty</option>
          <option value="holiday">Holiday</option>
        </select>

        {/* Date Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>From:</span>
          <input className="input" type="date" style={{ width: "140px" }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>To:</span>
          <input className="input" type="date" style={{ width: "140px" }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        {(departmentId || statusFilter || fromDate || toDate) && (
          <button
            className="btn-ghost"
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => { setDepartmentId(""); setStatusFilter(""); setFromDate(""); setToDate(""); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Data Table */}
      <div className="card" style={{ padding: "24px" }}>
        <DataTable<AttendanceItem>
          columns={columns}
          data={items}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          searchPlaceholder="Search by employee name or code…"
          emptyState={{
            icon: <Calendar size={40} color="var(--color-text-secondary)" />,
            title: "No attendance records found for this filter selection",
          }}
        />
      </div>

      {/* Drill-down Modal */}
      {isModalOpen && selectedItem && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "24px",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%", maxWidth: "600px", maxHeight: "90vh",
              overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700 }}>
                  Attendance Verification Detail
                </h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                  {selectedItem.employee?.full_name} · {selectedItem.date}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>
                <X size={20} />
              </button>
            </div>

            {/* Status & Timing summary */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", background: "var(--color-background)" }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "block" }}>Current Status</span>
                <StatusBadge status={selectedItem.status.toLowerCase() as StatusKey} size="lg" />
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Working Hours</span>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>{selectedItem.working_hours ? `${selectedItem.working_hours} hrs` : "—"}</p>
              </div>
              <button
                className="btn-ghost"
                style={{ padding: "6px 12px", fontSize: "13px" }}
                onClick={() => setIsRegularizeMode((v) => !v)}
              >
                <Edit3 size={14} /> Regularize
              </button>
            </div>

            {/* Regularization Form inline if toggled */}
            {isRegularizeMode && (
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(79, 70, 229, 0.08)", border: "1px solid rgba(79, 70, 229, 0.2)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-primary)" }}>REGULARIZE STATUS</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>New Status</label>
                    <select className="input" value={regStatus} onChange={(e) => setRegStatus(e.target.value)}>
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="half_day">Half Day</option>
                      <option value="wfh">WFH</option>
                      <option value="on_duty">On Duty</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Reason / Remarks *</label>
                    <input className="input" placeholder="e.g. Device GPS glitch confirmed by manager" value={regRemarks} onChange={(e) => setRegRemarks(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => setIsRegularizeMode(false)}>Cancel</button>
                  <button className="btn-primary" style={{ padding: "6px 14px", fontSize: "12px" }} disabled={regSubmitting || !regRemarks.trim()} onClick={handleRegularizeSubmit}>
                    Confirm Regularization
                  </button>
                </div>
              </div>
            )}

            {/* Photos Section */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "8px" }}>CHECK-IN SELFIE</p>
                {selectedItem.check_in_photo_path ? (
                  <img src={resolvePhotoUrl(selectedItem.check_in_photo_path)} alt="Check-in selfie" style={{ width: "100%", height: "160px", borderRadius: "8px", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "160px", background: "var(--color-background)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>No photo</div>
                )}
                <p style={{ fontSize: "12px", marginTop: "6px", fontWeight: 500 }}>{selectedItem.check_in_time ? `At ${selectedItem.check_in_time}` : "Not recorded"}</p>
              </div>

              <div style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "8px" }}>CHECK-OUT SELFIE</p>
                {selectedItem.check_out_photo_path ? (
                  <img src={resolvePhotoUrl(selectedItem.check_out_photo_path)} alt="Check-out selfie" style={{ width: "100%", height: "160px", borderRadius: "8px", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "160px", background: "var(--color-background)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>No photo</div>
                )}
                <p style={{ fontSize: "12px", marginTop: "6px", fontWeight: 500 }}>{selectedItem.check_out_time ? `At ${selectedItem.check_out_time}` : "Not recorded"}</p>
              </div>
            </div>

            {/* GPS & Location Snippet — Check-In */}
            {selectedItem.check_in_address && (
              <div style={{ borderRadius: "12px", background: "var(--color-background)", overflow: "hidden" }}>
                <div style={{ padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <MapPin size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>Check-In Location</p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>{selectedItem.check_in_address}</p>
                    {selectedItem.check_in_gps_accuracy && (
                      <p style={{ fontSize: "11px", color: "#059669", marginTop: "4px", fontWeight: 500 }}>
                        GPS Accuracy: {selectedItem.check_in_gps_accuracy} meters (Verified)
                      </p>
                    )}
                  </div>
                  {selectedItem.check_in_google_maps_url && (
                    <a href={selectedItem.check_in_google_maps_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "4px 8px", fontSize: "11px" }}>
                      Open Map <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {selectedItem.check_in_latitude != null && selectedItem.check_in_longitude != null && (
                  <iframe
                    title="Check-in location map"
                    width="100%"
                    height="200"
                    style={{ border: 0, display: "block" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${selectedItem.check_in_latitude},${selectedItem.check_in_longitude}&z=16&output=embed`}
                  />
                )}
              </div>
            )}

            {/* GPS & Location Snippet — Check-Out */}
            {selectedItem.check_out_address && (
              <div style={{ borderRadius: "12px", background: "var(--color-background)", overflow: "hidden" }}>
                <div style={{ padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <MapPin size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>Check-Out Location</p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>{selectedItem.check_out_address}</p>
                    {selectedItem.check_out_gps_accuracy && (
                      <p style={{ fontSize: "11px", color: "#059669", marginTop: "4px", fontWeight: 500 }}>
                        GPS Accuracy: {selectedItem.check_out_gps_accuracy} meters (Verified)
                      </p>
                    )}
                  </div>
                  {selectedItem.check_out_google_maps_url && (
                    <a href={selectedItem.check_out_google_maps_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "4px 8px", fontSize: "11px" }}>
                      Open Map <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {selectedItem.check_out_latitude != null && selectedItem.check_out_longitude != null && (
                  <iframe
                    title="Check-out location map"
                    width="100%"
                    height="200"
                    style={{ border: 0, display: "block" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${selectedItem.check_out_latitude},${selectedItem.check_out_longitude}&z=16&output=embed`}
                  />
                )}
              </div>
            )}

            {/* Task Summary (entered by employee at check-out) */}
            {selectedItem.checkout_task_summary && (
              <div style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "6px" }}>
                  Today's Task Summary
                </p>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", whiteSpace: "pre-wrap" }}>
                  {selectedItem.checkout_task_summary}
                </p>
              </div>
            )}

            {/* Raw Device Telemetry Logs */}
            {selectedItem.device_logs && selectedItem.device_logs.length > 0 && (
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "8px" }}>DEVICE TELEMETRY LOGS</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedItem.device_logs.map((log) => (
                    <div key={log.id} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontWeight: 600, textTransform: "uppercase", color: "var(--color-primary)" }}>{log.action_type}: </span>
                        <span>{log.device_model ?? "Unknown Device"} ({log.os_version ?? "OS"})</span>
                      </div>
                      <div style={{ color: "var(--color-text-secondary)" }}>
                        IP: {log.ip_address ?? "Local"} · {log.connection_type ?? "WiFi/Cellular"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
