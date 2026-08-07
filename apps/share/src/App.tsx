import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { icon } from "@wellorbetter/design";
import { api, isWeChat } from "./api.js";
import type { UserRole } from "@wellorbetter/shared";

// 路由级懒加载：首屏只下载当前页面（性能 H4）
const LoginPage = lazy(() => import("./pages/Login.js").then((m) => ({ default: m.LoginPage })));
const UploadPage = lazy(() => import("./pages/Upload.js").then((m) => ({ default: m.UploadPage })));
const ManagePage = lazy(() => import("./pages/Manage.js").then((m) => ({ default: m.ManagePage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsers.js").then((m) => ({ default: m.AdminUsersPage })));
const DownloadPage = lazy(() => import("./pages/Download.js").then((m) => ({ default: m.DownloadPage })));

export type Route =
  | { name: "login" }
  | { name: "upload" }
  | { name: "manage" }
  | { name: "admin-users" }
  | { name: "download"; id: string };

function parseRoute(path: string): Route {
  if (path === "/") return { name: "upload" };
  if (path === "/login") return { name: "login" };
  if (path === "/upload") return { name: "upload" };
  if (path === "/manage") return { name: "manage" };
  if (path === "/admin/users") return { name: "admin-users" };
  const m = path.match(/^\/f\/([^/]+)$/);
  if (m) return { name: "download", id: m[1]! };
  return { name: "upload" };
}

const ROUTE_TITLES: Record<Route["name"], string> = {
  login: "登录 · wellorbetter 文件分享",
  upload: "上传 · wellorbetter 文件分享",
  manage: "我的分享 · wellorbetter 文件分享",
  "admin-users": "用户管理 · wellorbetter 文件分享",
  download: "文件分享 · wellorbetter",
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  // 下载页是公开路由：跳过会话探测，减少一次网络请求（性能 H3）
  useEffect(() => {
    if (route.name === "download") return;
    api
      .me()
      .then((res) => {
        setRole(res.user.role);
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, [route.name]);

  useEffect(() => {
    document.title = ROUTE_TITLES[route.name];
  }, [route.name]);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setRoute(parseRoute(path));
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const isDownload = route.name === "download";
  const needsAuth = !isDownload && authed === false;

  useEffect(() => {
    if (needsAuth) navigate("/login");
  }, [needsAuth, navigate]);

  const header = !isDownload ? (
    <header className="app-nav">
      <button type="button" className="nav-brand" onClick={() => navigate("/upload")}>
        <span dangerouslySetInnerHTML={{ __html: icon("logo", 22) }} />
        <span>wellorbetter 文件分享</span>
      </button>
      {authed && (
        <nav className="nav-links">
          <button
            type="button"
            className={route.name === "upload" ? "nav-link is-active" : "nav-link"}
            onClick={() => navigate("/upload")}
          >
            <span dangerouslySetInnerHTML={{ __html: icon("upload", 16) }} />
            上传
          </button>
          <button
            type="button"
            className={route.name === "manage" ? "nav-link is-active" : "nav-link"}
            onClick={() => navigate("/manage")}
          >
            <span dangerouslySetInnerHTML={{ __html: icon("list", 16) }} />
            我的分享
          </button>
          {role === "admin" && (
            <button
              type="button"
              className={route.name === "admin-users" ? "nav-link is-active" : "nav-link"}
              onClick={() => navigate("/admin/users")}
            >
              <span dangerouslySetInnerHTML={{ __html: icon("users", 16) }} />
              用户管理
            </button>
          )}
          <button
            type="button"
            className="nav-link"
            onClick={() => {
              void api.logout().finally(() => navigate("/login"));
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: icon("logout", 16) }} />
            登出
          </button>
        </nav>
      )}
    </header>
  ) : null;

  if (isDownload) {
    return (
      <div className="app-shell">
        <Suspense fallback={<div className="loading-block">加载中…</div>}>
          <DownloadPage id={route.id} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {header}
      <main className="app-main">
        {authed === null ? (
          <div className="loading-block">加载中…</div>
        ) : (
          <Suspense fallback={<div className="loading-block">加载中…</div>}>
            {route.name === "login" ? (
              <LoginPage
                onAuthed={() => {
                  setAuthed(true);
                  void api.me().then((res) => setRole(res.user.role)).catch(() => setRole(null));
                  navigate("/upload");
                }}
              />
            ) : route.name === "upload" ? (
              <UploadPage />
            ) : route.name === "admin-users" ? (
              role === "admin" ? (
                <AdminUsersPage />
              ) : (
                <ManagePage />
              )
            ) : (
              <ManagePage />
            )}
          </Suspense>
        )}
      </main>
    </div>
  );
}

export { isWeChat };