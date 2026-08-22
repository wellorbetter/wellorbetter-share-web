import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { icon } from "@wellorbetter/design";
import { api, isWeChat } from "./api.js";
import type { MeResponse } from "@wellorbetter/shared";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { AvatarDropdown } from "./components/AvatarDropdown.js";

// 路由级懒加载：首屏只下载当前页面（性能 H4）
const HomePage = lazy(() => import("./pages/Home.js").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("./pages/Login.js").then((m) => ({ default: m.LoginPage })));
const UploadPage = lazy(() => import("./pages/Upload.js").then((m) => ({ default: m.UploadPage })));
const ManagePage = lazy(() => import("./pages/Manage.js").then((m) => ({ default: m.ManagePage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsers.js").then((m) => ({ default: m.AdminUsersPage })));
const AdminUsagePage = lazy(() => import("./pages/AdminUsage.js").then((m) => ({ default: m.AdminUsagePage })));
const DownloadPage = lazy(() => import("./pages/Download.js").then((m) => ({ default: m.DownloadPage })));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetail.js").then((m) => ({ default: m.ProjectDetailPage })));
const PublishPage = lazy(() => import("./pages/Publish.js").then((m) => ({ default: m.PublishPage })));
const MyProjectsPage = lazy(() => import("./pages/MyProjects.js").then((m) => ({ default: m.MyProjectsPage })));
const AdminProjectsPage = lazy(() => import("./pages/AdminProjects.js").then((m) => ({ default: m.AdminProjectsPage })));
const SettingsPage = lazy(() => import("./pages/Settings.js").then((m) => ({ default: m.SettingsPage })));

export type Route =
  | { name: "home" }
  | { name: "login" }
  | { name: "upload" }
  | { name: "manage" }
  | { name: "admin-users" }
  | { name: "admin-usage" }
  | { name: "admin-projects" }
  | { name: "project-detail"; slug: string }
  | { name: "publish"; editId?: string }
  | { name: "my-projects" }
  | { name: "settings" }
  | { name: "download"; id: string };

function parseRoute(path: string): Route {
  if (path === "/" || path === "/home") return { name: "home" };
  if (path === "/login") return { name: "login" };
  if (path === "/upload") return { name: "upload" };
  if (path === "/manage") return { name: "manage" };
  if (path === "/admin/users") return { name: "admin-users" };
  if (path === "/admin/usage") return { name: "admin-usage" };
  if (path === "/admin/projects") return { name: "admin-projects" };
  if (path === "/my-projects") return { name: "my-projects" };
  if (path === "/settings") return { name: "settings" };
  if (path === "/publish") return { name: "publish" };
  const editMatch = path.match(/^\/publish\/([^/]+)$/);
  if (editMatch) return { name: "publish", editId: editMatch[1]! };
  const pMatch = path.match(/^\/p\/([^/]+)$/);
  if (pMatch) return { name: "project-detail", slug: pMatch[1]! };
  const m = path.match(/^\/f\/([^/]+)$/);
  if (m) return { name: "download", id: m[1]! };
  return { name: "home" };
}

const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "发现 · wellorbetter",
  login: "登录 · wellorbetter 文件分享",
  upload: "上传 · wellorbetter 文件分享",
  manage: "我的分享 · wellorbetter 文件分享",
  "admin-users": "用户管理 · wellorbetter 文件分享",
  "admin-usage": "用量与配额 · wellorbetter 文件分享",
  "admin-projects": "作品与举报管理 · wellorbetter",
  "project-detail": "作品 · wellorbetter",
  publish: "发布作品 · wellorbetter",
  "my-projects": "我的作品 · wellorbetter",
  settings: "设置 · wellorbetter",
  download: "文件分享 · wellorbetter",
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [meUser, setMeUser] = useState<MeResponse["user"] | null>(null);
  const role = meUser?.role ?? null;

  // 会话探测只做一次（下载页是公开路由，跳过；登录后再由 onAuthed 刷新角色）。
  // 原实现依赖 [route.name] 每次切路由都请求 /api/me 且存在竞态，改为 ref 守卫（性能 H3）
  const meChecked = useRef(false);
  useEffect(() => {
    if (route.name === "download" || meChecked.current) return;
    meChecked.current = true;
    api
      .me()
      .then((res) => {
        setMeUser(res.user);
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
  // Home (discovery feed), project detail and download pages are public.
  const publicRoutes = isDownload || route.name === "home" || route.name === "project-detail";
  const needsAuth = !publicRoutes && authed === false;

  useEffect(() => {
    if (needsAuth) navigate("/login");
  }, [needsAuth, navigate]);

  const header = !isDownload ? (
    <header className="app-nav">
      <button type="button" className="nav-brand" onClick={() => navigate("/")}>
        <span dangerouslySetInnerHTML={{ __html: icon("logo", 22) }} />
        <span>wellorbetter</span>
      </button>
      <div className="nav-controls">
        {authed && meUser ? (
          <AvatarDropdown
            user={{ name: meUser.username, username: meUser.username, role: meUser.role }}
            onNavigate={navigate}
            onSignOut={() => {
              void api.logout().finally(() => {
                setAuthed(false);
                setMeUser(null);
                navigate("/login");
              });
            }}
          />
        ) : authed === false ? (
          <button
            type="button"
            className="nav-link"
            onClick={() => navigate("/login")}
          >
            登录
          </button>
        ) : (
          <span className="avatar-placeholder" aria-hidden="true" />
        )}
        <ThemeToggle />
      </div>
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

  // Home page is public — no auth required
  if (route.name === "home") {
    return (
      <div className="app-shell">
        {header}
        <main className="app-main app-main--wide">
          <Suspense fallback={<div className="loading-block">加载中…</div>}>
            <HomePage
              isAuthed={authed === true}
              onPublish={() => navigate("/publish")}
              onLogin={() => navigate("/login")}
              onOpenProject={(slug) => navigate(`/p/${slug}`)}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Project detail is public — no auth required
  if (route.name === "project-detail") {
    return (
      <div className="app-shell">
        {header}
        <main className="app-main app-main--wide">
          <Suspense fallback={<div className="loading-block">加载中…</div>}>
            <ProjectDetailPage slug={route.slug} onBack={() => navigate("/")} />
          </Suspense>
        </main>
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
                  void api.me().then((res) => setMeUser(res.user)).catch(() => setMeUser(null));
                  navigate("/");
                }}
              />
            ) : route.name === "upload" ? (
              <UploadPage />
            ) : route.name === "publish" ? (
              <PublishPage editId={route.editId} onPublished={() => navigate("/my-projects")} />
            ) : route.name === "my-projects" ? (
              <MyProjectsPage
                onEdit={(id) => navigate(`/publish/${id}`)}
                onView={(slug) => navigate(`/p/${slug}`)}
              />
            ) : route.name === "admin-users" ? (
              role === "admin" ? (
                <AdminUsersPage />
              ) : (
                <ManagePage />
              )
            ) : route.name === "admin-usage" ? (
              role === "admin" ? (
                <AdminUsagePage />
              ) : (
                <ManagePage />
              )
            ) : route.name === "admin-projects" ? (
              role === "admin" ? (
                <AdminProjectsPage />
              ) : (
                <ManagePage />
              )
            ) : route.name === "settings" ? (
              <SettingsPage onNavigate={(path) => navigate(path)} />
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
