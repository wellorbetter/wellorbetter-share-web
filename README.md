# Personal Site Agent / wellorbetter Share Web

这个仓库现在包含两个公开产品面：

- `apps/landing` — **Personal Site Agent**：GitHub → Agent → SiteSpec → 可编辑个人主页
- `apps/share` — 文件分享 SPA
- `site-agent` — LangGraph JS 编排引擎（`collect → understand → curate → compose → validate → repair`）
- `packages/design` — 设计系统
- `packages/shared` — Share 前后端共享类型

## Personal Site Agent

产品入口不再把 `wellorbetter` 当品牌；它只是一个 dogfooding 用户样例。

- `/` — 产品首页：输入 GitHub 用户名和目标
- `/studio/:username` — Agent Studio：实时 Preview + 自然语言修改 + Undo + 本地草稿 + JSON 导出
- `/u/:username` — Agent 生成的公开个人主页
- `/portfolio/:username` — 旧版 Developer Portfolio / 招聘证据视图，保留作为兼容和调试入口
- `/lab` — 旧的个人 Lab 页面，保留作为视觉实验页

### 核心数据流

```text
GitHub public data
      ↓
collect / understand / curate
      ↓
validated SiteSpec
      ↓
stable React renderer
      ↕
Agent Studio edits
```

Agent 不直接生成任意 React/CSS。项目、PR 等引用必须存在于 GitHub snapshot；SiteSpec 在渲染前会校验和 repair。这样模型负责判断、策展和文案，Renderer 负责响应式、交互和可访问性。

### 无模型也可运行

公开产品默认使用 deterministic agent fallback，因此没有模型 Key 也能完成：

- GitHub 项目和外部 PR 采集
- 目标导向的项目重排（Android / AI / OSS 等）
- SiteSpec 生成与验证
- 常见自然语言编辑：极简、深色、技术感、某项目置顶/隐藏、突出 OSS / AI / Android、压缩文案
- Studio 草稿自动保存、Undo、JSON 导出、draft share URL

配置服务端模型后，同一个 `/api/site/generate` 和 `/api/site/edit` 自动升级成 AI 编辑。浏览器永远不接触模型 Key。

### 可选服务端模型

复制 `apps/landing/.dev.vars.example` 为 `.dev.vars`，仅在可信开发环境填写：

```text
AGENT_PUBLIC_AI_ENABLED=1
AGENT_MODEL_API_KEY=...
AGENT_MODEL_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=gpt-5-mini
```

支持 OpenAI-compatible `chat/completions` provider。公网付费 AI 必须显式把 `AGENT_PUBLIC_AI_ENABLED` 设为 `1`；否则产品仍运行 deterministic agent，不会产生模型费用。

`GITHUB_TOKEN` 同样是可选 secret，用于提高公开 GitHub API 限额和启用 GraphQL contribution activity。不要把任何 secret 写进 `VITE_*`、客户端 bundle 或仓库。

## Landing Worker API

- `GET /api/portfolio/:username` — 公开 GitHub portfolio snapshot
- `GET /api/site/:username?intent=&locale=` — 缓存的 deterministic SiteSpec + portfolio
- `POST /api/site/generate` — 按目标重新策展；有服务端模型时可升级为 AI
- `POST /api/site/edit` — 修改当前 SiteSpec；模型关闭时使用安全 deterministic fallback

请求体有大小限制，SiteSpec 会进行结构/证据校验；错误响应不缓存。公开 GET 使用 Cloudflare Cache API。

## LangGraph Agent Engine

`site-agent/` 是独立的编排引擎，当前不强耦合 Landing workspace：

```bash
cd site-agent
npm install
npm run dev -- --github wellorbetter --intent "Android systems job search" --locale en
```

没有模型 Key 时仍会 deterministic fallback；配置 `AGENT_MODEL_API_KEY` / `OPENAI_API_KEY` 后启用模型节点。独立 `.github/workflows/site-agent.yml` 会执行依赖安装、TypeScript 和真实 GitHub smoke test。

## 本地完整验收

仅跑 Vite 没有同源 Worker API。完整产品请：

```bash
npm ci
npm run build -w @wellorbetter/landing
cd apps/landing
npx wrangler dev
```

然后打开：

```text
http://localhost:8787/
http://localhost:8787/studio/wellorbetter
http://localhost:8787/u/wellorbetter
http://localhost:8787/portfolio/wellorbetter
```

## 构建与部署

```bash
npm run typecheck
npm run build
cd apps/landing && npx wrangler deploy
```

GitHub Actions 已包含 `main` 自动部署逻辑，但只有仓库存在以下 secrets 时 deploy step 才会执行：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

没有这些凭据时，CI 仍会完整执行 boundary / contract / typecheck / build，部署步骤会明确 `skipped`。

## 隐私和安全边界

- 默认只读取公开 GitHub 数据
- GitHub / Model token 只允许存在 Worker secret 或本地 `.dev.vars`
- SiteSpec 中的 repo / PR 引用必须能在 snapshot 中找到
- 公开付费 AI 默认关闭
- Draft share 把 SiteSpec 放在 URL fragment，fragment 不发送给服务器；正式多设备发布/账号系统后续再接持久化存储
