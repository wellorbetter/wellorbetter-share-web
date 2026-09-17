---
name: wellorbetter-brand
description: Use when designing any wellorbetterai.com surface — landing, blog, vibecoding showcase, share. Warm-neutral paper-and-ink editorial system: Fraunces display, Instrument Sans body, JetBrains Mono technical register, single terracotta accent. Replaces the old Material 3 stock-blue seed.
---

# wellorbetter — paper-and-ink editorial

Load `tokens/colors_and_type.css` first. Reference semantic variables only
(`--text-primary`, `--surface-raised`, `--accent`), never raw ones
(`--ink-1`, `--paper-2`, `--accent-terracotta`).

## The one-line brief

Warm paper, dark warm ink, one terracotta accent, editorial serif headlines,
mono for anything technical. It should feel like a well-set notebook from
someone who ships — not a SaaS landing page.

## Non-negotiables

- **CJK first.** The site is zh-CN. Every font stack names a CJK face
  explicitly (`Noto Serif SC` / `Noto Sans SC`). Never ship a stack that
  leaves Chinese to per-glyph fallback — the Latin and Chinese stop matching.
- **`.eyebrow` on Chinese drops the uppercase transform.** Letter-spaced
  uppercase is a Latin device; it mangles Chinese. The `:lang(zh)` rule
  handles this — keep `lang` attributes correct.
- **Neutrals stay warm.** Chroma ≤ 0.02, hue 55–80. A grey-blue neutral
  breaks the whole system.
- **One accent does the work.** Terracotta is primary. Moss is for
  shipped/online status only. Never introduce a third hue.
- **Small radii.** 3/5/8px. No pill buttons, no `rounded-2xl` cards.

## Banned, specifically

These are the things the old site did, or the things an agent reaches for
by default:

- Material 3 palettes, or anything seeded from `#445E91`.
- Stripe purple `#635bff` (it is hardcoded ~20× in the old `presentation.css`).
- Inter, Roboto, Arial, or a bare `-apple-system` system stack.
- Bluish-purple gradient backgrounds.
- Rounded cards with a colored left-border accent strip.
- Emoji standing in for icons.
- Gradient overload. The only atmosphere is `.grain`.

## Type roles at a glance

| Role | Family | Where |
|---|---|---|
| `h1` / `h2` / `h3` | Fraunces + Noto Serif SC | hero, section titles, project names |
| lead | Instrument Sans | hero sub, section sub |
| body | Instrument Sans + Noto Sans SC | descriptions, prose |
| `.eyebrow` | JetBrains Mono | `VIBE CODING LAB`, `RECENT SHIPS`, `HOW I BUILD`, status, tags, numerals |

Fraunces is variable: `SOFT` 28 and `WONK` 1 are set globally. That is the
"有个性但不怪" dial — do not push them higher per-component.

## Status mapping

Project status never gets its own palette:

- 已发布 / 在线 / Shipped → `--status-shipped` (moss)
- 实验中 / Alpha / Experiment → `--status-experiment` (terracotta)
- Plugin / draft → `--status-neutral` (ink-2 on paper-3)

## Motion

One or two moments per page, not a dozen micro-interactions. Use
`--dur-base` with `--ease-out`. `prefers-reduced-motion` is already honored
in the tokens file.
