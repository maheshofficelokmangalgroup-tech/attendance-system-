import React, { useEffect, useState } from "react";
import { Plus, Trash2, Flag, Loader2 } from "lucide-react";
import apiClient from "@/api/client";

interface Holiday { id: number; name: string; date: string; type: string; }

const typeColors: Record<string, string> = {
  national: "#0284C7", regional: "#0D9488", optional: "#D97706", company: "#7C3AED",
};

const HolidaySettings: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: "", date: "", type: "national" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    apiClient.get("/holidays?company_id=1")
      .then(({ data }) => setHolidays(Array.isArray(data) ? data : data?.data ?? []))
      .finally(() => setIsLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.date) return;
    setSaving(true);
    await apiClient.post("/holidays", { ...form, company_id: 1 });
    setForm({ name: "", date: "", type: "national" });
    load(); setSaving(false);
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this holiday?")) return;
    await apiClient.delete(`/holidays/${id}`);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div style={{ maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(2,132,199,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flag size={20} color="#0284C7" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Holidays</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Annual holiday calendar</p>
        </div>
      </div>

      <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>ADD HOLIDAY</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "10px", alignItems: "flex-end" }}>
          <input className="input" placeholder="Holiday name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="national">National</option>
            <option value="regional">Regional</option>
            <option value="optional">Optional</option>
            <option value="company">Company</option>
          </select>
          <button className="btn-primary" onClick={create} disabled={saving || !form.name || !form.date}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: "8px" }}>
        {isLoading ? (
          [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "8px", margin: "8px" }} />)
        ) : holidays.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)" }}>No holidays configured</div>
        ) : holidays.sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "8px" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-background)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: typeColors[h.type] ?? "#64748B", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{h.name}</p>
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {h.type}
              </p>
            </div>
            <button onClick={() => remove(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E11D48", padding: "4px" }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default HolidaySettings;
