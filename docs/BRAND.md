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

**REGISTER V2 (8/28, Devyn's call): the gallery inside the tool.** The Apple-clone skin
(SF font, iOS palette, 10px radii) is retired — it read "vibe-coded SaaS." The engine now
wears the gallery's own register, adapted for operators. Usability law stands above
aesthetics: nothing shrinks, contrast only goes up, buttons always look like buttons,
36px hit targets, :focus-visible rings.

**Tokens (v2 — globals.css is canonical)**
- Ground `#f7f7f4` warm paper · surface `#fff` · ink `#1a1a18` · secondary `#73736c` ·
  hairline `#e3e3dd` · wash `#f2f2ee` / `#eeeee9` · disabled `#c2c2bb`
- **Black is the primary action.** `.btn` = ink `#1a1a18`, white text (the site's INQUIRE
  language). Blue `#2257c5` (deep cobalt) is links + focus only, never buttons.
- Semantic (editorial, muted, still unmistakable): green `#35804a`/`#2e6b3f` (paid, money
  in), ochre `#b7791f` (holds/due), bronze `#9a6a16` (invoiced), amber-brown `#9a551a` /
  `#8f6f14` (warnings, aging), red `#c02d23` (overdue, destructive)
- Stage colors: `new #2257c5 · contacted #56599f · in_conversation #7d4d9e ·
  hold #b7791f · invoice #9a6a16 · paid #35804a · nurture #82827b`
- **Type: Nimbus Sans Novus** (next/font/local in layout.js, 400/500/600; 650/700 map to
  the semibold file — never synthetic bold). Same family as the site and the PDFs.
- **Shape: square.** `--r: 2px` on cards/controls, 3-4px on drawers/menus, radius 99/pill
  shapes retired to 3px tags. Print, not app.
- **H1s are tracked caps** (21px, .07em, uppercase) — exhibition-title register. Section
  labels stay `.cardtitle` tracked caps. Stat labels now tracked caps too.
- **Sidebar**: white panel, hairline right border, CHASE ENGINE wordmark in tracked caps,
  active nav item = ink block with white text.
- **Wall-label rule (engine-wide):** wherever a work is named: ARTIST in tracked caps,
  *title* in italic. Drawer artwork card does this; extend to every remaining surface in
  the Phase 2 polish pass.
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
- **Action discipline (8/27):** blue is the ONE primary action of a surface; every other
  button is `.btn.quiet` (gray ground, ink label). A screen full of blue is a screen with
  no hierarchy. Card section headers use `.cardtitle` (11px tracked caps, gray) — editorial,
  not bold-shouting. Cards carry a hairline (`#ececf0`) + whisper shadow, not heavy elevation.
- **Control law (8/27):** everything you touch is ONE shape — 10px radius, 36px height:
  buttons (`.btn`, `.btn.mini` differ only in label density), text inputs, selects, date
  fields, search, the `$`-prefixed `.money` group. Pills are for STATUS and TABS only,
  never for controls — with ONE sanctioned hybrid: a status that is directly editable in
  place (chase stage) renders as a colored pill-select: 24px pill, white 10.5px tracked
  caps, stage color ground, white chevron. Anything sharing a row with it (DEPOSIT IN,
  PAID) matches that exact 24px pill scale. Money inputs always carry the $ inside the control and format with
  thousands separators.
- `BrandSelect` — THE dropdown (native select menus are OS-drawn and off-brand, so the
  menu is ours): branded trigger (36px rect, or 24px colored pill for editable statuses),
  fixed-positioned white menu card (12px radius, hairline, soft shadow, hover rows, blue
  check on the active row). Every dropdown in the engine uses it; `.sel` survives only as
  legacy CSS. Every dropdown in the engine uses it: appearance none, white,
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

**Plain-speech law (8/27):** money and workflow surfaces use words a first-time user
already knows — "owed to the gallery", "collected in August", "follow up 1", "mark paid in
full" — never accounting or CRM jargon (AR, accrued, settle, nudge). If a label needs
explaining, it is the wrong label. One quiet helper sentence per complex surface telling
the user what clicking does.

Tightened 8/27 (Devyn): every label must say WHAT the thing is, not gesture at it.
"Money picture / lifetime / ≈170% of list / secure form" all failed this test. The fix
pattern: full sentences or full phrases — "Bought from us before", "Budget they gave us —
covers the $22,000 price", "Send them a form to fill in" + a helper line saying exactly
what the form is and where the data goes. Empty values read "Not given" / "Nothing yet —
new collector", never a bare dash. Info lists are aligned hairline row cards
(150px gray label column + value), not loose dl pairs with buttons jammed in.

**Business rule (8/27):** the gallery does NOT do take-home / on-approval trials.
No approval UI anywhere (drawer, Today, inventory). The approval_out/approval_close
actions stay dormant in the act route — do not resurface them.

**Writing style:** sentence case everywhere except chip labels (caps, 10px, tracked).
Subtitles under every H1 say what the page is for in plain words. Empty states explain
what will fill them.

## Surface 2.5 — Collector-facing engine pages (/d details link)

Site register, not CRM register: optic white, Nimbus via next/font/local, tracked-caps
wordmark, underline-only fields (no boxes), black full-width CONFIRM button, one quiet
privacy line. Any page a collector ever sees speaks Chase Contemporary.

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
