# wellorbetter Share Web

`wellorbetterai.com` 前端（**公开仓库**）：Developer Portfolio + 文件分享应用。

- `apps/share` — 文件分享 SPA（上传 / 我的分享 / 用户管理 / 用量与配额 / 下载页），路由级懒加载
- `apps/landing` — 个人工程主页 + Developer Portfolio Renderer（中英双语、深浅色主题）
- `packages/design` — 设计系统（CSS 变量、SVG 图标）
- `packages/shared` — 与后端共享的类型与常量（与私有仓库 `wellorbetter/wellorbetter-api` 同步维护）

## Developer Portfolio

主站同时承担两个角色：

- `/` — `wellorbetter` 的精编个人主页：代表作品、设计叙事与 GitHub Portfolio 生成入口
- `/u/:username` — 通用公开 Developer Portfolio：读取公开 GitHub 数据，展示 profile、原创仓库、技术栈、PR 与 upstream/open-source contributions

Portfolio 数据由 `wellorbetter-api` 的 `GET /api/portfolio/:username` 聚合并在 Cloudflare KV 缓存。浏览器不持有 GitHub token；匿名 MVP 只读取公开 GitHub 数据。

这意味着 `wellorbetter` 自己的求职作品集也是这套 Portfolio Renderer 的 dogfooding / showcase，而不是单独维护的一份静态模板。

部署在 Cloudflare Workers Static Assets（React 18 + Vite）：

| 域名 | 应用 |
|---|---|
| `share.wellorbetterai.com` | 文件分享 SPA |
| `wellorbetterai.com` / `www` | 个人主页 + Developer Portfolio |

API 走 `api.wellorbetterai.com`（见 `VITE_API_BASE`，未配置时 landing 默认使用生产 API；share 本地开发走 Vite 代理到 `localhost:8788`）。

## 从 0 搭建

完整部署指南（域名 → Cloudflare → R2/D1/KV → secrets → 部署 → 配额管理）：[wellorbetter-api/docs/DEPLOY-FROM-SCRATCH.md](https://github.com/wellorbetter/wellorbetter-api/blob/main/docs/DEPLOY-FROM-SCRATCH.md)

## 本地开发

```bash
npm ci
cd apps/share && npx vite --port 5173    # 分享应用（/api 代理到 :8788）
cd apps/landing && npx vite              # 主页 / Portfolio
```

访问 `http://localhost:5173/u/wellorbetter` 可验收通用 Portfolio 路由；本地联调 API 时可通过 `VITE_API_BASE` 指向对应 Worker。

## 构建与部署

```bash
npm run build   # 两个应用都构建到各自 dist/
cd apps/share && npx wrangler deploy
cd apps/landing && npx wrangler deploy
```

CI 部署需要 GitHub Actions secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。

## 静态资源优化

- `public/_headers`：`/assets/*` 哈希资源 `immutable` 长缓存，页面与 API 不缓存
- 路由级 `React.lazy`：Share 首屏只下载当前页面
- Landing Worker 使用 SPA fallback，因此 `/u/:username` 刷新后仍返回 React 入口
- 下载页为公开路由，跳过登录会话探测
