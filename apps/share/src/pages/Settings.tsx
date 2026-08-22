import { useEffect, useState } from "react";
import type { MeResponse } from "@wellorbetter/shared";
import { api, ApiError } from "../api.js";

export interface SettingsPageProps {
  onNavigate: (path: string) => void;
}

/**
 * Settings page — user profile (read-only).
 *
 * Loads current user via api.me() on mount.
 * Both display name and username are read-only until the backend
 * profile-update endpoint is available.
 *
 * TODO: Replace with api.updateProfile() when backend endpoint is available
 */
export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        setUser(res.user);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "加载用户信息失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>加载中…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>设置</h1>
        <p style={styles.errorText} role="alert">{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>设置</h1>

      {/* TODO: Replace with api.updateProfile() when backend endpoint is available */}
      <p style={styles.infoText} role="status">
        个人资料修改功能暂未开放
      </p>

      <div style={styles.form}>
        {/* Display name — read-only */}
        <div style={styles.field}>
          <label htmlFor="settings-display-name" style={styles.label}>
            显示名称
          </label>
          <input
            id="settings-display-name"
            type="text"
            value={user?.username ?? ""}
            readOnly
            style={{ ...styles.input, ...styles.inputReadOnly }}
            tabIndex={-1}
            aria-readonly="true"
          />
        </div>

        {/* Username — read-only */}
        <div style={styles.field}>
          <label htmlFor="settings-username" style={styles.label}>
            用户名
          </label>
          <input
            id="settings-username"
            type="text"
            value={user?.username ?? ""}
            readOnly
            style={{ ...styles.input, ...styles.inputReadOnly }}
            tabIndex={-1}
            aria-readonly="true"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- inline styles (visual spec from task graph) ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#333333",
    margin: "0 0 24px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#333333",
    marginBottom: 8,
  },
  input: {
    display: "block",
    width: "100%",
    height: 40,
    padding: "0 12px",
    fontSize: 16,
    color: "#333333",
    border: "1px solid #D1D1D1",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
  },
  inputReadOnly: {
    backgroundColor: "#F5F5F5",
    color: "#666666",
    cursor: "default",
  },
  infoText: {
    fontSize: 14,
    color: "#666666",
    margin: "0 0 20px 0",
    padding: "12px 16px",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    border: "1px solid #D1D1D1",
  },
  errorText: {
    fontSize: 14,
    color: "#DC3545",
    margin: "0 0 12px 0",
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center" as const,
  },
};
