import React, { useEffect, useState } from "react";
import {
  CalendarCheck, CheckCircle2, XCircle, Clock, Calendar as CalendarIcon,
  Filter, Search, UserCheck, Check, X, ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { type StatusKey } from "@/theme/tokens";
import {
  fetchApprovalQueue, fetchTeamCalendar, fetchAllLeaves, fetchMyBalances,
  approveFirstLevel, approveFinalLevel, rejectLeave,
  LeaveItem, TeamCalendarItem, LeaveBalanceItem,
} from "@/api/leaves";
import apiClient from "@/api/client";

type Tab = "approvals" | "calendar" | "all_leaves" | "my_balances";

interface Department { id: number; name: string; }

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CalendarGrid: React.FC<{ monthDate: Date; items: TeamCalendarItem[] }> = ({ monthDate, items }) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay();
  const today = new Date();
  const todayKey = today.toISOString().split("T")[0];

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const leavesForDay = (day: number) => {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return items.filter((it) => it.from_date <= dateKey && it.to_date >= dateKey);
  };

  if (items.length === 0) {
    return <p style={{ textAlign: "center", color: "var(--color-text-secondary)", padding: "40px 0" }}>No approved leaves in this month.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", padding: "4px 0" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} style={{ minHeight: "90px", borderRadius: "10px" }} />;
          }
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayLeaves = leavesForDay(day);
          const isToday = dateKey === todayKey;
          return (
            <div
              key={day}
              style={{
                minHeight: "90px",
                borderRadius: "10px",
                padding: "6px",
                background: "var(--color-background)",
                border: isToday ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                overflow: "hidden",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: isToday ? 700 : 500, color: isToday ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                {day}
              </span>
              {dayLeaves.slice(0, 2).map((l) => (
                <span
                  key={l.id}
                  title={`${l.employee_name} — ${l.leave_type_name}`}
                  style={{
                    fontSize: "10px", fontWeight: 600, color: "#7C3AED",
                    background: "rgba(124,58,237,0.12)", borderRadius: "6px",
                    padding: "2px 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {l.employee_name.split(" ")[0]} · {l.leave_type_code}
                </span>
              ))}
              {dayLeaves.length > 2 && (
                <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>+{dayLeaves.length - 2} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LeaveManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("approvals");

  // Approval Queue State
  const [approvalQueue, setApprovalQueue] = useState<LeaveItem[]>([]);
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(true);

  // Action Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All Leaves State
  const [allLeaves, setAllLeaves] = useState<LeaveItem[]>([]);
  const [isLeavesLoading, setIsLeavesLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [calendarItems, setCalendarItems] = useState<TeamCalendarItem[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // My Balances State
  const [myBalances, setMyBalances] = useState<LeaveBalanceItem[]>([]);
  const [isBalancesLoading, setIsBalancesLoading] = useState(true);

  const loadApprovalQueue = () => {
    setIsApprovalsLoading(true);
    fetchApprovalQueue()
      .then((data) => setApprovalQueue(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsApprovalsLoading(false));
  };

  const loadAllLeaves = () => {
    setIsLeavesLoading(true);
    const params: any = { company_id: 1, page_size: 100 };
    if (deptFilter) params.department_id = deptFilter;
    if (statusFilter) params.status = statusFilter;

    fetchAllLeaves(params)
      .then((data) => setAllLeaves(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsLeavesLoading(false));
  };

  const loadCalendar = () => {
    setIsCalendarLoading(true);
    const y = currentMonthDate.getFullYear();
    const m = currentMonthDate.getMonth();
    const fromDate = new Date(y, m, 1).toISOString().split("T")[0];
    const toDate = new Date(y, m + 1, 0).toISOString().split("T")[0];

    fetchTeamCalendar(fromDate, toDate)
      .then((data) => setCalendarItems(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsCalendarLoading(false));
  };

  useEffect(() => {
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : data?.data ?? []))
      .catch(console.error);

    loadApprovalQueue();

    setIsBalancesLoading(true);
    fetchMyBalances()
      .then((data) => setMyBalances(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsBalancesLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "all_leaves") loadAllLeaves();
    if (activeTab === "calendar") loadCalendar();
  }, [activeTab, deptFilter, statusFilter, currentMonthDate]);

  const handleAction = async () => {
    if (!selectedLeave || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === "approve") {
        if (selectedLeave.status === "pending" && selectedLeave.first_approval_status === "pending") {
          await approveFirstLevel(selectedLeave.id, actionRemarks);
        } else {
          await approveFinalLevel(selectedLeave.id, actionRemarks);
        }
      } else if (actionType === "reject") {
        await rejectLeave(selectedLeave.id, actionRemarks || "Rejected by approver");
      }
      setSelectedLeave(null);
      setActionType(null);
      setActionRemarks("");
      loadApprovalQueue();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (statusStr: string) => {
    const s = statusStr.toLowerCase();
    const key: StatusKey =
      s === "approved" ? "on_leave"
      : s === "first_approved" ? "wfh"
      : s === "rejected" ? "absent"
      : s === "cancelled" ? "lwp"
      : "late";
    return <StatusBadge status={key} size="md" />;
  };

  const leaveColumns: Column<LeaveItem>[] = [
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
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
              {row.employee?.department_name ?? "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "leave_type",
      header: "Type",
      render: (_, row) => (
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-primary)", background: "rgba(79,70,229,0.08)", padding: "4px 8px", borderRadius: "6px" }}>
          {row.leave_type?.code ?? "LEAVE"}
        </span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (_, row) => (
        <span style={{ fontSize: "13px", fontWeight: 500 }}>
          {row.from_date} to {row.to_date} ({row.total_days} d)
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (v) => <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{String(v ?? "—")}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (v) => getStatusBadge(v as string),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Leave Lifecycle Management
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
            Manager & HR 2-stage approval workflow, team calendar, and leave balances
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--color-border)", paddingBottom: "1px" }}>
        {[
          { id: "approvals", label: `Pending Approvals (${approvalQueue.length})`, icon: Clock },
          { id: "calendar", label: "Team Calendar", icon: CalendarIcon },
          { id: "all_leaves", label: "All Leave Requests", icon: CalendarCheck },
          { id: "my_balances", label: "My Balances", icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", borderRadius: "10px 10px 0 0",
                fontSize: "14px", fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                background: isActive ? "var(--color-surface)" : "transparent",
                border: isActive ? "1px solid var(--color-border)" : "none",
                borderBottom: isActive ? "2px solid var(--color-primary)" : "none",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              <Icon size={16} color={isActive ? "var(--color-primary)" : "var(--color-text-secondary)"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: PENDING APPROVALS QUEUE */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "approvals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isApprovalsLoading ? (
            [1, 2].map((i) => <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "16px" }} />)
          ) : approvalQueue.length === 0 ? (
            <div className="card" style={{ padding: "60px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <CheckCircle2 size={48} color="#059669" />
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>No Pending Approvals</h3>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
                All leave requests requiring your review have been processed.
              </p>
            </div>
          ) : (
            approvalQueue.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: "20px 24px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                  <div
                    style={{
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: "var(--color-primary)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}
                  >
                    {item.employee?.full_name?.[0] ?? "E"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-text-primary)" }}>
                        {item.employee?.full_name}
                      </p>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-primary)", background: "rgba(79,70,229,0.1)", padding: "2px 8px", borderRadius: "4px" }}>
                        {item.leave_type?.code ?? "PL"}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                      {item.from_date} to {item.to_date} · <strong>{item.total_days} day(s)</strong>
                    </p>
                    {item.reason && (
                      <p style={{ fontSize: "12px", color: "var(--color-text-primary)", marginTop: "6px", fontStyle: "italic" }}>
                        "{item.reason}"
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    className="btn-ghost"
                    style={{ padding: "8px 16px", color: "#E11D48", borderColor: "rgba(225,29,72,0.3)" }}
                    onClick={() => { setSelectedLeave(item); setActionType("reject"); }}
                  >
                    <X size={15} /> Reject
                  </button>
                  <button
                    className="btn-primary"
                    style={{ padding: "8px 16px", background: "#059669" }}
                    onClick={() => { setSelectedLeave(item); setActionType("approve"); }}
                  >
                    <Check size={15} /> Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: TEAM CALENDAR */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}>
                <ChevronLeft size={16} />
              </button>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>
                {currentMonthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </h3>
              <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {calendarItems.length} employee leave record(s) this month
            </span>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            {isCalendarLoading ? (
              <div className="skeleton" style={{ height: "300px", borderRadius: "12px" }} />
            ) : (
              <CalendarGrid monthDate={currentMonthDate} items={calendarItems} />
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: ALL LEAVE REQUESTS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "all_leaves" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card" style={{ padding: "16px 20px", display: "flex", gap: "12px", alignItems: "center" }}>
            <Filter size={16} color="var(--color-text-secondary)" />
            <select className="input" style={{ width: "160px" }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="input" style={{ width: "160px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="first_approved">First Approved</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="card" style={{ padding: "24px" }}>
            <DataTable<LeaveItem>
              columns={leaveColumns}
              data={allLeaves}
              isLoading={isLeavesLoading}
              keyExtractor={(row) => row.id}
              searchPlaceholder="Search leave requests…"
              emptyState={{
                icon: <CalendarCheck size={40} color="var(--color-text-secondary)" />,
                title: "No leave records found",
              }}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: MY LEAVE BALANCES */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "my_balances" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isBalancesLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: "110px", borderRadius: "16px" }} />)}
            </div>
          ) : myBalances.length === 0 ? (
            <div className="card" style={{ padding: "60px", textAlign: "center" }}>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>No leave balances found for your account.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
              {myBalances.map((b) => {
                const used = Number(b.used_days) || 0;
                const total = Number(b.total_days) || 0;
                const pctUsed = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                return (
                  <div key={b.id} className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)", background: "rgba(79,70,229,0.08)", padding: "3px 8px", borderRadius: "6px" }}>
                        {b.leave_type_code ?? "LEAVE"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{b.year}</span>
                    </div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {b.leave_type_name ?? "Leave"}
                    </p>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                        <span>{b.balance_days} remaining</span>
                        <span>{used} / {total} used</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "9999px", background: "var(--color-background)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pctUsed}%`, background: "var(--color-primary)", borderRadius: "9999px" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Approve / Reject Confirmation Modal */}
      {selectedLeave && actionType && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "24px" }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>
                Confirm {actionType === "approve" ? "Approval" : "Rejection"}
              </h3>
              <button onClick={() => setSelectedLeave(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
              You are about to {actionType} leave for <strong>{selectedLeave.employee?.full_name}</strong> ({selectedLeave.total_days} days, {selectedLeave.from_date} to {selectedLeave.to_date}).
            </p>

            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>
                Remarks / Reason {actionType === "reject" && <span style={{ color: "#E11D48" }}>*</span>}
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder={actionType === "approve" ? "Optional remarks…" : "Reason for rejection…"}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-ghost" onClick={() => setSelectedLeave(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: actionType === "reject" ? "#E11D48" : "#059669" }}
                disabled={isSubmitting || (actionType === "reject" && !actionRemarks.trim())}
                onClick={handleAction}
              >
                {isSubmitting ? "Processing…" : `Confirm ${actionType === "approve" ? "Approval" : "Rejection"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
