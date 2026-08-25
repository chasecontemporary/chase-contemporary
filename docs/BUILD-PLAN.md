# Chase Contemporary — Revenue Engine Build Plan

## Context

Chase Contemporary (Bernie Chase's gallery) is getting a full web refresh plus all backend and integrations rebuilt to the "Revenue Engine" proposal (`~/chase-contemporary/docs/chase-revenue-engine.pdf`): 8 workstreams, 3 phases over 16 weeks. The current chasecontemporary.com is already on Shopify but leaks revenue exactly as the plan describes — inquiries go to a shared `info@` inbox, prices are hidden yet a cart exists, no CRM, no address on the site, and the entire old editorial site (~50 exhibition archives) was deleted and 404s while still Google-indexed. Research on Bernie and the gallery is complete and committed in `~/chase-contemporary/research/` (29 Bernie sources + ~30 gallery press sources) as GEO raw material.

## Decisions locked (from Devyn)

1. **Chase Contemporary continues** — same brand, domain, and Shopify store; rebuild in place.
2. **Supabase Postgres + custom thin CRM** (Next.js/Vercel/Clerk — MoaOS pattern) as the database of record.
3. **Pricing policy: editions public + self-serve checkout; originals POA** with inquire → call card → hold/payment-link flow.
4. **Full restore of the deleted exhibition archive** with 301s from dead indexed URLs — the flagship GEO/SEO move.

Hard rules carried from the plan: no chatbots; nothing sends without human approval; no AI quotes a POA price; collector data never leaves. Plus standing rule: **every outbound email/send is drafted only — nothing sends without Devyn's explicit go.**

## Architecture

- **Supabase (new project, gallery-owned org/billing TBD)**: tables `artists, artworks, collectors, inquiries, deals, payments, consignments, shipments, commissions, activities` + RLS roles (owner/director/rep; artist read-own later). Artwork imagery + provenance docs in Supabase Storage.
- **Shopify = sell surface**: products (editions priced; originals POA w/ inquiry form), draft-order payment links, Shopify Payments (+ACH), theme rebuild. Postgres is canonical; a sync worker mirrors sellable works to Shopify via Admin API; webhooks (orders, checkouts, customers) flow back.
- **CRM**: thin Next.js app on Vercel — pipeline board (New → Enriched → Contacted·5-min SLA → In conversation → Hold/Offer → Invoice → Paid → Nurture), call cards, hold management, approval queue for drafted emails, dashboards ("What Bernie Sees").
- **Alerts**: Slack (and/or SMS pending Q30) on inquiry submission; SLA clock from form submit.
- **Email**: Klaviyo for flows (pending Q29), drafted-then-approved; one-to-one revival emails drafted into Gmail.
- **GEO layer**: restored exhibition archive, Bernie bio page, press index (from `research/`), Schema.org (`ArtGallery`, `Person`, `VisualArtwork`, `ExhibitionEvent`), llms.txt, clean sitemaps, 301 map from dead URLs.

## Phase 0 — Access intake & baseline (gate: can't start without)

Collect from Devyn/Bernie (the ⛔ items in `docs/QUESTIONNAIRE.md`, answers recorded there):
Shopify collaborator access + plan tier; DNS/registrar; Google Workspace/info@; locations + addresses; current data sources & inventory; rollout date/contract status. Then: audit Shopify (theme, apps, orders, customers), export inbox history, pull GSC/GA4 if they exist, snapshot Wayback archive of the old site.

## Phase 1 — Stop the Leak (≈ weeks 1–3)

1. Supabase schema + RLS + seed (artists, works from Shopify export).
2. W1 embedded inquiry forms on every artwork page (artwork context, price band, page journey, source auto-attached) → Supabase → Slack ping + auto-acknowledgment w/ booking link (drafted templates, approved once).
3. CRM v1: pipeline, call cards, activity logging, SLA timer.
4. Inbox archaeology: import inquiry history; revival-email campaign drafted per the plan's template (nothing sends without approval).
5. Follow-up cadence templates (Day 0/2/7/21) + named owner per inquiry.
6. Baseline metrics captured (real inquiries/mo, close rate, avg deal) to replace placeholder math.

## Phase 2 — Take the Money (≈ weeks 3–8)

1. Payment rails: card (fees priced in), ACH push for $5k–150k, auto-generated wire instructions + reconciliation, financing partner (Q38), payment links mid-call via draft orders.
2. The Hold: refundable-deposit product + 72-hr expiry automation + policy page.
3. Automated invoicing; historical sales import; unified pipeline (Artsy, shop, fairs, walk-ins → one table).
4. Lifecycle email marketing infrastructure live (Devyn 8/25: confirmed Phase 2 priority) — the flagship trigger: new artwork uploaded → CRM matches it to collectors by purchase/inquiry history → drafts a personalized note per collector → human approves → sends. Plus nurture and logistics updates. Nothing auto-sends.

## Phase 3 — Compound (≈ weeks 8–16)

1. Premium site: full theme rebuild to the approved design bar (Q42), museum-grade presentation, editions self-serve.
2. GEO: archive restore + 301s, Bernie bio + press index (content approval per Q6/44/45), structured data everywhere, AI-citability pass.
3. Commission engine: rules table (artist consignment %, rep %, house/location, pro-rata discounts) → rows computed on settlement → monthly artist/rep statements (drafted, approved).
4. Dashboards: leaderboard, sales velocity, pipeline health, money & sources.
5. AI query layer (plain-English over Postgres, read-only, role-scoped) + `AI-OPERATIONS.md` operating file encoding the hard rules.
6. Winning-script loop: measure → extract → deploy → verify.

## Repo & tracking

All in `~/chase-contemporary` (already a git repo): `docs/` plan + QUESTIONNAIRE.md (living answer sheet), `research/` (done), plus `site/` (theme code via Theme Access CLI — per Shopify gotchas memory), `crm/`, `db/` (migrations), `sync/`. Remaining 56 questionnaire answers get recorded as they arrive; each phase's ⛔ items gate that phase only.

## Verification

- Phase 1: submit test inquiry on a live artwork page → row in Supabase, Slack ping < 10s, ack drafted, call card renders with full context; SLA timer visible in CRM.
- Phase 2: test-mode card + ACH transactions reconcile to `payments`; hold expires and releases on schedule; payment link closes a draft order end-to-end.
- Phase 3: Rich Results test passes on artwork/exhibition/person pages; dead URLs 301; restored archive pages indexed via GSC; commission rows match hand-calculated splits on 3 historical deals; dashboards match source-of-truth SQL.
- Standing: nothing auto-sends in any test — every outbound artifact lands in an approval queue.

## Immediate next steps after approval

1. Devyn provides Phase-0 access list (Shopify, DNS, Workspace) + answers to ⛔ questions 4, 19, 51.
2. Shopify + inbox audit; Wayback snapshot of the old site archive.
3. Supabase project + schema migration #1.
