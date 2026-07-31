import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserPlus } from "lucide-react";
import DataTable, { type Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import apiClient from "@/api/client";

interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  employment_type: string;
  is_active: boolean;
}

const columns: Column<Employee>[] = [
  { key: "employee_code", header: "Code", sortable: true, width: "100px" },
  {
    key: "full_name",
    header: "Name",
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
          {row.full_name[0]}
        </div>
        <div>
          <p style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "14px" }}>{row.full_name}</p>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: "department",
    header: "Department",
    render: (_, row) => row.department?.name ?? "—",
  },
  {
    key: "designation",
    header: "Designation",
    render: (_, row) => row.designation?.name ?? "—",
  },
  {
    key: "employment_type",
    header: "Type",
    render: (v) => (
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "capitalize" }}>
        {String(v).replace("_", " ")}
      </span>
    ),
  },
  {
    key: "is_active",
    header: "Status",
    render: (v) => (
      <span
        style={{
          display: "inline-flex", padding: "3px 10px", borderRadius: "9999px",
          fontSize: "12px", fontWeight: 600,
          background: v ? "rgba(5,150,105,0.12)" : "rgba(225,29,72,0.12)",
          color: v ? "#059669" : "#E11D48",
        }}
      >
        {v ? "Active" : "Inactive"}
      </span>
    ),
  },
];

const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // In production, company_id comes from the logged-in user's context
    apiClient.get("/employees?company_id=1&page_size=100")
      .then(({ data }) => {
        setEmployees(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(() => setError("Failed to load employees"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Employees
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
            Manage employee records and user accounts
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate("/employees/new")}
          id="add-employee-btn"
        >
          <UserPlus size={16} />
          Add Employee
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", color: "#E11D48", fontSize: "14px" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "24px" }}>
        <DataTable<Employee>
          columns={columns}
          data={employees}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/employees/${row.id}/edit`)}
          searchPlaceholder="Search by name, email, or code…"
          emptyState={{
            icon: <UserPlus size={40} color="var(--color-text-secondary)" />,
            title: "No employees yet",
            action: (
              <button className="btn-primary" onClick={() => navigate("/employees/new")}>
                <Plus size={15} /> Add First Employee
              </button>
            ),
          }}
        />
      </div>
    </div>
  );
};

export default EmployeeList;
