import React, { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Tag } from "lucide-react";
import apiClient from "@/api/client";

interface Designation { id: number; name: string; department_id: number; is_active: boolean; }
interface Department { id: number; name: string; }

const DesignationSettings: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [items, setItems] = useState<Designation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get("/departments?company_id=1&page_size=100")
      .then(({ data }) => {
        const list: Department[] = (data as { data?: Department[] })?.data ?? [];
        setDepartments(list);
        if (list.length > 0) setSelectedDept(list[0].id);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDept) return;
    setIsLoading(true);
    apiClient.get(`/designations?department_id=${selectedDept}`)
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.data ?? []))
      .finally(() => setIsLoading(false));
  }, [selectedDept]);

  const create = async () => {
    if (!newName.trim() || !selectedDept || saving) return;
    setSaving(true);
    try {
      await apiClient.post("/designations", { department_id: selectedDept, name: newName.trim() });
      setNewName("");
      const { data } = await apiClient.get(`/designations?department_id=${selectedDept}`);
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await apiClient.put(`/designations/${id}`, { name: editName });
      setEditId(null);
      const { data } = await apiClient.get(`/designations?department_id=${selectedDept}`);
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (saving || !confirm("Deactivate this designation?")) return;
    setSaving(true);
    try {
      await apiClient.delete(`/designations/${id}`);
      setItems((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Tag size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Designations</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Job titles per department</p>
        </div>
      </div>

      <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "8px" }}>Select Department</label>
        <select className="input" value={selectedDept ?? ""} onChange={(e) => setSelectedDept(Number(e.target.value))}>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {selectedDept && (
        <>
          <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>ADD DESIGNATION</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <input className="input" placeholder="Designation name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} style={{ flex: 1 }} />
              <button className="btn-primary" onClick={create} disabled={!newName.trim() || saving}>
                <Plus size={15} /> Add
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: "8px" }}>
            {isLoading ? (
              [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "8px", margin: "8px" }} />)
            ) : items.filter((i) => i.is_active).map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "8px" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-background)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                {editId === item.id ? (
                  <>
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && update(item.id)} style={{ flex: 1 }} autoFocus />
                    <button onClick={() => update(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#059669" }}><Save size={16} /></button>
                    <button onClick={() => setEditId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}><X size={16} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: "14px", fontWeight: 500 }}>{item.name}</span>
                    <button onClick={() => { setEditId(item.id); setEditName(item.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}><Edit2 size={15} /></button>
                    <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E11D48" }}><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
export default DesignationSettings;
