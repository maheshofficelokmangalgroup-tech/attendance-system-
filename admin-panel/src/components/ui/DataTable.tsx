import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Inbox } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyState?: { icon?: React.ReactNode; title: string; action?: React.ReactNode };
  searchable?: boolean;
  searchPlaceholder?: string;
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: "14px 16px" }}>
        <div className="skeleton" style={{ height: "16px", width: "80%", borderRadius: "6px" }} />
      </td>
    ))}
  </tr>
);

/**
 * Shared DataTable — sticky header, column sort, search, skeleton rows,
 * and a real empty state. Used on every list screen.
 */
function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  emptyState,
  searchable = true,
  searchPlaceholder = "Search…",
  keyExtractor,
  onRowClick,
  stickyHeader = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const processed = useMemo(() => {
    let rows = [...data];
    if (search) {
      const term = search.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row as Record<string, unknown>).some((v) => String(v ?? "").toLowerCase().includes(term))
      );
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sortKey] ?? "");
        const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [data, search, sortKey, sortDir]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {searchable && (
        <div style={{ position: "relative", maxWidth: "320px" }}>
          <Search
            size={15}
            color="var(--color-text-secondary)"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            className="input"
            style={{ paddingLeft: "36px" }}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search table"
          />
        </div>
      )}

      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead
            style={{
              position: stickyHeader ? "sticky" : "static",
              top: 0,
              background: "var(--color-surface)",
              zIndex: 1,
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "var(--color-text-secondary)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                    width: col.width,
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key
                        ? sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        : <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
            ) : processed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: "60px 24px", textAlign: "center" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    {emptyState?.icon ?? <Inbox size={40} color="var(--color-text-secondary)" />}
                    <p style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
                      {emptyState?.title ?? "No data found"}
                    </p>
                    {emptyState?.action}
                  </div>
                </td>
              </tr>
            ) : (
              processed.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-background)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ padding: "14px 16px", color: "var(--color-text-primary)" }}
                    >
                      {col.render
                        ? col.render((row as Record<string, unknown>)[col.key], row)
                        : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
