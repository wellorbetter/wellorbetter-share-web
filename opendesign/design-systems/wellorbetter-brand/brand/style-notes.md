# Visual foundations

## Color roles

Not a swatch list — what each color is *for*.

**Warm neutrals carry everything.** Hue 55–80, chroma ≤ 0.02. Four paper
steps and three ink steps handle every surface and every text level. If a
design needs a fifth surface, the layout is too busy.

| Role | Use |
|---|---|
| `--surface-page` | the page ground |
| `--surface-raised` | project cards, anything that lifts off the page |
| `--surface-sunken` | code blocks, terminal visuals, inset panels |
| `--surface-pressed` | active/pressed state, progress tracks |
| `--text-primary` | headlines and body |
| `--text-secondary` | descriptions, eyebrows, captions |
| `--text-tertiary` | placeholders, disabled, metadata |
| `--border-subtle` | default hairline, card edges |
| `--border-strong` | section dividers, emphasized separation |

**Terracotta is the only color that draws the eye.** Links, primary button,
active nav, experiment status, the process step numerals. If everything is
terracotta, nothing is. Budget: roughly one accent moment per viewport.

**Moss appears only for shipped/online status.** It is not a general-purpose
second color, not a hover state, not a chart series.

## Type

Scale is 1.26 off a 17px body, `--step--1` through `--step-6`. Use the named
roles (`--h1-size`, `--body-size`), not raw steps, in components.

- Headlines: Fraunces, `SOFT` 28 / `WONK` 1, negative tracking, tight leading
  (1.04 at hero). Serif at size is the whole point — do not go below
  `--step-2` in the display face.
- Body: Instrument Sans, 1.72 leading, capped at `--measure` (68ch). Chinese
  needs the generous leading more than Latin does.
- Mono: JetBrains Mono, uppercase for Latin only. Two tracking roles, so no
  component hand-writes an em value: `--eyebrow-tracking` (0.13em) for
  standalone section labels via `.eyebrow`, `--mono-tracking` (0.06em) for
  inline technical text via `.mono` — tags, kickers, metadata, counters. This
  is the technical register and it is load-bearing — it is what makes a warm
  paper site read as built by an engineer rather than a stationery brand.

Three families is the ceiling. There is no fourth.

## Spacing

4px base, named by intent: `hair` → `chapter`. Two rules that matter:

- **Section rhythm is `--space-section` (5rem) minimum, `--space-chapter`
  (8rem) between major movements.** The old site was evenly padded
  throughout, which is what made it read as a template.
- **Asymmetry is deliberate.** Hero copy sits left against generous right
  space. Project cards alternate `wide` / `compact` (the `size` field already
  exists in the data). Do not normalize them into an even three-column grid.

## Backgrounds and atmosphere

`.grain` is the only atmospheric layer — an inline SVG fractal-noise overlay,
`multiply` on light, `screen` on dark, no network request. It supplies the
paper feel that makes warm neutrals read as warm.

No gradients. No mesh. No tinted halftones. The grain plus the warm ramp is
the entire treatment, and it is enough.

## Borders, shadows, radii

- Radii 3/5/8px only. Small radii read as printed matter; large radii read as
  a 2021 SaaS template.
- Shadows are warm-tinted (`oklch(0.235 0.014 55 / …)`), low, and used
  sparingly — cards get `--shadow-low` at rest, `--shadow-mid` on hover.
  Nothing gets `--shadow-high` except overlays.
- Hairline borders do more work than shadows here. Prefer a border.

## Light and dark

Every colour token is a single `light-dark(light, dark)` declaration. Do not
add a `[data-theme="dark"]` block or a `prefers-color-scheme` block to
override colours — the first revision had both, they drifted, and system-dark
visitors got status pills at 1.93:1. `color-scheme` on `:root` is the only
switch; `data-theme` is written only after the visitor actually chooses, so
the OS preference stays authoritative for first visits and for no-JS.

The one exception is `.grain`'s `mix-blend-mode` / `opacity`, which are not
colours and so cannot ride `light-dark()`. Those two rules are duplicated on
purpose and must be kept identical.

## Hover and press

- Links: color shift to `--link-hover` over `--dur-quick`. No underline
  animation.
- Cards: border goes `--border-subtle` → `--accent`, shadow `low` → `mid`,
  translate `-2px`. One combined move, `--dur-base` `--ease-out`.
- Buttons: press scales to `0.985` and drops to `--surface-pressed`.
- Every interactive target ≥ 44px on mobile.

## Motion

One or two high-impact moments per page, CSS-only. A hero that settles on
load; a section that reveals on scroll. Not a dozen scattered
micro-interactions. `--dur-slow` is for entrances only.
`prefers-reduced-motion` is handled in the tokens file — do not re-implement
it per component.

## Imagery

Real product screenshots only — the project data already points at real
`raw.githubusercontent.com` PNGs. Where a project has no screenshot (`cxs`,
`File Share`), the data uses `visual: "terminal"` / `"upload"`: render a
labeled placeholder in `--surface-sunken` with a mono caption. Never
hand-draw an approximation of a UI, and never hand-draw an SVG more complex
than a square, circle, or diamond.
