import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, CalendarCheck, Loader2, Trash2 } from "lucide-react";
import apiClient from "@/api/client";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  days_per_year: z.coerce.number().min(0).max(365),
  accrual_type: z.enum(["upfront", "monthly", "quarterly"]),
  carry_forward: z.boolean(),
  max_carry_forward_days: z.coerce.number().min(0),
  is_paid: z.boolean(),
});
type LTForm = z.infer<typeof schema>;

interface LeaveType { id: number; name: string; code: string; days_per_year: number; is_paid: boolean; is_active: boolean; }

const LeaveTypeSettings: React.FC = () => {
  const [items, setItems] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<LTForm>({
    resolver: zodResolver(schema),
    defaultValues: { accrual_type: "upfront", carry_forward: false, max_carry_forward_days: 0, is_paid: true, days_per_year: 0 },
  });

  const carryForward = watch("carry_forward");

  const load = () => {
    setIsLoading(true);
    apiClient.get("/leave-types?company_id=1")
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.data ?? []))
      .finally(() => setIsLoading(false));
  };
  useEffect(() => { load(); }, []);

  const onSubmit = async (values: LTForm) => {
    await apiClient.post("/leave-types", { ...values, company_id: 1 });
    reset(); setShowForm(false); load();
  };

  const remove = async (id: number) => {
    if (!confirm("Deactivate this leave type?")) return;
    await apiClient.delete(`/leave-types/${id}`);
    load();
  };

  return (
    <div style={{ maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(124,58,237,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CalendarCheck size={20} color="#7C3AED" />
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Leave Types</h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>PL, SL, CL, Comp-Off, LWP and custom types</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}><Plus size={15} /> Add Type</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {[
                { key: "name", label: "Name", placeholder: "Privilege Leave" },
                { key: "code", label: "Code", placeholder: "PL" },
                { key: "days_per_year", label: "Days/Year", type: "number" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>{label}</label>
                  <input className="input" type={type ?? "text"} {...register(key as keyof LTForm)} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Accrual Type</label>
                <select className="input" {...register("accrual_type")}>
                  <option value="upfront">Upfront (yearly)</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              {carryForward && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Max Carry Forward Days</label>
                  <input className="input" type="number" {...register("max_carry_forward_days")} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "24px" }}>
              {[
                { key: "is_paid", label: "Paid Leave" },
                { key: "carry_forward", label: "Carry Forward" },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--color-text-primary)" }}>
                  <input type="checkbox" {...register(key as "is_paid" | "carry_forward")} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: "8px" }}>
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "8px", margin: "8px" }} />)
        ) : items.filter((i) => i.is_active).map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "8px" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-background)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(124,58,237,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#7C3AED" }}>
              {item.code}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{item.name}</p>
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {item.days_per_year} days/year · {item.is_paid ? "Paid" : "Unpaid"}
              </p>
            </div>
            <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E11D48", padding: "4px" }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default LeaveTypeSettings;
