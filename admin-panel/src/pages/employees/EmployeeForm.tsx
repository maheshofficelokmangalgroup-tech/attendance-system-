import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Save, Loader2, CheckCircle2, Copy, Check, Eye, EyeOff, KeyRound, RefreshCw,
  Camera, Plus, Trash2, PackageCheck, Undo2,
} from "lucide-react";
import apiClient from "@/api/client";

const schema = z.object({
  employee_code: z.string().min(1, "Required"),
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  company_id: z.coerce.number().min(1, "Required"),
  department_id: z.coerce.number().optional(),
  designation_id: z.coerce.number().optional(),
  shift_id: z.coerce.number().optional(),
  role_id: z.coerce.number().min(1, "Required"),
  date_of_joining: z.string().min(1, "Required"),
  employment_type: z.enum(["full_time", "part_time", "contract", "intern"]),
  is_active: z.boolean().optional(),
  password: z.union([z.string().min(6, "Min 6 characters"), z.literal("")]).optional(),
  username: z.string().optional(),
  // Address
  permanent_address: z.string().optional(),
  present_address: z.string().optional(),
  same_as_permanent: z.boolean().optional(),
  // Emergency contact
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relation: z.string().optional(),
  // KYC & bank details
  aadhar_number: z.string().optional(),
  pan_number: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc_code: z.string().optional(),
  bank_name: z.string().optional(),
  education_qualification: z.string().optional(),
  education_institution: z.string().optional(),
  education_year: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface SelectOption { id: number; name: string; }

interface EmployeeDetail {
  email: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company_id: number;
  department: SelectOption | null;
  designation: SelectOption | null;
  shift: SelectOption | null;
  role_id: number | null;
  date_of_joining: string;
  employment_type: FormData["employment_type"];
  is_active: boolean;
  permanent_address: string | null;
  present_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  photo_path: string | null;
}

interface KycDetail {
  aadhar_number: string | null;
  pan_number: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  education_qualification: string | null;
  education_institution: string | null;
  education_year: number | null;
}

interface AssetItem {
  id: number;
  asset_name: string;
  asset_type: string | null;
  serial_number: string | null;
  assigned_date: string;
  return_date: string | null;
  condition_notes: string | null;
  status: "assigned" | "returned" | "damaged" | "lost";
}

const unwrap = <T,>(data: unknown): T => (data as { data?: T })?.data ?? (data as T);

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p style={{ fontSize: "12px", color: "#E11D48", marginTop: "4px" }}>{message}</p> : null;

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode; error?: string }> = ({
  label, required, children, error,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
      {label}{required && <span style={{ color: "#E11D48" }}> *</span>}
    </label>
    {children}
    <FieldError message={error} />
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{ paddingTop: "8px", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--color-text-primary)" }}>{title}</h2>
    {subtitle && <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>{subtitle}</p>}
  </div>
);

const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [designations, setDesignations] = useState<SelectOption[]>([]);
  const [shifts, setShifts] = useState<SelectOption[]>([]);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(isEdit);
  const [serverError, setServerError] = useState("");
  const [credentialsResult, setCredentialsResult] = useState<{ email: string; username?: string; password: string; mode: "created" | "reset" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);

  // Inline "Reset Password" panel (edit mode only)
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  // Assets Assigned (edit mode only)
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ asset_name: "", asset_type: "", serial_number: "", assigned_date: todayStr(), condition_notes: "" });
  const [assetError, setAssetError] = useState("");
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  const {
    register, handleSubmit, watch, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: 1, employment_type: "full_time" },
  });

  const deptId = watch("department_id");
  const passwordValue = watch("password");
  const sameAsPermanent = watch("same_as_permanent");
  const permanentAddress = watch("permanent_address");

  useEffect(() => {
    // Load dropdowns
    Promise.all([
      apiClient.get("/departments?company_id=1&page_size=100"),
      apiClient.get("/shifts?company_id=1"),
    ]).then(([depts, shiftsRes]) => {
      setDepartments((Array.isArray(depts.data) ? depts.data : (depts.data as { data?: SelectOption[] })?.data) ?? []);
      setShifts((Array.isArray(shiftsRes.data) ? shiftsRes.data : shiftsRes.data?.data) ?? []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (deptId) {
      apiClient.get(`/designations?department_id=${deptId}`)
        .then(({ data }) => setDesignations(Array.isArray(data) ? data : data?.data ?? []))
        .catch(console.error);
    }
  }, [deptId]);

  // Keep "Present Address" mirrored to "Permanent Address" while the checkbox is checked
  useEffect(() => {
    if (sameAsPermanent) setValue("present_address", permanentAddress ?? "");
  }, [sameAsPermanent, permanentAddress, setValue]);

  const loadAssets = (employeeId: string) => {
    setIsLoadingAssets(true);
    apiClient.get(`/employees/${employeeId}/assets`)
      .then(({ data }) => setAssets(unwrap<AssetItem[]>(data) ?? []))
      .catch(console.error)
      .finally(() => setIsLoadingAssets(false));
  };

  // Load the existing employee's data and prefill the form in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    setIsLoadingEmployee(true);
    Promise.all([
      apiClient.get(`/employees/${id}`),
      apiClient.get(`/employees/${id}/kyc`).catch(() => null),
    ])
      .then(([empRes, kycRes]) => {
        const emp = unwrap<EmployeeDetail>(empRes.data);
        const kyc = kycRes ? unwrap<KycDetail | null>(kycRes.data) : null;
        reset({
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          phone: emp.phone ?? "",
          company_id: emp.company_id,
          department_id: emp.department?.id,
          designation_id: emp.designation?.id,
          shift_id: emp.shift?.id,
          role_id: emp.role_id ?? undefined,
          date_of_joining: emp.date_of_joining,
          employment_type: emp.employment_type,
          is_active: emp.is_active,
          permanent_address: emp.permanent_address ?? "",
          present_address: emp.present_address ?? "",
          emergency_contact_name: emp.emergency_contact_name ?? "",
          emergency_contact_phone: emp.emergency_contact_phone ?? "",
          emergency_contact_relation: emp.emergency_contact_relation ?? "",
          aadhar_number: kyc?.aadhar_number ?? "",
          pan_number: kyc?.pan_number ?? "",
          bank_account_number: kyc?.bank_account_number ?? "",
          bank_ifsc_code: kyc?.bank_ifsc_code ?? "",
          bank_name: kyc?.bank_name ?? "",
          education_qualification: kyc?.education_qualification ?? "",
          education_institution: kyc?.education_institution ?? "",
          education_year: kyc?.education_year ? String(kyc.education_year) : "",
        });
        // department_id must be set before the designation-loading effect fires
        if (emp.department?.id) setValue("department_id", emp.department.id);
        setExistingPhotoPath(emp.photo_path ?? null);
        loadAssets(id);
      })
      .catch(() => setServerError("Failed to load employee details"))
      .finally(() => setIsLoadingEmployee(false));
  }, [isEdit, id, reset, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const uploadPhotoIfNeeded = async (employeeId: number) => {
    if (!photoFile) return;
    const form = new FormData();
    form.append("photo", photoFile);
    await apiClient.post(`/employees/${employeeId}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const saveKycIfNeeded = async (employeeId: number, values: FormData) => {
    const kycPayload = {
      aadhar_number: values.aadhar_number || undefined,
      pan_number: values.pan_number || undefined,
      bank_account_number: values.bank_account_number || undefined,
      bank_ifsc_code: values.bank_ifsc_code || undefined,
      bank_name: values.bank_name || undefined,
      education_qualification: values.education_qualification || undefined,
      education_institution: values.education_institution || undefined,
      education_year: values.education_year ? Number(values.education_year) : undefined,
    };
    const hasData = Object.values(kycPayload).some((v) => v !== undefined);
    if (!hasData) return;
    await apiClient.put(`/employees/${employeeId}/kyc`, kycPayload);
  };

  const onSubmit = async (values: FormData) => {
    setServerError("");
    const {
      same_as_permanent: _sameAsPermanent,
      aadhar_number: _aadhar, pan_number: _pan, bank_account_number: _bank,
      bank_ifsc_code: _ifsc, bank_name: _bankName,
      education_qualification: _eduQ, education_institution: _eduI, education_year: _eduY,
      ...corePayload
    } = values;
    try {
      if (isEdit) {
        const { password: _password, employee_code: _code, email: _email, ...updatePayload } = corePayload;
        await apiClient.put(`/employees/${id}`, updatePayload);
        await saveKycIfNeeded(Number(id), values);
        await uploadPhotoIfNeeded(Number(id));
        navigate("/employees");
      } else {
        const { data } = await apiClient.post("/employees", corePayload);
        const created = unwrap<{ id: number }>(data);
        await saveKycIfNeeded(created.id, values);
        await uploadPhotoIfNeeded(created.id);
        // Backend uses the given password, or falls back to the employee code
        // (see EmployeeService.create) — surface whichever was actually used.
        setCredentialsResult({
          email: values.email,
          username: values.username || undefined,
          password: values.password || values.employee_code,
          mode: "created",
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(msg ?? "Failed to save employee");
    }
  };

  const handleResetPassword = async () => {
    if (!id || resetPassword.trim().length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }
    setResetError("");
    setIsResetting(true);
    try {
      await apiClient.post(`/employees/${id}/reset-password`, { new_password: resetPassword.trim() });
      setCredentialsResult({ email: watch("email"), password: resetPassword.trim(), mode: "reset" });
      setShowResetPanel(false);
      setResetPassword("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setResetError(msg ?? "Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!credentialsResult) return;
    const text = `Email: ${credentialsResult.email}\nPassword: ${credentialsResult.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAddAsset = async () => {
    if (!id) return;
    if (!newAsset.asset_name.trim()) {
      setAssetError("Asset name is required");
      return;
    }
    setAssetError("");
    setIsSavingAsset(true);
    try {
      await apiClient.post(`/employees/${id}/assets`, {
        asset_name: newAsset.asset_name.trim(),
        asset_type: newAsset.asset_type || undefined,
        serial_number: newAsset.serial_number || undefined,
        assigned_date: newAsset.assigned_date,
        condition_notes: newAsset.condition_notes || undefined,
      });
      setNewAsset({ asset_name: "", asset_type: "", serial_number: "", assigned_date: todayStr(), condition_notes: "" });
      setShowAddAsset(false);
      loadAssets(id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAssetError(msg ?? "Failed to assign asset");
    } finally {
      setIsSavingAsset(false);
    }
  };

  const handleMarkReturned = async (assetId: number) => {
    if (!id) return;
    await apiClient.put(`/employees/${id}/assets/${assetId}`, {
      status: "returned",
      return_date: todayStr(),
    });
    loadAssets(id);
  };

  const handleRemoveAsset = async (assetId: number) => {
    if (!id) return;
    await apiClient.delete(`/employees/${id}/assets/${assetId}`);
    loadAssets(id);
  };

  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" } as const;
  const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" } as const;

  if (credentialsResult) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(5,150,105,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <CheckCircle2 size={28} color="#059669" />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "6px" }}>
            {credentialsResult.mode === "created" ? "Employee Created" : "Password Reset"}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "24px" }}>
            Share these login details with the employee. They should log in to the mobile app{credentialsResult.mode === "created" ? " and change their password" : " with this new password"}.
          </p>

          <div style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "18px", textAlign: "left", marginBottom: "20px" }}>
            {credentialsResult.username && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "2px" }}>USERNAME (LOGIN)</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "monospace" }}>{credentialsResult.username}</p>
              </div>
            )}
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "2px" }}>EMAIL{credentialsResult.username ? "" : " (LOGIN)"}</p>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "monospace" }}>{credentialsResult.email}</p>
            </div>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "2px" }}>
                {credentialsResult.mode === "created" ? "TEMPORARY PASSWORD" : "NEW PASSWORD"}
              </p>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "monospace" }}>{credentialsResult.password}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="btn-ghost" onClick={handleCopyCredentials} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {copied ? <Check size={15} color="#059669" /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy Credentials"}
            </button>
            <button className="btn-primary" onClick={() => navigate("/employees")}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button className="btn-ghost" onClick={() => navigate("/employees")} style={{ padding: "8px 12px" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {isEdit ? "Edit Employee" : "Add Employee"}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {isEdit ? "Update employee information and role" : "Create a new employee and linked user account"}
          </p>
        </div>
      </div>

      {serverError && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", color: "#E11D48", fontSize: "14px", marginBottom: "20px" }}>
          {serverError}
        </div>
      )}

      {isLoadingEmployee ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)" }}>
          Loading employee details…
        </div>
      ) : (
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <SectionHeader title="Photo" />
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%", overflow: "hidden",
              background: "var(--color-background)", border: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {photoPreview || existingPhotoPath ? (
                <img
                  src={photoPreview ?? existingPhotoPath ?? undefined}
                  alt="Employee"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Camera size={24} color="var(--color-text-secondary)" />
              )}
            </div>
            <div>
              <label className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <Camera size={14} /> {photoPreview || existingPhotoPath ? "Change Photo" : "Upload Photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: "none" }} />
              </label>
              <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "6px" }}>JPEG, PNG or WEBP</p>
            </div>
          </div>

          <SectionHeader title="Personal Information" />

          <div style={grid2}>
            <FormField label="First Name" required error={errors.first_name?.message}>
              <input className="input" {...register("first_name")} placeholder="John" />
            </FormField>
            <FormField label="Last Name" required error={errors.last_name?.message}>
              <input className="input" {...register("last_name")} placeholder="Doe" />
            </FormField>
          </div>

          <div style={grid2}>
            <FormField label="Email" required error={errors.email?.message}>
              <input
                className="input"
                type="email"
                {...register("email")}
                placeholder="john.doe@company.com"
                disabled={isEdit}
                title={isEdit ? "Email can't be changed here — it's the employee's login username" : undefined}
              />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <input className="input" {...register("phone")} placeholder="+91 98765 43210" />
            </FormField>
          </div>

          <div style={grid2}>
            <FormField label="Employee Code" required error={errors.employee_code?.message}>
              <input className="input" {...register("employee_code")} placeholder="EMP001" disabled={isEdit} />
            </FormField>
            <FormField label="Date of Joining" required error={errors.date_of_joining?.message}>
              <input className="input" type="date" {...register("date_of_joining")} />
            </FormField>
          </div>

          {!isEdit && (
            <FormField label="Username (optional)" error={errors.username?.message}>
              <input className="input" {...register("username")} placeholder="e.g. Rohan@YRK — leave blank to log in with email" />
            </FormField>
          )}

          {!isEdit && (
            <FormField label="Login Password" error={errors.password?.message}>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Leave blank to use Employee Code as password"
                    style={{ paddingRight: "40px", width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setValue("password", generatePassword()); setShowPassword(true); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
                >
                  <RefreshCw size={14} /> Generate
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                {passwordValue ? "This will be the employee's initial login password." : "Blank = employee logs in with their Employee Code as the password."}
              </p>
            </FormField>
          )}

          <SectionHeader title="Address" />

          <FormField label="Permanent Address">
            <textarea className="input" rows={2} {...register("permanent_address")} placeholder="House no, street, city, state, PIN" />
          </FormField>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" {...register("same_as_permanent")} />
            Present address same as permanent
          </label>

          <FormField label="Present Address">
            <textarea
              className="input"
              rows={2}
              {...register("present_address")}
              disabled={sameAsPermanent}
              placeholder="House no, street, city, state, PIN"
            />
          </FormField>

          <SectionHeader title="Emergency Contact" />

          <div style={grid3}>
            <FormField label="Contact Name">
              <input className="input" {...register("emergency_contact_name")} placeholder="Full name" />
            </FormField>
            <FormField label="Contact Phone">
              <input className="input" {...register("emergency_contact_phone")} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Relation">
              <input className="input" {...register("emergency_contact_relation")} placeholder="e.g. Father, Spouse" />
            </FormField>
          </div>

          <SectionHeader title="KYC & Bank Details" subtitle="Visible to Admin and HR only" />

          <div style={grid2}>
            <FormField label="Aadhar Number">
              <input className="input" {...register("aadhar_number")} placeholder="XXXX XXXX XXXX" maxLength={20} />
            </FormField>
            <FormField label="PAN Number">
              <input className="input" {...register("pan_number")} placeholder="ABCDE1234F" maxLength={20} />
            </FormField>
          </div>

          <div style={grid3}>
            <FormField label="Bank Account Number">
              <input className="input" {...register("bank_account_number")} maxLength={30} />
            </FormField>
            <FormField label="IFSC Code">
              <input className="input" {...register("bank_ifsc_code")} maxLength={15} />
            </FormField>
            <FormField label="Bank Name">
              <input className="input" {...register("bank_name")} maxLength={150} />
            </FormField>
          </div>

          <div style={grid3}>
            <FormField label="Highest Qualification">
              <input className="input" {...register("education_qualification")} placeholder="e.g. B.Tech" />
            </FormField>
            <FormField label="Institution">
              <input className="input" {...register("education_institution")} placeholder="e.g. Mumbai University" />
            </FormField>
            <FormField label="Year of Passing">
              <input className="input" type="number" {...register("education_year")} placeholder="2020" />
            </FormField>
          </div>

          <SectionHeader title="Work Details" />

          <div style={grid2}>
            <FormField label="Department" error={errors.department_id?.message}>
              <select className="input" {...register("department_id")}>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Designation" error={errors.designation_id?.message}>
              <select className="input" {...register("designation_id")} disabled={!deptId}>
                <option value="">Select Designation</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
          </div>

          <div style={grid2}>
            <FormField label="Shift" error={errors.shift_id?.message}>
              <select className="input" {...register("shift_id")}>
                <option value="">Select Shift</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Employment Type" required error={errors.employment_type?.message}>
              <select className="input" {...register("employment_type")}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </FormField>
          </div>

          <FormField label="Role" required error={errors.role_id?.message}>
            <select className="input" {...register("role_id")}>
              <option value="">Select Role</option>
              <option value="1">Admin</option>
              <option value="2">HR</option>
              <option value="3">Manager</option>
              <option value="4">Employee</option>
            </select>
          </FormField>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "16px", borderTop: "1px solid var(--color-border)" }}>
            <button type="button" className="btn-ghost" onClick={() => navigate("/employees")}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} id="save-employee-btn">
              {isSubmitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />}
              {isSubmitting ? "Saving…" : "Save Employee"}
            </button>
          </div>
        </div>
      </form>
      )}

      {isEdit && !isLoadingEmployee && (
        <div className="card" style={{ padding: "24px", marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <KeyRound size={17} color="var(--color-text-secondary)" />
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Login Password</p>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Set a new password for this employee's account</p>
              </div>
            </div>
            {!showResetPanel && (
              <button className="btn-ghost" onClick={() => { setShowResetPanel(true); setResetPassword(generatePassword()); }}>
                Reset Password
              </button>
            )}
          </div>

          {showResetPanel && (
            <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid var(--color-border)" }}>
              {resetError && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", color: "#E11D48", fontSize: "13px", marginBottom: "14px" }}>
                  {resetError}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    className="input"
                    type={resetShowPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    style={{ paddingRight: "40px", width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => setResetShowPassword((v) => !v)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}
                  >
                    {resetShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button type="button" className="btn-ghost" onClick={() => setResetPassword(generatePassword())} style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                  <RefreshCw size={14} /> Generate
                </button>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="btn-ghost" onClick={() => { setShowResetPanel(false); setResetError(""); }}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" disabled={isResetting} onClick={handleResetPassword}>
                  {isResetting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <KeyRound size={15} />}
                  {isResetting ? "Setting…" : "Set New Password"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isEdit && !isLoadingEmployee && (
        <div className="card" style={{ padding: "24px", marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <PackageCheck size={17} color="var(--color-text-secondary)" />
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Assets Assigned</p>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Company assets currently or previously issued to this employee</p>
              </div>
            </div>
            {!showAddAsset && (
              <button className="btn-ghost" onClick={() => setShowAddAsset(true)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={14} /> Assign Asset
              </button>
            )}
          </div>

          {assetError && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", color: "#E11D48", fontSize: "13px", marginBottom: "14px" }}>
              {assetError}
            </div>
          )}

          {showAddAsset && (
            <div style={{ padding: "16px", background: "var(--color-background)", borderRadius: "10px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={grid2}>
                <FormField label="Asset Name" required>
                  <input className="input" value={newAsset.asset_name} onChange={(e) => setNewAsset({ ...newAsset, asset_name: e.target.value })} placeholder="e.g. Dell Latitude Laptop" />
                </FormField>
                <FormField label="Asset Type">
                  <input className="input" value={newAsset.asset_type} onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })} placeholder="e.g. Laptop, ID Card" />
                </FormField>
              </div>
              <div style={grid2}>
                <FormField label="Serial Number">
                  <input className="input" value={newAsset.serial_number} onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })} />
                </FormField>
                <FormField label="Assigned Date" required>
                  <input className="input" type="date" value={newAsset.assigned_date} onChange={(e) => setNewAsset({ ...newAsset, assigned_date: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Notes">
                <input className="input" value={newAsset.condition_notes} onChange={(e) => setNewAsset({ ...newAsset, condition_notes: e.target.value })} placeholder="Condition, accessories, etc." />
              </FormField>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-ghost" onClick={() => { setShowAddAsset(false); setAssetError(""); }}>Cancel</button>
                <button type="button" className="btn-primary" disabled={isSavingAsset} onClick={handleAddAsset}>
                  {isSavingAsset ? "Saving…" : "Assign"}
                </button>
              </div>
            </div>
          )}

          {isLoadingAssets ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Loading assets…</p>
          ) : assets.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>No assets assigned yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {assets.map((asset) => (
                <div key={asset.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--color-border)",
                }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {asset.asset_name}
                      {asset.asset_type && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> · {asset.asset_type}</span>}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                      Assigned {asset.assigned_date}
                      {asset.serial_number ? ` · S/N ${asset.serial_number}` : ""}
                      {asset.return_date ? ` · Returned ${asset.return_date}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px",
                      background: asset.status === "assigned" ? "rgba(5,150,105,0.12)" : "rgba(100,116,139,0.12)",
                      color: asset.status === "assigned" ? "#059669" : "var(--color-text-secondary)",
                      textTransform: "capitalize",
                    }}>
                      {asset.status}
                    </span>
                    {asset.status === "assigned" && (
                      <button type="button" className="btn-ghost" title="Mark returned" onClick={() => handleMarkReturned(asset.id)} style={{ padding: "6px" }}>
                        <Undo2 size={14} />
                      </button>
                    )}
                    <button type="button" className="btn-ghost" title="Remove" onClick={() => handleRemoveAsset(asset.id)} style={{ padding: "6px" }}>
                      <Trash2 size={14} color="#E11D48" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default EmployeeForm;
