# Chase Engine — Feature Backlog

Canonical idea ledger. RULE: when Devyn drops a new idea mid-build, the current build finishes,
the idea lands HERE (and the Google Doc mirror) immediately — nothing gets skipped.
Status: QUEUED (accepted, unbuilt) · IN FLIGHT · NEEDS KEY (blocked on account/credential) · PARKED (decision pending).

## Shipped since last update
- Today rebuilt as THE landing page 8/28 (post competitive discovery, docs/CRM-DISCOVERY.md): omnisearch (collectors + works), "What's new" pulse (inquiries / money in / forms completed / known collectors seen on the site), "Needs attention" exceptions (answer now, gone quiet 5d+, money to chase, holds running out), 4-number money strip, Move list demoted to bottom. Personalized: reps see their own follow-ups. Old response-queue duplication with Pipeline removed.
- Full-journey attribution BUILT 8/27 (live loop tested end-to-end): anonymous visitor id (localStorage cc_vid) + sendBeacon page views -> site_events; inquiry submit stitches the whole trail to the collector (visitor_links + retro backfill); collector_journey view; "Visits to our site" row in the pipeline drawer. Site-side JS is in the theme and goes live with theme go-live. Later identity moments (Klaviyo click UTMs, checkout) plug into the same tables.
- Comp engine phase 1 + valuation section w/ invoice-cited comps + thumbnails
- Artists page (capital allocation: sell-through x revenue x on-hand, DOUBLE DOWN / MOVE STOCK verdicts)
- Aging move-list on Today
- 45 artist bios (9 site + 36 web-researched w/ source URLs) + About-this-work/provenance
- Unified control law; unit-page luxury pass; details link confirm-mode

## In flight
- (nothing — awaiting Shopify token + wire paragraph)

## Queued (ordered per 8/28 competitive discovery — highest leverage first)
- Offer sheets / private-view links: tokenized branded page of 3-10 curated works w/ prices for ONE collector, viewed-tracking via the journey layer. The #1 most-praised daily feature across Artlogic/ARTERNAL; we have all the infra (tokenized pages + site_events).
- Reserves/holds on works with expiry: "holding until Friday" as a status + auto-release, prevents double-selling with multiple reps. (Distinct from the killed take-home trials — this is a work-level sales reserve, work never leaves the gallery.)
- Email logging to collector records: BCC dropbox (crm@ address) that files sent mail onto the contact timeline. ARTERNAL's core insight: deal history lives in the inbox.
- Artwork location field + movement log: "where is this piece right now" (wall / rack / framer / shipped) — one field + history, not a WMS.
- Artist sold-works statement PDF: read-only per-artist report off existing sale lines (what sold, what's owed) — prevents spreadsheet regression without rebuilding consignment accounting.
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
