import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Clock, Trash2, Loader2 } from "lucide-react";
import apiClient from "@/api/client";

const shiftSchema = z.object({
  name: z.string().min(1, "Required"),
  start_time: z.string().min(1, "Required"),
  end_time: z.string().min(1, "Required"),
  grace_period_minutes: z.coerce.number().min(0).max(120),
  working_hours: z.coerce.number().min(0),
  half_day_hours: z.coerce.number().min(0),
});
type ShiftForm = z.infer<typeof shiftSchema>;

interface Shift { id: number; name: string; start_time: string; end_time: string; grace_period_minutes: number; working_hours: number; is_active: boolean; }

const ShiftSettings: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors: _errors, isSubmitting } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { grace_period_minutes: 15, working_hours: 8, half_day_hours: 4 },
  });

  const load = () => {
    setIsLoading(true);
    apiClient.get("/shifts?company_id=1")
      .then(({ data }) => setShifts(Array.isArray(data) ? data : data?.data ?? []))
      .finally(() => setIsLoading(false));
  };
  useEffect(() => { load(); }, []);

  const onSubmit = async (values: ShiftForm) => {
    await apiClient.post("/shifts", { ...values, company_id: 1 });
    reset(); setShowForm(false); load();
  };

  const deleteShift = async (id: number) => {
    if (!confirm("Deactivate this shift?")) return;
    await apiClient.delete(`/shifts/${id}`);
    load();
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={20} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Shifts</h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Work schedule configurations</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} /> Add Shift
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", marginBottom: "20px", color: "var(--color-text-primary)" }}>New Shift</h3>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Name *</label>
                <input className="input" {...register("name")} placeholder="Morning Shift" />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Start Time *</label>
                <input className="input" type="time" {...register("start_time")} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>End Time *</label>
                <input className="input" type="time" {...register("end_time")} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Grace (min)</label>
                <input className="input" type="number" {...register("grace_period_minutes")} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Working Hours</label>
                <input className="input" type="number" step="0.5" {...register("working_hours")} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>Half Day Hours</label>
                <input className="input" type="number" step="0.5" {...register("half_day_hours")} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={15} />}
                Create Shift
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "16px" }} />)
        ) : shifts.filter((s) => s.is_active).map((shift) => (
          <div key={shift.id} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(79,70,229,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text-primary)" }}>{shift.name}</p>
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {shift.start_time} – {shift.end_time} · {shift.working_hours}h · Grace {shift.grace_period_minutes}m
              </p>
            </div>
            <button onClick={() => deleteShift(shift.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E11D48", padding: "6px" }}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default ShiftSettings;
