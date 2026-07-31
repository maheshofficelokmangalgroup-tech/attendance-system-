import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export const AppLayout: React.FC = () => {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-background)" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "32px",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
