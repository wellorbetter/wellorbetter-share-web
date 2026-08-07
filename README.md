# wellorbetter Share Web

`wellorbetterai.com` 前端（**公开仓库**）：文件分享应用 + 落地页。

- `apps/share` — 文件分享 SPA（上传 / 我的分享 / 用户管理 / 下载页），路由级懒加载
- `apps/landing` — 落地页（中英双语、深浅色主题）
- `packages/design` — 设计系统（CSS 变量、SVG 图标）
- `packages/shared` — 与后端共享的类型与常量（与私有仓库 `wellorbetter/wellorbetter-api` 同步维护）

部署在 Cloudflare Workers Static Assets（React 18 + Vite）：

| 域名 | 应用 |
|---|---|
| `share.wellorbetterai.com` | 文件分享 SPA |
| `wellorbetterai.com` / `www` | 落地页 |

API 走 `api.wellorbetterai.com`（见 `VITE_API_BASE`，本地开发走 Vite 代理到 `localhost:8788`）。

## 本地开发

```bash
npm ci
cd apps/share && npx vite --port 5173    # 分享应用（/api 代理到 :8788）
cd apps/landing && npx vite              # 落地页
```

## 构建与部署

```bash
npm run build   # 两个应用都构建到各自 dist/
cd apps/share && npx wrangler deploy
cd apps/landing && npx wrangler deploy
```

CI 部署需要 GitHub Actions secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。

## 静态资源优化

- `public/_headers`：`/assets/*` 哈希资源 `immutable` 长缓存，页面与 API 不缓存
- 路由级 `React.lazy`：首屏只下载当前页面
- 下载页为公开路由，跳过登录会话探测