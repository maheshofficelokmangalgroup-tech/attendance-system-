import React, { useEffect, useState } from "react";
import { Plus, Save, Loader2, Building2, Edit2 } from "lucide-react";
import apiClient from "@/api/client";

interface Company {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

interface CompanyFormValues {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: CompanyFormValues = { name: "", address: "", phone: "", email: "" };

const CompanyForm: React.FC<{
  values: CompanyFormValues;
  onChange: (v: CompanyFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string;
  saveLabel: string;
}> = ({ values, onChange, onSave, onCancel, isSaving, error, saveLabel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
    {error && (
      <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(225,29,72,0.1)", color: "#E11D48", fontSize: "13px", border: "1px solid rgba(225,29,72,0.3)" }}>
        {error}
      </div>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <div>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "5px" }}>
          Company Name <span style={{ color: "#E11D48" }}>*</span>
        </label>
        <input className="input" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} placeholder="YRK Ventures" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "5px" }}>Email</label>
        <input className="input" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} placeholder="hr@company.com" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "5px" }}>Phone</label>
        <input className="input" value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} placeholder="+91-22-12345678" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "5px" }}>Address</label>
        <input className="input" value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} placeholder="123 Business Park, Mumbai" />
      </div>
    </div>
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
      <button type="button" className="btn-ghost" onClick={onCancel} style={{ padding: "7px 14px", fontSize: "13px" }}>Cancel</button>
      <button type="button" className="btn-primary" onClick={onSave} disabled={isSaving || !values.name.trim()} style={{ padding: "7px 14px", fontSize: "13px" }}>
        {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
        {isSaving ? "Saving…" : saveLabel}
      </button>
    </div>
  </div>
);

const CompanySettings: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addValues, setAddValues] = useState<CompanyFormValues>(EMPTY_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<CompanyFormValues>(EMPTY_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const load = () => {
    setIsLoading(true);
    apiClient.get("/companies")
      .then(({ data }) => setCompanies((Array.isArray(data) ? data : (data as { data?: Company[] })?.data) ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setIsAdding(true);
    setAddError("");
    try {
      await apiClient.post("/companies", {
        name: addValues.name.trim(),
        address: addValues.address.trim() || undefined,
        phone: addValues.phone.trim() || undefined,
        email: addValues.email.trim() || undefined,
      });
      setAddValues(EMPTY_FORM);
      setShowAddForm(false);
      load();
    } catch (err: unknown) {
      setAddError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to add company");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (c: Company) => {
    setEditingId(c.id);
    setEditValues({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    setIsSavingEdit(true);
    setEditError("");
    try {
      await apiClient.put(`/companies/${editingId}`, {
        name: editValues.name.trim(),
        address: editValues.address.trim() || undefined,
        phone: editValues.phone.trim() || undefined,
        email: editValues.email.trim() || undefined,
      });
      setEditingId(null);
      load();
    } catch (err: unknown) {
      setEditError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={20} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>Companies</h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Organisations managed in this account</p>
          </div>
        </div>
        {!showAddForm && (
          <button className="btn-primary" onClick={() => { setShowAddForm(true); setAddValues(EMPTY_FORM); setAddError(""); }}>
            <Plus size={15} /> Add New Company
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "14px" }}>NEW COMPANY</p>
          <CompanyForm
            values={addValues}
            onChange={setAddValues}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setAddError(""); }}
            isSaving={isAdding}
            error={addError}
            saveLabel="Add Company"
          />
        </div>
      )}

      {isLoading ? (
        <div className="skeleton" style={{ height: "120px", borderRadius: "16px" }} />
      ) : companies.length === 0 ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)" }}>No companies yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {companies.map((c) => (
            <div key={c.id} className="card" style={{ padding: "20px" }}>
              {editingId === c.id ? (
                <>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "14px" }}>EDIT COMPANY</p>
                  <CompanyForm
                    values={editValues}
                    onChange={setEditValues}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                    isSaving={isSavingEdit}
                    error={editError}
                    saveLabel="Save Changes"
                  />
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>{c.name}</p>
                      {!c.is_active && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#E11D48" }}>INACTIVE</span>
                      )}
                    </div>
                    {c.address && <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "4px" }}>{c.address}</p>}
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                      {c.phone ?? "—"} · {c.email ?? "—"}
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={() => startEdit(c)} style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Edit2 size={13} /> Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
export default CompanySettings;
