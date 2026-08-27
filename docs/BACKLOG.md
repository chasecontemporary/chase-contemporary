# Chase Engine — Feature Backlog

Canonical idea ledger. RULE: when Devyn drops a new idea mid-build, the current build finishes,
the idea lands HERE (and the Google Doc mirror) immediately — nothing gets skipped.
Status: QUEUED (accepted, unbuilt) · IN FLIGHT · NEEDS KEY (blocked on account/credential) · PARKED (decision pending).

## Shipped since last update
- Full-journey attribution BUILT 8/27 (live loop tested end-to-end): anonymous visitor id (localStorage cc_vid) + sendBeacon page views -> site_events; inquiry submit stitches the whole trail to the collector (visitor_links + retro backfill); collector_journey view; "Visits to our site" row in the pipeline drawer. Site-side JS is in the theme and goes live with theme go-live. Later identity moments (Klaviyo click UTMs, checkout) plug into the same tables.
- Comp engine phase 1 + valuation section w/ invoice-cited comps + thumbnails
- Artists page (capital allocation: sell-through x revenue x on-hand, DOUBLE DOWN / MOVE STOCK verdicts)
- Aging move-list on Today
- 45 artist bios (9 site + 36 web-researched w/ source URLs) + About-this-work/provenance
- Unified control law; unit-page luxury pass; details link confirm-mode

## In flight
- (nothing — awaiting Shopify token + wire paragraph)

## Queued
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
- DocuSign envelopes: purchase agreements (needs account + counsel-blessed templates)
- v2 CRM backlog (docs/CRM-OVERHAUL.md): business-hours call metric, next-action cadence, loss reasons, hold-lapse notifications, per-user auth/roles

- Quicklists / viewing-room links: build ONLY if Sara confirms she actually uses Artcloud quicklists (usage unverifiable from exports); Devyn 8/27
- DECLINED 8/27: bulk-image request to Artcloud support (sold works stay imageless)

## Needs key (built, waiting)
- Shopify pay links + product push: custom app token (scopes: write_products, read_products, write_draft_orders, read_draft_orders, read_orders) + API secret key — Devyn
- Wire instructions paragraph for invoice PDFs — Kristine
- Campaign sends: KLAVIYO account (pivot 8/27) + private API key + Shopify connect + DNS auth + CAN-SPAM address — Wyatt/Kristine; then build audience->List sync + campaign push
- Stripe ACH lane: parked account, revisit when mid-band online closes are frequent

## Housekeeping
- PURGE DEMO DATA before go-live: collectors/inquiries/invoices/payments where collector email like 'demo-%@import.chasecontemporary.com' (created 8/27 to exercise the full workflow)

## Deliberately LAST
- "What Bernie Sees" owner dashboard: killed the placeholder Board page (8/27). Build only after launch, composed from the data every other page is accumulating (Finance collections, Artists velocity, Commissions, campaign attribution, response speed). Not before.

## Parked decisions
- Site go-live over live Shopify theme — Bernie
- artcloud.market seat: keep during transition or sunset — Bernie
- Squarespace login for archive restore — Kristine
- Consignment economics question (95% of history) — Bernie
- Credential rotation once accounts settle
