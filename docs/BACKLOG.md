# Chase Engine — Feature Backlog

Canonical idea ledger. RULE: when Devyn drops a new idea mid-build, the current build finishes,
the idea lands HERE (and the Google Doc mirror) immediately — nothing gets skipped.
Status: QUEUED (accepted, unbuilt) · IN FLIGHT · NEEDS KEY (blocked on account/credential) · PARKED (decision pending).

## Shipped since last update
- !! 9/4 OUTAGE: the Supabase project went unreachable (hostname NXDOMAINs from every
  resolver) — the free-tier auto-pause we flagged in the audit, hitting the day after
  go-live. The sbp_ management token is ALSO dead (401), and the Supabase MCP connector is
  authed to Devyn's personal org, not the gallery org, so it CANNOT be restored from here.
  ACTION: log into the Supabase dashboard as the gallery identity, restore the project, and
  upgrade to Pro so it cannot pause again. Insurance: the 8/28 export (35,120 rows) is on
  disk AND now in the private Drive folder (chase-engine-database-backup-2026-08-28.tar.gz).
- CAPTURE IS NOW FOOLPROOF (built during the outage, proven against it from a real browser
  on the live site): server-side spill to Blob storage (separate failure domain) whenever the
  DB write fails, so no inquiry is ever lost; /api/health for uptime monitoring; /api/replay
  + a one-click "Add them to the pipeline" banner on Today; Today now SHOUTS "the database is
  unreachable" instead of rendering a reassuring empty page; Slack ping fires either way and
  says explicitly when a lead was saved offline; browser-side localStorage outbox retries a
  failed send on the next page load (7-day TTL). Verified live: 3 leads captured with the DB
  fully down (they are test rows on @import.chasecontemporary.com — purge after replay).
- Newsletter signups now reach the CRM: the footer form (form.nlform) was never bridged.
  It now upserts a collector with newsletter=true + a signup activity, WITHOUT creating a
  fake pipeline inquiry, so it feeds audiences without polluting the sales board.
- SITE IS LIVE 9/4: "CHASE DVN DRAFT v1" #152942346391 published over Prestige on
  chasecontemporary.com (rollback = republish Prestige #151058219159). Local theme pushed
  first so the live asset carries the visitor-id beacon + inquiry bridge; verified in the
  served chase.js. CORS confirmed for both apex and www. Inquiry capture and full-journey
  tracking are now collecting real traffic.
  OPEN CONSEQUENCE: the 939 legacy URLs (research/chase-contemporary/legacy-site-url-inventory.md
  — /artistpage 368, /exhibition 179, /exhibitions 105, /artists 100, /news 26 …) still 404.
  They were 404ing before go-live too, so nothing regressed, but this is now the top SEO/GEO
  task: needs the Squarespace login (Kristine) for content + a Shopify redirect map.
- Private selections (offer links) SHIPPED 8/28, loop tested live: OfferComposer on collector cards + pipeline drawer (up to 10 works, per-work special prices, note, expiry), collector-facing /o/[token] page in the site brand register, view tracking (staff opens don't count), one-tap "I'm interested" that creates a pipeline inquiry assigned to the sender, surfacing on Today pulse ("Selection opened") + collector card (opened Nx / interested in N). Demo: "A selection for Test" on the Test Collector left live to show the flow.
- Today rebuilt as THE landing page 8/28 (post competitive discovery, docs/CRM-DISCOVERY.md): omnisearch (collectors + works), "What's new" pulse (inquiries / money in / forms completed / known collectors seen on the site), "Needs attention" exceptions (answer now, gone quiet 5d+, money to chase, holds running out), 4-number money strip, Move list demoted to bottom. Personalized: reps see their own follow-ups. Old response-queue duplication with Pipeline removed.
- Full-journey attribution BUILT 8/27 (live loop tested end-to-end): anonymous visitor id (localStorage cc_vid) + sendBeacon page views -> site_events; inquiry submit stitches the whole trail to the collector (visitor_links + retro backfill); collector_journey view; "Visits to our site" row in the pipeline drawer. Site-side JS is in the theme and goes live with theme go-live. Later identity moments (Klaviyo click UTMs, checkout) plug into the same tables.
- Comp engine phase 1 + valuation section w/ invoice-cited comps + thumbnails
- Artists page (capital allocation: sell-through x revenue x on-hand, DOUBLE DOWN / MOVE STOCK verdicts)
- Aging move-list on Today
- 45 artist bios (9 site + 36 web-researched w/ source URLs) + About-this-work/provenance
- Unified control law; unit-page luxury pass; details link confirm-mode

## In flight
- (nothing — awaiting Shopify token + wire paragraph)

## PRODUCTION READINESS (audit 8/28 — full report: artifact 054e216c)

### DONE 8/28 (session 2)
- error.js + not-found.js — no more raw white screens.
- Mobile: full @media(max-width:900px) layer (sidebar -> scrolling top bar, snapped kanban,
  wide rows scroll in-card, full-screen drawer) + touch stage picker on cards (iOS never
  fires HTML5 drag events).
- Silent writes: act route wrapped in try/catch with a must() guard on record-critical
  writes; failures redirect with ?err and render a NOT SAVED banner (components/ErrBanner).
  Kanban move/note now revert + report; note box never clears before a confirmed save.
- Commissions deny-by-default: an unrecognised viewer sees nothing (was: saw EVERYONE).
- Invoice requires a collector, server- and client-side (setCustomValidity — `required`
  on a hidden input is ignored by browsers).
- Confirmations + one-shot guards on Mark paid in full / Void / campaign + audience delete /
  Record payment / 50% deposit / Create invoice.
- Money guardrails: no overpayment, no zero/blank, no negative line items. All 5 verified live.
- Migration 0037: RLS on the last 4 tables (every table now enabled); ~24 indexes added —
  details-link lookup went from a 27k seq scan to an index scan, inventory sorts by index.
- scripts/backup.py: full paginated export past the 1000-row cap (35,120 rows, 2.4MB, verified
  readable). backups/ is gitignored.
- /d/ links expire after 14 days; /d/ and /o/ are noindex.

### STILL OPEN — Phase 1
- !! SUPABASE IS ON THE FREE PLAN !! No PITR, no restorable backups, and free projects
  auto-pause after inactivity. 27k collector records + 10yrs of sales. Upgrade to Pro
  (~$25/mo, gallery org "chasecontemporary's Org") — needs Bernie/Devyn billing. Until then
  scripts/backup.py IS the backup: run it and keep a copy off the machine.
- Per-person logins (Supabase Auth). Today: one shared code, cookie value IS the password,
  cc_rep is user-settable so the audit trail (`actor`) is self-declared. The commissions
  hole is patched but identity still isn't real.
- Undo for a settlement (Mark paid in full is confirmed now, but still irreversible).

Phase 1 — BEFORE the team touches it (~1 week):
- Mobile: zero @media queries in the codebase; Finance/Artists/Commissions rows overflow a phone; Kanban HTML5 drag never fires on iOS Safari. Add one max-width:900px block + a stage dropdown per card.
- Silent write failures: only 1 of ~40 actions in act/route.js checks the DB error. Capture + surface via ?err banner (pattern exists on inventory page). Kanban move()/saveNote() swallow errors and saveNote clears the box before confirming.
- No error.js / not-found.js — any throw = raw white screen (Devyn hit this 8/27).
- Auth: single shared code, cookie value IS the password, cc_rep is user-settable so the audit trail is self-declared. AND commissions default to showing EVERYONE (personal only when role==='rep'; no cookie = sees all). Flip to deny-by-default now; Supabase Auth per-person after.
- Invoice with no collector: `required` sits on a hidden input (browsers don't validate) -> no sale row -> close-out never marks the artwork sold / never writes purchase or commission. Invoice reads "paid", inventory silently wrong.
- Zero confirm() anywhere; Void sits beside Mark paid in full; neither is reversible. Add confirmations + an undo-settlement action.
- Backups: no PITR, no export script, no verified restore. 27k collector records.

Phase 2 — first two weeks of selling:
- Double-click = duplicate invoice / duplicate payment (no busy state, no idempotency key on payments).
- Money guardrails: overpayment accepted (hidden by Math.max(0,...)), negative line items allowed, NaN -> null.
- invoice_manual is 6 writes with no transaction; a mid-failure orphans a sale marked 'invoiced' that appears on no screen. Move to an RPC.
- No monitoring/error tracking. Inquiry bridge is fire-and-forget (.catch(){}); degrades to the Shopify inbox, which is the thing we're replacing.
- /d/ details links never expire; add 14-day expiry + noindex on /d/ and /o/.
- RLS off on offers, offer_responses, site_events, visitor_links (all others deny-by-default).
- No rate limiting on /api/inquiry, /api/visit, /api/offer, /api/login.

Phase 3 — before the book gets big (time bombs, nothing wrong today — verified):
- PostgREST caps every request at 1000 rows (verified empirically). Finance counts from newest 200 invoices + sums newest 1000 payments -> drifts within ~1yr of selling. Move balances to a SQL view.
- site_events: no retention, and no index matching Today's query (occurred_at desc where collector_id not null). Breaks Today first.
- Only 11 indexes exist; missing on artworks(available/artist/title), invoices(collector_id/ar_status), payments(status/settled_at), collectors(details_token) — the /d/ page seq-scans 27k rows.
- /pipeline: 8 sequential round trips (most parallelizable) + ~500KB of leads to the browser via select('*').
- collector_index re-aggregates the whole book on every Omnisearch keystroke.
- No tests anywhere — settlement chain is the highest-consequence code in the app.

## Queued (ordered per 8/28 competitive discovery — highest leverage first)
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
- PURGE DEMO DATA before go-live: full cascade on collectors where email like 'demo-%@import.chasecontemporary.com' (Bernie-demo cast seeded 8/28: Ellison/Fontaine/Park/Reyes/Petrov/Cho/Voss/Shah, invoices 0009-0011, Sara commissions $14,880 Aug, offer + site_events for Ellison). ALSO: restore artworks marked sold by demo settlements (Elena Voss 'bought' the already-sold McCrow AK47 - delete the dup purchase row) and re-set inquiries/holds. The 8/27 purge SQL pattern is in the session log.

## Deliberately LAST
- "What Bernie Sees" owner dashboard: killed the placeholder Board page (8/27). Build only after launch, composed from the data every other page is accumulating (Finance collections, Artists velocity, Commissions, campaign attribution, response speed). Not before.

## Parked decisions
- artcloud.market seat: keep during transition or sunset — Bernie
- Squarespace login for archive restore — Kristine
- Consignment economics question (95% of history) — Bernie
- Credential rotation once accounts settle
