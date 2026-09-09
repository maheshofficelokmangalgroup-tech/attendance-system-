import React, { useEffect, useState } from "react";
import {
  Monitor, CheckCircle2, Clock, Filter, Check, X, XCircle, Slash, Home,
} from "lucide-react";
import DataTable, { Column } from "@/components/ui/DataTable";
import {
  fetchPendingWfh, fetchAllWfh, approveWfh, rejectWfh, WfhItem,
} from "@/api/wfh";
import apiClient from "@/api/client";

// WFH requests have their own lifecycle (pending/approved/rejected/cancelled)
// distinct from the 12 attendance statuses StatusBadge/StatusKey model — a
// "pending" WFH request isn't an attendance state at all, so it gets its own
// small badge here instead of borrowing (and mislabeling as "Late") one of those.
const WFH_STATUS_STYLE: Record<string, { hex: string; bg: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  pending:   { hex: "#D97706", bg: "rgba(217,119,6,0.12)",  label: "Pending",   Icon: Clock },
  approved:  { hex: "#0D9488", bg: "rgba(13,148,136,0.12)", label: "Approved",  Icon: Home },
  rejected:  { hex: "#E11D48", bg: "rgba(225,29,72,0.12)",  label: "Rejected",  Icon: XCircle },
  cancelled: { hex: "#64748B", bg: "rgba(100,116,139,0.12)",label: "Cancelled", Icon: Slash },
};

const WfhStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const token = WFH_STATUS_STYLE[status.toLowerCase()] ?? WFH_STATUS_STYLE.pending;
  const { Icon } = token;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        borderRadius: "9999px", backgroundColor: token.bg, color: token.hex,
        fontWeight: 600, fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap",
      }}
      aria-label={`Status: ${token.label}`}
    >
      <Icon size={13} color={token.hex} aria-hidden="true" />
      {token.label}
    </span>
  );
};

type Tab = "approvals" | "all_requests";

interface Department { id: number; name: string; }

const WfhManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("approvals");

  // Approval Queue State
  const [pending, setPending] = useState<WfhItem[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(true);

  // Action Modal State
  const [selectedItem, setSelectedItem] = useState<WfhItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All Requests State
  const [allRequests, setAllRequests] = useState<WfhItem[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadPending = () => {
    setIsPendingLoading(true);
    fetchPendingWfh()
      .then((data) => setPending(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsPendingLoading(false));
  };

  const loadAllRequests = () => {
    setIsRequestsLoading(true);
    const params: any = { company_id: 1, page_size: 100 };
    if (deptFilter) params.department_id = deptFilter;
    if (statusFilter) params.status = statusFilter;

    fetchAllWfh(params)
      .then((data) => setAllRequests(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setIsRequestsLoading(false));
  };

  useEffect(() => {
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : data?.data ?? []))
      .catch(console.error);

    loadPending();
  }, []);

  useEffect(() => {
    if (activeTab === "all_requests") loadAllRequests();
  }, [activeTab, deptFilter, statusFilter]);

  const handleAction = async () => {
    if (!selectedItem || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === "approve") {
        await approveWfh(selectedItem.id);
      } else {
        await rejectWfh(selectedItem.id, actionRemarks || "Rejected by approver");
      }
      setSelectedItem(null);
      setActionType(null);
      setActionRemarks("");
      loadPending();
      if (activeTab === "all_requests") loadAllRequests();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestColumns: Column<WfhItem>[] = [
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
      key: "dates",
      header: "Dates",
      render: (_, row) => (
        <span style={{ fontSize: "13px", fontWeight: 500 }}>
          {row.from_date} to {row.to_date}
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
      render: (v) => <WfhStatusBadge status={v as string} />,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Work From Home Requests
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
            Single-stage approval — approving marks the requested dates' attendance as WFH
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--color-border)", paddingBottom: "1px" }}>
        {[
          { id: "approvals", label: `Pending Approvals (${pending.length})`, icon: Clock },
          { id: "all_requests", label: "All WFH Requests", icon: Monitor },
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
          {isPendingLoading ? (
            [1, 2].map((i) => <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "16px" }} />)
          ) : pending.length === 0 ? (
            <div className="card" style={{ padding: "60px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <CheckCircle2 size={48} color="#059669" />
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>No Pending WFH Requests</h3>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
                All Work From Home requests have been processed.
              </p>
            </div>
          ) : (
            pending.map((item) => (
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
                        WFH
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                      {item.from_date} to {item.to_date}
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
                    onClick={() => { setSelectedItem(item); setActionType("reject"); }}
                  >
                    <X size={15} /> Reject
                  </button>
                  <button
                    className="btn-primary"
                    style={{ padding: "8px 16px", background: "#059669" }}
                    onClick={() => { setSelectedItem(item); setActionType("approve"); }}
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
      {/* TAB 2: ALL WFH REQUESTS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "all_requests" && (
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
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="card" style={{ padding: "24px" }}>
            <DataTable<WfhItem>
              columns={requestColumns}
              data={allRequests}
              isLoading={isRequestsLoading}
              keyExtractor={(row) => row.id}
              searchPlaceholder="Search WFH requests…"
              emptyState={{
                icon: <Monitor size={40} color="var(--color-text-secondary)" />,
                title: "No WFH records found",
              }}
            />
          </div>
        </div>
      )}

      {/* Approve / Reject Confirmation Modal */}
      {selectedItem && actionType && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "24px" }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>
                Confirm {actionType === "approve" ? "Approval" : "Rejection"}
              </h3>
              <button onClick={() => setSelectedItem(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
              You are about to {actionType} the WFH request for <strong>{selectedItem.employee?.full_name}</strong> ({selectedItem.from_date} to {selectedItem.to_date}).
              {actionType === "approve" && " This will mark those dates as WFH in their attendance."}
            </p>

            {actionType === "reject" && (
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>
                  Reason for rejection <span style={{ color: "#E11D48" }}>*</span>
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Reason for rejection…"
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-ghost" onClick={() => setSelectedItem(null)}>Cancel</button>
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

export default WfhManagement;
