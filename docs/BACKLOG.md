# Chase Engine — Feature Backlog

Canonical idea ledger. RULE: when Devyn drops a new idea mid-build, the current build finishes,
the idea lands HERE (and the Google Doc mirror) immediately — nothing gets skipped.
Status: QUEUED (accepted, unbuilt) · IN FLIGHT · NEEDS KEY (blocked on account/credential) · PARKED (decision pending).

## In flight
- Internal comp engine, phase 1: suggested estimates on POR works from own realized $/sq-in (44 artists, 1,971 comps live in artist_comps view)

## Queued
- Artist Performance page: sell-through + revenue + on-hand value per artist, capital-allocation verdicts (promised in "build into this")
- Aging move-list on Today: works >12 mo on hand -> feature in drop / reprice / place
- COA generator: per-work certificate PDF from the invoice brand pipeline
- Bulk push to site: stage all READY TO LIST works as Shopify drafts (after token proves out on 5-10 works)
- Image-quality scoring for Artcloud CDN photos (extend the sharpness gate before bulk publish)
- Valuation phase 2: subscription comps (artnet / MutualArt accounts the gallery already pays for) for thin-coverage artists
- Valuation phase 3: public auction-results enrichment (Christie's / Sotheby's / Phillips), ToS-respectful
- Wire auto-reconciliation: bank feed (Chase/QBO) matched on invoice numbers -> auto-settle wires
- SMS delivery lane for details links + pay links (Twilio, gallery-owned)
- Details-link auto-send on stage -> Invoiced (needs Resend)
- Invoice auto-generate on details completion (chain rule)
- documents table + Documents surfaces (per CONTRACTS-DOCUSIGN.md)
- DocuSign envelopes: purchase agreements + on-approval paper (needs account + counsel-blessed templates)
- v2 CRM backlog (docs/CRM-OVERHAUL.md): business-hours call metric, next-action cadence, loss reasons, hold-lapse notifications, per-user auth/roles

## Needs key (built, waiting)
- Shopify pay links + product push: custom app token (scopes: write_products, read_products, write_draft_orders, read_draft_orders, read_orders) + API secret key — Devyn
- Wire instructions paragraph for invoice PDFs — Kristine
- Campaign sends: Resend account + DNS + CAN-SPAM address — Wyatt/Kristine
- Stripe ACH lane: parked account, revisit when mid-band online closes are frequent

## Parked decisions
- Site go-live over live Shopify theme — Bernie
- artcloud.market seat: keep during transition or sunset — Bernie
- Squarespace login for archive restore — Kristine
- Consignment economics question (95% of history) — Bernie
- Credential rotation once accounts settle
