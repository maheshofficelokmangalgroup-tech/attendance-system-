import React from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { User } from "lucide-react";

const Profile: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "24px" }}>
        My Profile
      </h1>
      <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary), #818CF8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px", fontWeight: 700, color: "#fff",
            boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
          }}
        >
          {user?.full_name?.[0]?.toUpperCase() ?? <User size={36} />}
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {user?.full_name ?? "—"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "4px" }}>{user?.email}</p>
          <span style={{
            display: "inline-flex", marginTop: "10px", padding: "4px 14px", borderRadius: "9999px",
            background: "rgba(79,70,229,0.12)", color: "var(--color-primary)", fontSize: "13px", fontWeight: 600,
            textTransform: "capitalize",
          }}>
            {user?.role_name}
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
          Profile editing (name, photo, password change) will be available after Phase 2 completes.
        </p>
      </div>
    </div>
  );
};
export default Profile;
