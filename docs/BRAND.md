# BRAND.md — the living design system

Two surfaces, two registers, one discipline. This file is the source of truth for every
design touch in the build; **update it whenever a new pattern ships or an old one changes.**

---

## Surface 1 — chasecontemporary.com (the gallery)

Luxury-fashion register adapted to a gallery. Studied against Celine/YSL (type density),
Kevin Kramer Gallery + Sacha Maric (margins/bleed).

**Ground:** optic white `#fff`, pure. Neutral grays only; never warm tints.
**Type:** Nimbus Sans Novus (regular/medium/semibold/light, self-hosted). Small-but-bold
caps: 11–13px, semibold, near-zero tracking for nav/labels; editorial paragraphs are
"chunky" — large, tight, ink-in animated.
**Wordmark:** the real stacked logo PNG (`chase-logo-stacked.png`), logo-left sticky header
(84px), logo-only footer, left-aligned. Never a substitute typeset wordmark on the site.
**No em dashes anywhere.** Commas, colons, periods.
**Wall-label rule:** captions and INQUIRE sit sized to the artwork's width (210px min) —
type belongs to the work, like a label beside a painting.
**Signature interactions:** ink-in text (gray → black cascade on scroll — the voice of the
site), Pelé swipe carousel (uniform 70vh heights), auto-drift infinite gallery corridor
(sharpness-gated allowlist), artist hover previews, cursor-follow link previews, drawer
inquiry form (branded `.dd` dropdowns, scrim, focus trap).
**Sales posture:** INQUIRE is the only call to action; POA for originals; no additive copy
that isn't on the live site.

## Surface 2 — Chase Engine (chase-engine.vercel.app, the CRM)

"Like Apple designed it." System font stack (SF), sentence case, calm.

**Tokens**
- Ground `#f5f5f7` · surface `#fff` · ink `#1d1d1f` · secondary `#6e6e73` / `#86868b` ·
  hairline `#e8e8ed` / `#f0f0f2` · disabled/hint `#c7c7cc`
- Accent blue `#0071e3` (actions, links, focus ring `rgba(0,113,227,.12)`)
- Semantic: green `#34c759` (paid/available), orange `#ff9500` (holds, due, aging),
  red `#ff3b30` (overdue, destructive), stage colors on the pipeline
  (`new #0071e3 · contacted #5e5ce6 · in_conversation #af52de · hold #ff9500 ·
  invoice #ff9f0a · paid #34c759 · nurture #8e8e93`)
- Tinted chip pairs: green `#e4f7e9`/`#1d7a3d` · amber `#ffefdc`/`#b25a00` ·
  neutral `#f0f0f2`/`#3a3a3c`
- Radii: cards 12–14px · controls 10px (`.rect`) · pills/selects 99px
- Money is always tabular-nums and bold; big numbers live in stat cards.

**Components (globals.css)**
- `.stats` / `.stat` — KPI cards: number first (22px+), lowercase label under
- `.pill` — status chips; `.pill.blue/.green` semantic variants
- `.card`, `.tblcard`, `.tbl` — surfaces and tables; rows separated by `#f5f5f7` hairlines
- `.btn` / `.btn.mini` — black primary, small variants
- `.search` — rounded search input
- `.sel` — THE select. Every dropdown in the engine uses it: appearance none, white,
  hairline border, pill radius (`.rect` for 10px in forms), custom gray chevron
  (inline SVG), blue focus ring. Filter selects auto-submit via `components/Sel.js`
  (no "Go" buttons). The open menu itself is OS-rendered and can't be styled — the
  control is the brand surface.
- `.meter` — thin affinity bars (taste profiles)
- Kanban: color-coded stage dropdown, artwork banner cards, frosted drawer head
- KPI chips on inventory cards: 10px/700 caps, color-coded by meaning (sell-through
  tone, aging amber, NOT ON SITE outlined)
- Card grids: gallery chip cards — image on `#fafafa`, wall-label data beneath
  (artist caps 11px/650/.05em, title italic, price bold), status badges overlaid top-left
- Collector rows: initials avatar (40px circle `#f0f0f2`), name + flag chips, quiet
  meta line, interests center, **money right-aligned**

**Writing style:** sentence case everywhere except chip labels (caps, 10px, tracked).
Subtitles under every H1 say what the page is for in plain words. Empty states explain
what will fill them.

## Surface 3 — Email (campaigns/drops)

The site's language, email-safe: tables + inline styles, Helvetica Neue/Arial stack
standing in for Nimbus. 600px column on white. Tracked-caps CHASE CONTEMPORARY wordmark
(text, .22em). "NEW RELEASE" boxed mark on drops. Artwork blocks = image full-width +
wall-label caption (artist caps 11px, title italic, price or PRICE ON REQUEST) + black
INQUIRE button right-aligned. Footer: tracked wordmark, {{mailing_address}},
{{unsubscribe}}. Renderer: `crm/lib/email.js` — change the brand there, every campaign
inherits it.

---

## Iteration log

- 2026-08-26 · Site register locked (optic white, YSL density, logo-left). Ink-in voice.
- 2026-08-26 · Engine established as Apple-register; stage color system; deal-ticket chips.
- 2026-08-26 · Inventory → gallery chip grid; KPI chips color-coded; money right-aligned
  on collector rows; `.sel` unified every dropdown, filter selects auto-submit.
- 2026-08-26 · Email design language established in `crm/lib/email.js`.
- 2026-08-26 · Paper surface: invoice PDF (`crm/lib/invoicePdf.js`) — US Letter, 64pt
  margins, embedded Nimbus (regular/medium/semibold), stacked logo 46pt, hand-tracked caps
  (pdf-lib has no letterspacing; drawn per-glyph), wall-label line items, hairline rules,
  centered tracked wordmark footer. All future paper (COA, agreements) uses this pipeline.
