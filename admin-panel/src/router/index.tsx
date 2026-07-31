import React, { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "@/pages/Login";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const EmployeeList = lazy(() => import("@/pages/employees/EmployeeList"));
const EmployeeForm = lazy(() => import("@/pages/employees/EmployeeForm"));
const CompanySettings = lazy(() => import("@/pages/settings/CompanySettings"));
const DepartmentSettings = lazy(() => import("@/pages/settings/DepartmentSettings"));
const DesignationSettings = lazy(() => import("@/pages/settings/DesignationSettings"));
const ShiftSettings = lazy(() => import("@/pages/settings/ShiftSettings"));
const HolidaySettings = lazy(() => import("@/pages/settings/HolidaySettings"));
const LeaveTypeSettings = lazy(() => import("@/pages/settings/LeaveTypeSettings"));
const AttendanceRulesSettings = lazy(() => import("@/pages/settings/AttendanceRulesSettings"));
const Profile = lazy(() => import("@/pages/Profile"));

const AttendanceList = lazy(() => import("@/pages/attendance/AttendanceList"));
const LeaveManagement = lazy(() => import("@/pages/leave/LeaveManagement"));
const ReportsHub = lazy(() => import("@/pages/reports/ReportsHub"));
const NotificationCenter = lazy(() => import("@/pages/notifications/NotificationCenter"));

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px" }}>
    <div className="skeleton" style={{ width: "100%", height: "400px", borderRadius: "16px" }} />
  </div>
);

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <Suspense fallback={<PageLoader />}><Dashboard /></Suspense> },
          { path: "/attendance", element: <Suspense fallback={<PageLoader />}><AttendanceList /></Suspense> },
          { path: "/leave", element: <Suspense fallback={<PageLoader />}><LeaveManagement /></Suspense> },
          { path: "/notifications", element: <Suspense fallback={<PageLoader />}><NotificationCenter /></Suspense> },
          { path: "/profile", element: <Suspense fallback={<PageLoader />}><Profile /></Suspense> },

          // Admin/HR-only: employee records and org/policy settings
          {
            element: <ProtectedRoute allowedRoles={["admin", "hr"]} />,
            children: [
              { path: "/employees", element: <Suspense fallback={<PageLoader />}><EmployeeList /></Suspense> },
              { path: "/employees/new", element: <Suspense fallback={<PageLoader />}><EmployeeForm /></Suspense> },
              { path: "/employees/:id/edit", element: <Suspense fallback={<PageLoader />}><EmployeeForm /></Suspense> },
              { path: "/settings/company", element: <Suspense fallback={<PageLoader />}><CompanySettings /></Suspense> },
              { path: "/settings/departments", element: <Suspense fallback={<PageLoader />}><DepartmentSettings /></Suspense> },
              { path: "/settings/designations", element: <Suspense fallback={<PageLoader />}><DesignationSettings /></Suspense> },
              { path: "/settings/shifts", element: <Suspense fallback={<PageLoader />}><ShiftSettings /></Suspense> },
              { path: "/settings/holidays", element: <Suspense fallback={<PageLoader />}><HolidaySettings /></Suspense> },
              { path: "/settings/leave-types", element: <Suspense fallback={<PageLoader />}><LeaveTypeSettings /></Suspense> },
              { path: "/settings/attendance-rules", element: <Suspense fallback={<PageLoader />}><AttendanceRulesSettings /></Suspense> },
            ],
          },

          // Admin/HR/Manager-only: reports (matches backend RBAC's "report" resource)
          {
            element: <ProtectedRoute allowedRoles={["admin", "hr", "manager"]} />,
            children: [
              { path: "/reports", element: <Suspense fallback={<PageLoader />}><ReportsHub /></Suspense> },
            ],
          },
        ],
      },
    ],
  },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
export default AppRouter;
