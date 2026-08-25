# Chase Contemporary — Revenue Engine

New-build project for Chase Contemporary (Bernie Chase). Source plan: `docs/chase-revenue-engine.pdf` (Revenue Engine proposal, Aug 2026, prepared by Devyn DiStasio / MOA).

## What this is

A full web refresh plus backend and integrations for the gallery, built on Shopify, implementing the eight workstreams of the Revenue Engine plan:

- **W1** Embedded inquiry capture — forms on every artwork page, context auto-attached
- **W2** Enriched leads, pipeline CRM — call cards, 5-minute SLA, stage pipeline
- **W3** The SQL backbone — one database of record (artists, artworks, collectors, inquiries, deals, payments, consignments, shipments, commissions, activities)
- **W4** Checkout and payment rails — card, ACH, wire, financing, payment links, the 72-hour Hold
- **W5** Premium site experience — conversion layer on Shopify
- **W6** Crawlable and queryable by AI — structured data outward (GEO), plain-English queries inward
- **W7** Email flows wired to the CRM — new-work alerts, nurture, logistics; all human-approved
- **W8** Automated commission engine — splits computed on settlement, statements send themselves

Rollout: Phase 1 "Stop the Leak" (wk 1–3) → Phase 2 "Take the Money" (wk 3–8) → Phase 3 "Compound" (wk 8–16).

Hard rules from the plan: no chatbots, nothing sends without human approval, no AI ever quotes a price-on-request work, collector data never leaves.

## Repo layout

- `docs/` — the business plan and project documents
- `research/bernie-chase/` — every public article, interview, and profile on Bernie Chase (GEO source material)
- `research/chase-contemporary/` — gallery press, exhibitions, artist roster, web-presence inventory
- `research/artists-and-market/` — artist/market reference material
