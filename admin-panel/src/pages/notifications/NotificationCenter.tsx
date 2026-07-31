import React, { useEffect, useState } from "react";
import {
  Bell, CheckCheck, Clock, CalendarCheck, ShieldAlert, CheckCircle2, XCircle, Info,
} from "lucide-react";
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, NotificationItem,
} from "@/api/notifications";

const NotificationCenter: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    fetchNotifications(1, 50)
      .then((data) => {
        setItems(Array.isArray(data) ? data : (data as any)?.data ?? []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: number) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const filteredItems = items.filter((n) => (filter === "unread" ? !n.is_read : true));
  const unreadCount = items.filter((n) => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "leave_applied": return <CalendarCheck size={18} color="#4F46E5" />;
      case "leave_approved": return <CheckCircle2 size={18} color="#059669" />;
      case "leave_rejected": return <XCircle size={18} color="#E11D48" />;
      case "attendance_alert": return <ShieldAlert size={18} color="#D97706" />;
      default: return <Info size={18} color="#0284C7" />;
    }
  };

  return (
    <div style={{ maxWidth: "760px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "rgba(79,70,229,0.12)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Bell size={20} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Notifications
            </h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {unreadCount} unread alert(s)
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button className="btn-ghost" style={{ fontSize: "13px" }} onClick={handleMarkAllRead}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "10px" }}>
        <button
          className={filter === "all" ? "btn-primary" : "btn-ghost"}
          style={{ padding: "6px 14px", fontSize: "12px" }}
          onClick={() => setFilter("all")}
        >
          All ({items.length})
        </button>
        <button
          className={filter === "unread" ? "btn-primary" : "btn-ghost"}
          style={{ padding: "6px 14px", fontSize: "12px" }}
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />)
        ) : filteredItems.length === 0 ? (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--color-text-secondary)" }}>
            <Bell size={36} style={{ marginBottom: "8px", opacity: 0.5 }} />
            <p style={{ fontSize: "14px" }}>No notifications in this view.</p>
          </div>
        ) : (
          filteredItems.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "14px",
                background: n.is_read ? "var(--color-surface)" : "rgba(79, 70, 229, 0.04)",
                borderColor: n.is_read ? "var(--color-border)" : "rgba(79, 70, 229, 0.2)",
                cursor: "pointer",
              }}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
            >
              <div style={{ marginTop: "2px", flexShrink: 0 }}>
                {getIcon(n.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontWeight: n.is_read ? 500 : 700, fontSize: "14px", color: "var(--color-text-primary)" }}>
                    {n.title}
                  </p>
                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                  {n.body}
                </p>
              </div>
              {!n.is_read && (
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0, marginTop: "6px" }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
