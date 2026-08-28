# Personal Site Agent

> Give it a GitHub profile. It decides what your personal website should say and show.

This is the agent engine behind the next version of the portfolio product. It is intentionally separate from the production landing app while the workflow is still evolving.

## Why LangGraph

This is not a free-form "let the model write React" agent. The workflow has stable stages and explicit state:

```text
GitHub
  ↓
collect        deterministic public evidence
  ↓
understand     infer developer identity / positioning
  ↓
curate         choose representative projects + contributions
  ↓
compose        generate a strict SiteSpec JSON
  ↓
validate       deterministic evidence + structure checks
  ↓
repair ────────┘ (max 2 loops)
  ↓
SiteSpec
```

LangGraph owns orchestration. Model calls are intentionally thin and OpenAI-compatible, so model providers can be changed without changing the graph.

The renderer should consume `SiteSpec`; the model does **not** emit React/CSS directly.

## Run

Requires Node.js 20+.

```bash
cd site-agent
npm install
npm run dev -- --github wellorbetter --out site-spec.json
```

A GitHub URL also works:

```bash
npm run dev -- --github https://github.com/wellorbetter
```

Without a model API key the graph still runs using deterministic fallback decisions. This is useful for development and contract testing.

## Enable the model

The client uses an OpenAI-compatible `POST /chat/completions` API.

```powershell
$env:AGENT_MODEL_API_KEY="..."
$env:AGENT_MODEL_BASE_URL="https://api.openai.com/v1"
$env:AGENT_MODEL="gpt-5-mini"

npm run dev -- --github wellorbetter --intent "A personal site for Android systems job applications" --locale en --out site-spec.json
```

Compatible providers can use their OpenAI-compatible base URL/model name instead.

Optional GitHub authentication:

```powershell
$env:GITHUB_TOKEN="..."
```

This increases GitHub API limits. Never expose either token through a `VITE_*` variable.

## SiteSpec contract

The agent outputs a validated JSON object containing:

- identity: display name, role, headline, summary
- navigation and section order
- curated project references
- curated upstream contribution references
- per-item editorial copy
- visual direction (`mood`, `density`, `accent`, `surface`)
- rationale explaining major curation decisions

Every referenced project and PR must exist in the collected GitHub snapshot. Validation rejects hallucinated IDs and duplicate/invalid page structure.

## Product integration plan

1. Agent CLI + SiteSpec contract (this directory)
2. Add fixtures + evaluation cases for different developer profiles
3. Add a server endpoint that streams graph node progress
4. Build a SiteSpec renderer in `apps/landing`
5. Add natural-language edit commands that transform an existing SiteSpec
6. Persist user-approved SiteSpecs and optionally auto-refresh when GitHub changes

The product name is deliberately **not** `wellorbetter`; that is only one GitHub user / dogfooding profile.
