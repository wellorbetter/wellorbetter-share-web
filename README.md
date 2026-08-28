# wellorbetter Share Web

`wellorbetterai.com` 前端（**公开仓库**）：Developer Portfolio + 文件分享应用。

- `apps/share` — 文件分享 SPA（上传 / 我的分享 / 用户管理 / 用量与配额 / 下载页），路由级懒加载
- `apps/landing` — 个人工程主页 + Developer Portfolio Renderer + 同源 GitHub Portfolio BFF
- `packages/design` — 设计系统（CSS 变量、SVG 图标）
- `packages/shared` — 与后端共享的类型与常量（与私有仓库 `wellorbetter/wellorbetter-api` 同步维护）

## Developer Portfolio

主站同时承担三个角色：

- `/` — `wellorbetter` 的精编个人主页：代表作品、设计叙事与 GitHub Portfolio 生成入口
- `/u/:username` — 通用公开 Developer Portfolio：profile、原创仓库、技术栈、PR、upstream/open-source contributions 与 GitHub Activity
- `/u/wellorbetter?view=recruiter` — 求职视图：压缩普通 activity 噪声，优先显示代表项目、Engineering Stories 与 upstream 证据

Landing Worker 默认直接提供同源 `GET /api/portfolio/:username`，所以公开产品不依赖私有后端是否已部署。Worker 从 GitHub REST 聚合公开 profile / repositories / PR，并用 Cloudflare Cache API 做边缘缓存；浏览器不持有 GitHub token。

可选配置 `GITHUB_TOKEN` 后，Worker 还会通过 GitHub GraphQL `ContributionsCollection` 获取真实 contribution calendar、commits / issues / PR / reviews 和活跃仓库。未配置 token 时这部分自动降级，基础 Portfolio 仍然可用。

`VITE_API_BASE` 仍然保留，用于本地联调或未来切换到 `wellorbetter-api` 的统一 Portfolio API。默认不配置时使用主站同源 BFF。

这意味着 `wellorbetter` 自己的求职作品集也是这套 Portfolio Renderer 的 dogfooding / showcase，而不是单独维护的一份静态模板。

部署在 Cloudflare Workers Static Assets（React 18 + Vite）：

| 域名 | 应用 |
|---|---|
| `share.wellorbetterai.com` | 文件分享 SPA |
| `wellorbetterai.com` / `www` | 个人主页 + Developer Portfolio + Portfolio BFF |

## 本地开发

```bash
npm ci
cd apps/share && npx vite --port 5173    # 分享应用（/api 代理到 :8788）
cd apps/landing && npx vite              # 主页 / Portfolio UI
```

仅运行 Vite 时 `/u/:username` UI 可以加载，但同源 Worker API 不存在；完整联调有两种方式：

```bash
# 方式 1：使用已部署 API
VITE_API_BASE=https://api.wellorbetterai.com npx vite

# 方式 2：构建后运行 Landing Worker
npm run build -w @wellorbetter/landing
cd apps/landing && npx wrangler dev
```

访问 `/u/wellorbetter` 验收完整 Portfolio，访问 `/u/wellorbetter?view=recruiter` 验收求职视图。

## 构建与部署

```bash
npm run build   # 两个应用都构建到各自 dist/
cd apps/share && npx wrangler deploy
cd apps/landing && npx wrangler deploy
```

CI 部署需要 GitHub Actions secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。

完整 GitHub Activity 为可选增强；如需开启：

```bash
cd apps/landing
npx wrangler secret put GITHUB_TOKEN
```

不要把 GitHub token 写入仓库、Vite 环境变量或客户端 bundle。

## 静态资源与缓存

- `public/_headers`：`/assets/*` 哈希资源 `immutable` 长缓存
- Landing Worker 使用 SPA fallback，因此 `/u/:username` 直接刷新仍返回 React 入口
- `/api/portfolio/:username` 由 Worker 同源处理并通过 Cloudflare Cache API 缓存；错误响应不缓存
- GitHub GraphQL Activity 获取失败时只降级 Activity 区，不影响公开项目和 PR 数据
- Share 下载页为公开路由，跳过登录会话探测
