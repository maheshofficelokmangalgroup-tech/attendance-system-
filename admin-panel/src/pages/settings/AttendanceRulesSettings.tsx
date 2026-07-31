import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Loader2, SlidersHorizontal } from "lucide-react";
import apiClient from "@/api/client";

const schema = z.object({
  grace_period_minutes: z.coerce.number().min(0).max(120),
  half_day_hours: z.coerce.number().min(0),
  full_day_hours: z.coerce.number().min(0),
  overtime_threshold_minutes: z.coerce.number().min(0),
  comp_off_threshold_minutes: z.coerce.number().min(0),
  allow_wfh: z.boolean(),
  allow_on_duty: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const AttendanceRulesSettings: React.FC = () => {
  const [success, setSuccess] = React.useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      grace_period_minutes: 15, half_day_hours: 4, full_day_hours: 8,
      overtime_threshold_minutes: 30, comp_off_threshold_minutes: 240,
      allow_wfh: true, allow_on_duty: true,
    },
  });

  useEffect(() => {
    apiClient.get("/settings/attendance-rules/1")
      .then(({ data }) => data && reset(data))
      .catch(console.error);
  }, [reset]);

  const onSubmit = async (values: FormData) => {
    await apiClient.put("/settings/attendance-rules/1", values);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  interface AttendanceField {
    key: keyof FormData;
    label: string;
    help: string;
    type: string;
    step?: string;
  }

  const fields: AttendanceField[] = [
    { key: "grace_period_minutes", label: "Grace Period (minutes)", help: "Minutes allowed after shift start before marking Late", type: "number" },
    { key: "half_day_hours", label: "Half Day Threshold (hours)", help: "Minimum hours worked to count as a Half Day", type: "number", step: "0.5" },
    { key: "full_day_hours", label: "Full Day Threshold (hours)", help: "Minimum hours worked to count as a Full Day (Present)", type: "number", step: "0.5" },
    { key: "overtime_threshold_minutes", label: "Overtime Threshold (minutes)", help: "Extra minutes beyond shift end before counting as overtime", type: "number" },
    { key: "comp_off_threshold_minutes", label: "Comp-Off Threshold (minutes)", help: "Minimum extra minutes worked on a holiday to earn a Comp-Off", type: "number" },
  ];

  return (
    <div style={{ maxWidth: "680px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SlidersHorizontal size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Attendance Rules</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Configure grace period, thresholds, and policies</p>
        </div>
      </div>

      {success && <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(5,150,105,0.1)", color: "#059669", fontSize: "13px", marginBottom: "16px", border: "1px solid rgba(5,150,105,0.3)" }}>✓ Attendance rules saved</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {fields.map(({ key, label, help, type, step }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "6px" }}>{label}</label>
              <input className="input" type={type} step={step} {...register(key)} style={{ maxWidth: "200px" }} />
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>{help}</p>
            </div>
          ))}

          <div style={{ display: "flex", gap: "32px", paddingTop: "8px" }}>
            {[
              { key: "allow_wfh", label: "Allow Work From Home (WFH)", help: "Employees can mark WFH attendance" },
              { key: "allow_on_duty", label: "Allow On Duty", help: "Employees can mark attendance as On Duty (field work)" },
            ].map(({ key, label, help }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: "4px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" {...register(key as "allow_wfh" | "allow_on_duty")} style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }} />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "24px" }}>{help}</p>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
              Save Rules
            </button>
          </div>
        </div>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default AttendanceRulesSettings;
