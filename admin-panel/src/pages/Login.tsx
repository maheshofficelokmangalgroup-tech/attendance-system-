import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import apiClient from "@/api/client";
import { setAuth } from "@/store/authSlice";

const loginSchema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError("");
    try {
      const { data } = await apiClient.post("/auth/login", values);
      dispatch(setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      }));
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(msg ?? "Login failed. Please try again.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
        padding: "24px",
      }}
    >
      {/* Decorative blob */}
      <div
        style={{
          position: "fixed", top: "-20%", right: "-10%", width: "600px", height: "600px",
          borderRadius: "50%", background: "rgba(79,70,229,0.12)", filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed", bottom: "-20%", left: "-10%", width: "500px", height: "500px",
          borderRadius: "50%", background: "rgba(245,158,11,0.06)", filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%", maxWidth: "440px",
          background: "rgba(30, 41, 59, 0.8)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(51, 65, 85, 0.8)",
          borderRadius: "24px",
          padding: "48px 40px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              width: "56px", height: "56px", borderRadius: "16px",
              background: "linear-gradient(135deg, #4F46E5, #818CF8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(79,70,229,0.4)",
            }}
          >
            <Building2 size={28} color="#fff" />
          </div>
          <h1
            style={{
              fontFamily: "'Sora', sans-serif", fontSize: "26px", fontWeight: 700,
              color: "#F1F5F9", marginBottom: "6px",
            }}
          >
            AttendHR
          </h1>
          <p style={{ fontSize: "14px", color: "#94A3B8" }}>
            Sign in to your admin account
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94A3B8", marginBottom: "8px" }}>
              Email or Username
            </label>
            <input
              {...register("email")}
              type="text"
              autoComplete="username"
              placeholder="admin@company.com or Rohan@YRK"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.6)",
                border: `1.5px solid ${errors.email ? "#E11D48" : "rgba(51,65,85,0.8)"}`,
                color: "#F1F5F9", fontSize: "14px", outline: "none",
                transition: "border-color 150ms ease-out",
              }}
              onFocus={(e) => { if (!errors.email) (e.target as HTMLInputElement).style.borderColor = "#818CF8"; }}
              onBlur={(e) => { if (!errors.email) (e.target as HTMLInputElement).style.borderColor = "rgba(51,65,85,0.8)"; }}
            />
            {errors.email && <p style={{ fontSize: "12px", color: "#E11D48", marginTop: "6px" }}>{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94A3B8", marginBottom: "8px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "12px 44px 12px 14px", borderRadius: "10px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: `1.5px solid ${errors.password ? "#E11D48" : "rgba(51,65,85,0.8)"}`,
                  color: "#F1F5F9", fontSize: "14px", outline: "none",
                  transition: "border-color 150ms ease-out",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#64748B",
                  display: "flex", padding: "4px",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p style={{ fontSize: "12px", color: "#E11D48", marginTop: "6px" }}>{errors.password.message}</p>}
          </div>

          {/* Server error */}
          {serverError && (
            <div
              style={{
                padding: "12px 14px", borderRadius: "10px",
                background: "rgba(225, 29, 72, 0.12)", border: "1px solid rgba(225, 29, 72, 0.3)",
                fontSize: "13px", color: "#E11D48",
              }}
            >
              {serverError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "13px", borderRadius: "10px",
              background: isSubmitting ? "rgba(79,70,229,0.6)" : "linear-gradient(135deg, #4F46E5, #6366F1)",
              color: "#fff", fontSize: "15px", fontWeight: 600, border: "none", cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 16px rgba(79,70,229,0.4)",
              transition: "all 200ms ease-out",
              transform: "translateY(0)",
            }}
            onMouseEnter={(e) => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
          >
            {isSubmitting && <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />}
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "#64748B" }}>
          Forgot your password?{" "}
          <a href="/forgot-password" style={{ color: "#818CF8", fontWeight: 600 }}>Reset it</a>
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LoginPage;
