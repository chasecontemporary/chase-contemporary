# Artcloud teardown (research, 2026-08-26)

Full findings from public docs/reviews. Highlights preserved here; source URLs inline in the research output.

## Corporate: acquired by Artlogic (July 29, 2025)
"Legacy Art Gallery Pricing, Pre Artlogic" page already exists — plan bifurcation underway. Roadmap uncertain. Best possible timing to migrate off.

## Their object model (import mapping source)
- Inventory (43 fields incl. editions, consignment %, framing, insurance, price_override, holds keep items Active)
- Contacts (32 fields incl. spouse names, dual addresses, tags, artist_interests, subject interests, origin, staff owner)
- Opportunities (pipeline; auto-created from website inquiries; configurable stages; GATED behind $69/user/mo "Sales Seats")
- Invoices (Open/On_Approval/Closed; Stripe-only payments), Audiences (Active=smart, Static), Campaigns, Holds, Offers, Consignments, To-dos, Collateral (tearsheets/COAs/wall tags)

## Export paths (migration plan)
- CSV exports exist: Contacts / Inventory / Invoices dashboards → Actions > Export (column sets should mirror their migration templates)
- Sales line items: Analytics → Sales Over Time → Export → QuickBooks Online CSV (payments/status NOT carried)
- Mailchimp integration = secondary contact sync side-door
- NO API, NO webhooks, NO Zapier. Closed box. Bulk image export undocumented (ask support@artcld.com)
- Their own import order: Contacts → Inventory → Invoices, matched on email/SKU/import_key

## Weaknesses to exploit
- No campaign scheduling; limited email analytics
- No API — data locked in
- $132/user/mo (Professional) + $69/user Sales Seats + metered email ($30-528/mo) + website fees ($77-303/mo); pipeline is a PAID ADD-ON
- QBO integration "problematic"; UX "poor and annoying sometimes"; auto-save duplicate records; inventory_number can't contain letters; wall labels/invoices/reports not customizable; weak Android app
- Hard caps (25k works on Pro)

## Strengths we must match or beat
1. One roof: inventory ↔ CRM ↔ invoicing ↔ email ↔ website share one record graph, site auto-syncs from inventory
2. Art-domain model: editions, holds, consignment splits, framing, COAs, tearsheets, wall tags, price_override
3. Inventory-in-email: drop artworks into campaigns/quick emails; "New Arrivals" auto-sends to interested contacts
4. Auto-captured intent: inquiries auto-create pipeline entries + auto-tag artist interests (interest graph builds itself)
5. Fast staff onboarding, excellent support, commission-free Stripe payments, per-contact engagement history
