import React, { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Loader2, GitBranch } from "lucide-react";
import apiClient from "@/api/client";

interface Department { id: number; name: string; is_active: boolean; }

const DepartmentSettings: React.FC = () => {
  const [items, setItems] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setIsLoading(true);
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => setItems((Array.isArray(data) ? data : (data as { data?: Department[] })?.data) ?? []))
      .catch(() => setError("Failed to load departments"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiClient.post("/departments", { company_id: 1, name: newName.trim() });
      setNewName(""); load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const update = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(`/departments/${id}`, { name: editName.trim() });
      setEditId(null); load();
    } finally { setSaving(false); }
  };

  const deactivate = async (id: number) => {
    if (!confirm("Deactivate this department?")) return;
    await apiClient.delete(`/departments/${id}`);
    load();
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GitBranch size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Departments</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Manage your organisation's departments</p>
        </div>
      </div>

      {error && <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(225,29,72,0.1)", color: "#E11D48", fontSize: "13px", marginBottom: "16px", border: "1px solid rgba(225,29,72,0.3)" }}>{error}</div>}

      {/* Add new */}
      <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>ADD DEPARTMENT</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            className="input"
            placeholder="Department name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={create} disabled={saving || !newName.trim()}>
            {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={15} />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: "8px" }}>
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "8px", margin: "8px" }} />)
        ) : items.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)" }}>No departments yet</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px", borderRadius: "8px",
                transition: "background 150ms ease-out",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-background)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {editId === item.id ? (
                <>
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && update(item.id)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button onClick={() => update(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#059669" }}><Save size={16} /></button>
                  <button onClick={() => setEditId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}><X size={16} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)" }}>{item.name}</span>
                  {!item.is_active && <span style={{ fontSize: "11px", color: "#E11D48", fontWeight: 600 }}>INACTIVE</span>}
                  <button onClick={() => { setEditId(item.id); setEditName(item.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "4px" }}><Edit2 size={15} /></button>
                  <button onClick={() => deactivate(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E11D48", padding: "4px" }}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default DepartmentSettings;
