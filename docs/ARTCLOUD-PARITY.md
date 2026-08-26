# Artcloud Parity Audit — Chase Engine (2026-08-26)

Verdict per feature: ✅ live and better · 🔶 live, thinner (gap noted) · 🔜 planned (phase) · ⛔ deliberately not building

## CRM / Contacts
| Artcloud | Chase Engine |
|---|---|
| Contact records (32 fields incl. spouse, dual addresses, tags, interests, origin) | ✅ Full field parity in schema + web enrichment they lack (journey, dwell, device, timezone, budget, timeframe) |
| Purchase history on contact | ✅ Collection ledger + lifetime/YTD/avg/run-rate/top-artist/days-since (they show a list; we compute LTV) |
| Assigned staff owner | ✅ owner field + Today claiming |
| Tags / artist interests | 🔶 tags column exists; interest auto-tagging from inquiries lands with email module (their strength — matched at import, automated in Phase: Email) |
| Audiences (smart segments) | 🔜 Email phase — saved filters over collectors (our filters already query live) |
| Top-client report | ✅ Collectors ranked by lifetime value by default |

## Pipeline
| Artcloud | Chase Engine |
|---|---|
| Opportunities ($69/user/mo add-on) | ✅ Included; Kanban drag-drop, lead drawer w/ full context |
| Auto-created from website inquiries | ✅ + enriched payload theirs never sees |
| Configurable stages | 🔶 fixed 7-stage flow tuned to art sales (configurable later if ever needed) |
| Tasks/reminders on deals | 🔜 next-action dates (pipeline backlog) |
| — (no equivalent) | ✅ SLA clocks, column $ totals, time-in-stage aging, 72h hold countdowns, repeat-collector flags |

## Inventory
| Artcloud | Chase Engine |
|---|---|
| Works w/ 43 fields (editions, consignment, framing, insurance, locations) | 🔶 core fields live + live from Shopify; full field set (cost basis, editions, locations, insurance) activates at Artcloud import — columns land with importer |
| Statuses, holds keep active | ✅ available/sold + holds table w/ expiry |
| Live inventory value | ✅ (they don't headline this; we do) |
| Collateral: tearsheets, COAs, wall tags, pricelists | 🔜 with PDF engine (Vercel Blob) — same phase as invoicing PDFs |
| Marketplace listing | ⛔ not our business model (their marketplace, their moat) |

## Finance
| Artcloud | Chase Engine |
|---|---|
| Invoices (Open/On-Approval/Closed) | ✅ invoices + status + method |
| — (no AR view) | ✅ Open AR, aging buckets 0-30/31-60/61-90/90+, collected YTD, avg days-to-pay |
| Stripe payments/terminal/links | 🔜 Stripe phase (links + webhooks; ledger ready) — note we also plan ACH/wire/Square import, they are Stripe-only |
| Staff commissions report | ✅ BETTER: auto-split trigger on settlement + pool management UI + running totals (theirs is a report; ours is automation) |
| QBO export | 🔜 CSV export of invoices/payments (trivial; add with Stripe phase) |
| Artist payables/consignor statements | ⛔ n/a — Bernie owns all inventory (pool commissions replace this) |

## Email marketing
| Artcloud | Chase Engine |
|---|---|
| Campaigns, drag-drop builder, inventory blocks, metrics | 🔜 Email phase (Resend); interim: Artcloud/other keeps sending — no gap in operations |
| No scheduling (their documented gap) | 🔜 ours ships with scheduling + triggered flows (new work → interested collectors), human-approved |
| Engagement on contact record | 🔜 same phase; activities table ready |

## Platform
| Artcloud | Chase Engine |
|---|---|
| Website builder ($77-303/mo) | ✅ our Shopify theme (already superior, already wired to CRM) |
| No API, no webhooks | ✅ own Postgres + endpoints; everything scriptable |
| iOS/Android apps | 🔶 responsive web app (works on phones); native ⛔ unless demanded |
| Permissions/roles | 🔶 access code now; per-user auth + roles (Bernie-sees-all) next phase |
| Ease of onboarding (their strength) | ✅ six screens, one obvious action each |
| Support (their strength) | n/a — we ARE the support |

## Cost
Artcloud comparable config: Professional $132/user + Sales Seats $69/user + email metering + website fees ≈ $500-800/mo for a 3-seat force.
Chase Engine: Supabase + Vercel ≈ $45/mo flat, unlimited seats.

## Phase queue (order)
1. Artcloud import (contacts/inventory/invoices CSVs) — blood transfusion for every screen
2. Stripe: payment links + webhooks → auto-settlement → commissions fully hands-free; invoice PDFs on Vercel Blob
3. Per-user auth + roles; next-action cadence
4. Email module (Resend): campaigns, scheduling, triggered new-work flows, engagement on the card
5. Collateral PDFs (tearsheets, COAs)
