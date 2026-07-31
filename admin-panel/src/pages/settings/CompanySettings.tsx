import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Loader2, Building2 } from "lucide-react";
import apiClient from "@/api/client";

const schema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

const CompanySettings: React.FC = () => {
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    apiClient.get("/companies/1")
      .then(({ data }) => reset(data ?? {}))
      .catch(console.error);
  }, [reset]);

  const onSubmit = async (values: FormData) => {
    setServerError(""); setSuccess(false);
    try {
      await apiClient.put("/companies/1", values);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setServerError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to save");
    }
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Building2 size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Company</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Organisation information and branding</p>
        </div>
      </div>

      {serverError && <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(225,29,72,0.1)", color: "#E11D48", fontSize: "13px", marginBottom: "16px", border: "1px solid rgba(225,29,72,0.3)" }}>{serverError}</div>}
      {success && <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(5,150,105,0.1)", color: "#059669", fontSize: "13px", marginBottom: "16px", border: "1px solid rgba(5,150,105,0.3)" }}>✓ Company details saved</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {[
            { key: "name", label: "Company Name", placeholder: "Acme Corp", required: true },
            { key: "address", label: "Address", placeholder: "123 Business Park, Mumbai" },
            { key: "phone", label: "Phone", placeholder: "+91-22-12345678" },
            { key: "email", label: "Email", placeholder: "hr@company.com" },
          ].map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "6px" }}>
                {label}{required && <span style={{ color: "#E11D48" }}> *</span>}
              </label>
              <input
                className="input"
                {...register(key as keyof FormData)}
                placeholder={placeholder}
              />
              {errors[key as keyof FormData] && (
                <p style={{ fontSize: "12px", color: "#E11D48", marginTop: "4px" }}>
                  {errors[key as keyof FormData]?.message}
                </p>
              )}
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
              Save Changes
            </button>
          </div>
        </div>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default CompanySettings;
