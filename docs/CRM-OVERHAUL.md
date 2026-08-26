# CRM Overhaul Spec — "blow it out of the water" (v1, 2026-08-26)

Thesis: Artcloud is a filing cabinet you look things up in. Ours is a queue that tells the sales force what to do next — with an interface at the standard of the site (optic white, Nimbus, hairlines, ink). Sales force: Devyn, Wyatt, future hires. Bernie sees everything.

## Feature-by-feature superiority
| Artcloud | Ours |
|---|---|
| Pipeline is a $69/user/mo add-on | Pipeline is the product, included |
| Inquiries create bare "Opportunities" | Inquiries arrive as full CALL CARDS: journey, budget, timeframe, device, repeat history, artist interests |
| No SLA concept | 5-minute clock on every new inquiry, per-rep response leaderboards |
| Filing-cabinet dashboards | TODAY queue: SLA breaches, expiring holds, due follow-ups, ranked |
| No API, closed box | Postgres we own; everything scriptable; site already wired in |
| No campaign scheduling | Scheduled + triggered flows (new-work→interested collectors), human-approved |
| Interest tags via manual entry + purchases | Interest graph auto-built from browsing journeys, inquiries, purchases, email clicks |
| Reports = invoice exports | Live dashboards: velocity by artist/price band, source attribution, close rates, rep performance, revenue vs settled |
| Stripe only | Card + ACH + wire + Square import + financing (rails per Revenue Engine W4) |
| $132/user + add-ons ≈ $400-700/mo | Supabase+Vercel ≈ $45/mo flat, unlimited users |

## What we adopt from them (their good bones)
- One record graph (already in our schema)
- Holds as first-class objects (already), editions, price_override for display
- Artist-interest auto-tagging → power the new-work alert flow
- Inventory-in-email blocks (later, with email module)
- Their migration templates = our import column mapping (Contacts → Inventory → Invoices, keyed on email/SKU)

## v1 build (order)
1. **Today queue** — new inquiries w/ SLA timers, holds expiring, follow-ups due; claim/assign per rep
2. **Call card** — full collector story + one-tap actions (mark contacted, note, draft email, place hold, next follow-up)
3. **Pipeline board** — stages: New → Contacted → In conversation → Hold → Invoice → Paid → Nurture; drag between
4. **Collectors** — searchable, filter by interest/budget/source/city; profile = timeline of everything
5. **Dashboards** — rep leaderboard (response time, close rate, revenue), sales velocity, source attribution
6. **Auth** — Supabase magic links; roles: owner (Bernie sees all) / rep
7. Later: plain-English query bar, email module, payments (W4)

## Design system
Direct port of the site: optic white, pure black, Nimbus caps for labels/nav, hairline tables, ink-in transitions on view changes, drawer patterns for detail views, branded dropdowns. Feels like the gallery's own OS — "Apple designed the CRM" = restraint + speed + one obvious next action per screen.

## Migration (blocked on access/exports)
Artcloud CSVs (Contacts, Inventory, Invoices via Actions>Export + QBO sales export) → importer scripts → collectors/artworks/deals. Their no-API lock-in means CSV is the only door; get exports EARLY.


## v2 backlog (logged 8/26, from Devyn)
1. **Invoicing, fully automated** — invoice generated from a deal, rendered to PDF, stored on **Vercel Blob**, sent to collector; **automated Stripe payment links** attached (pay-by-link closes the loop; settlement webhook flips payment → settled → commission trigger fires).
2. **COMMISSIONS section** (the "sales force" tab) — commission_rules management UI (who's in the pool, percentages), auto-calculated splits per settled payment (DB trigger already live), per-rep running totals, period statements. Zero manual calculation, zero reconciliation.
3. **INVENTORY section** — the full inventory system in-app: every work with status/location, **live inventory value** (sum of active works at price, plus cost basis vs retail once Artcloud purchase prices import), filters by artist/type/location/availability, per-work detail with sales history. Becomes the system of record replacing Artcloud inventory (pending their CSV import: purchase prices, editions, consignment records, framing, insurance, storage locations across PB/Miami/NY/LA/Solana Beach).

## Pipeline backlog (8/26)
- Next-action date per card (0/2/7/21 cadence), overdue = red
- Stage-appropriate drawer CTAs: send hold link / send invoice / mark paid (arrives w/ Stripe)
- Loss reasons on closed-lost for learning
