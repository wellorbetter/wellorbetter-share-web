# wellorbetter-brand

Design system for every `wellorbetterai.com` surface. Warm-neutral
paper-and-ink editorial.

## Files

| Path | What |
|---|---|
| `tokens/colors_and_type.css` | Canonical tokens. The only file you import. |
| `SKILL.md` | Rules for agents working in this system. |
| `brand/voice-and-tone.md` | How the site talks. |
| `brand/style-notes.md` | Visual foundations — color roles, spacing, motion, layout. |

## Why this exists

The old site had **four competing palettes** and no design system in effect:

| Source | Palette | Fonts |
|---|---|---|
| `packages/design/src/tokens.ts` | Material 3 stock blue `#445E91` | bare system stack |
| `blog.wellorbetterai.com` | moss `#146c5b` + gold `#e2ab4b` | Inter / Iowan Old Style |
| `apps/landing/src/presentation.css` | Stripe purple `#635bff`, hardcoded ~20× | Georgia inline |
| `apps/landing/index.html` | `theme-color` cream `#f3efe6` | — |

The M3 tokens were also barely wired up: landing imported only `icon` and
`themeStyle` from `@wellorbetter/design`, while 2274 lines of hand-written
CSS across 5 files carried the actual visuals — including a
`portfolio.css` / `portfolio-v2.css` pair that had already drifted apart.

The cream `theme-color` was the one honest signal: there was already a warm
instinct in there. This system commits to it.

## The direction

- **Purpose.** Make a visitor believe these tools actually work.
- **Tone.** Restrained, practical, made by hand. Warm, not cute.
- **Differentiation.** Paper ground + editorial serif + mono as the
  technical register. Not a gradient card wall.

It follows the copy, which was already good and already had this voice:
「把脑子里的小想法，做成真的能用的工具。」「不是 demo 墙，是我真的在用的东西。」
「先做成，再做对，再做好看。」 The M3 blue was contradicting the writing.

## Sources consulted

- `packages/design/src/tokens.ts` (304 lines, M3 palette)
- `apps/landing/src/App.tsx` (real zh/en copy and the 6 real projects)
- `apps/landing/src/styles.css`, `portfolio.css`, `portfolio-v2.css`,
  `site-agent.css`, `presentation.css`
- `apps/landing/index.html`
- Live `https://blog.wellorbetterai.com` served CSS
- Live `https://wellorbetterai.com` served HTML

## Confident vs. needs your call

**Confident:** warm neutral ramp, the terracotta/moss accent pair, mono as
the technical register, dropping the M3 seed, small radii, CJK handling.

**Wants your confirmation:**

1. **Fraunces** as the display face. It has character (`SOFT`/`WONK` axes)
   and is the biggest single personality decision here. If it reads as too
   much, `Newsreader` or `Source Serif 4` are quieter swaps at the same role.
2. **Terracotta over moss as primary.** Terracotta is warmer and ties to the
   Rust-heavy project list; moss would be closer to the blog's current green.
   Swapping them is a two-line change.
3. **Google Fonts via `@import`.** Four families is a real payload, and
   Google Fonts is itself slow from mainland China — which interacts with
   the unresolved LAX-routing problem. Self-hosting the subset from R2 is
   the likely fix, not yet done.
4. **Serif for Chinese headlines.** `Noto Serif SC` pairs with Fraunces, but
   Chinese serif at large sizes is a taste call worth seeing rendered.
