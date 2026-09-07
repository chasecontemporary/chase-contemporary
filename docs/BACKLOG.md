# Chase Engine — Feature Backlog

Canonical idea ledger. RULE: when Devyn drops a new idea mid-build, the current build finishes,
the idea lands HERE (and the Google Doc mirror) immediately — nothing gets skipped.
Status: QUEUED (accepted, unbuilt) · IN FLIGHT · NEEDS KEY (blocked on account/credential) · PARKED (decision pending).

## Shipped since last update
- SALES READINESS PASS 9/7 (docs/SALES-READINESS-PASS-2026-09-07.md): one synthetic collector
  driven through production as Wyatt, site inquiry -> claim/call/note -> hold -> details link
  -> private selection -> paper -> invoice (work + tax + shipping) -> PDF -> 50% deposit -> paid
  in full -> undo; 16.4 s end to end, torn down after, money chain 18/18. Ten defects found by
  USING it; D1-D3 gate the floor:
  * D1 PAID SALE NEVER CLOSES THE LEAD: create_manual_invoice (0039) stores no inquiry_id on
    invoices or sale_items, so closeOutInvoice moves nothing; card sits in Invoiced forever,
    "Invoiced · awaiting payment" counts banked money.
  * D2 details link: after submit the collector is redirected to the burned token and sees
    "This link is no longer active" instead of thank-you.
  * D3 SLACK_WEBHOOK_URL is NOT set in production: no one is told a lead arrived. The 3 real
    leads were 16h old and unanswered at the time of the pass.
  * D4 sold works stay for sale on the site (no Shopify sync, theme has no sold state).
  * D5 invoice not payable from the invoice (WIRE_INSTRUCTIONS unset, no due date, no deposit
    line). D6 collector timeline misses inquiry/invoice events. D7 Today vs Finance money
    definitions differ (payments vs purchases). D8 /api/offer falls back to owner 'Sara'.
    D9 only Sara has a commission rate; Bernie cannot set rates without a Clerk sign-in.
    D10 polish list (tel: links, Answer-now deep link, "$11,265.5", run rate, wizard bar colour).
  Build list (22 items, three gates) is in the doc; Gate 1 = alerting, D1/D2/D6/D8 fixes,
  payable invoice, rates + real sign-ins, one-tap call, first reply from the engine.

- INQUIRY TRIAGE 9/7 (migration 0041) — Joe Volpicelli exposed the problem: he was in the
  SALES pipeline as a lead, but his message is him offering to SELL the gallery a Peter
  Tunney. Every message landed on the sales board regardless of intent, inflating the
  pipeline and wasting a rep's attention. Root cause: the site form had no "selling to us"
  option, so sellers picked "General inquiry".
  * inquiries.kind = buying | selling | press | other, classified at capture from purpose
    (lib/capture.js `classify()`), backfilled from existing data.
  * Sales pipeline now queries kind='buying' ONLY. Its KPIs are finally honest.
  * Today gained "Not a sale · still needs a reply" — the rest shown with tap-to-call phone,
    email and the message inline, tagged OFFERING US WORK / PRESS / GENERAL, so nothing is
    dropped, it just isn't a lead.
  * Live site contact form now offers "SELLING A WORK TO THE GALLERY" so it is classified
    at the source instead of guessed.
- MADE IT ACTUALLY USABLE FOR WYATT 9/7 — walked the whole app signed in as him and fixed
  what a real user hits. Found by testing, not by reading code:
  * NOBODY HAD EVER SIGNED IN VIA CLERK (0 users, 0 invitations) — the entire auth path was
    untested. Created wyatt@chasecontemporary.com (user_3J0Q8x8aJcosbpn3w29sVOUGwjS) and
    signed in as him end to end. Identity mapping WORKS: Today reads "showing Wyatt's
    follow-ups", Commissions is rep-scoped to him.
  * BLOCKER: Clerk Organizations were enabled, so signing in dumped the user on a "create an
    organization" screen. We don't use Clerk orgs at all — roles come from team_members.
    Disabled via the Backend API (organization_settings enabled:false).
  * The sidebar still showed the old self-selected name picker reading "Choose…" while Clerk
    already knew who he was, and there was NO WAY TO SIGN OUT. Replaced with a real
    identity block (name, Owner/Salesperson, Sign out) whenever the session is verified.
  * Every inquiry was hard-coded `owner: 'Sara'`, so any other rep's personalised views were
    permanently empty and they'd have to reassign by hand. New inquiries now arrive
    UNCLAIMED; the board and Today show "Unclaimed" in amber, and the drawer's Salesperson
    dropdown claims it. The three real leads were auto-stamped Sara by that default and had
    no first response after 14h, so they were reset to unclaimed — reassign if that's wrong.
  Sign-in flow as it stands: email -> password -> 6-digit emailed code on each new device.
- RATE LIMITING 9/6 (migration 0040) — the last open finding from our own security audit.
  Counted in Postgres via bump_rate_limit(), not memory: serverless instances reset
  in-memory counters on every cold start, so a per-instance limiter is no limiter at all.
  Limits: /api/login 10 per 15 min per IP (it previously accepted UNLIMITED guesses at the
  shared access code), /api/inquiry 20/hr, /api/offer + /api/details 40/hr, /api/visit
  400/hr and dropped SILENTLY so a throttled beacon never shows an error on the gallery's
  website. Two deliberate choices: limits are far above any real behaviour so a collector
  is never blocked, and if the limiter itself errors the request PROCEEDS — losing a lead
  is worse than letting a burst through. Verified live: the 11th login attempt was refused
  and the counter cleared afterwards so nobody was locked out.
- SECURITY AUDIT + HARDENING 9/6 (full sweep: authz, injection, XSS/SSRF, secrets, git
  history, deps, headers, webhooks, tokens, PII storage). FIXED AND VERIFIED LIVE:
  * ACTIVE PII EXPOSURE — six API routes (collectors, works, team, audience-count, replay,
    rep) sat behind "is anyone signed in?" with no staff check. With Clerk public sign-up
    enabled, a stranger could sign up and harvest real names/emails/cities/lifetime spend
    from /api/collectors. All now require isStaff().
  * /d/ LINK EXPIRY WAS DEAD CODE — the page checked details_requested_at but never
    SELECTed it, so links never expired; the write endpoint had no expiry or single-use
    check at all. A leaked link was a permanent write handle on a collector's name, phone
    and both addresses. Now: column selected, expiry + single-use enforced server-side,
    token burned on completion.
  * POSTGREST FILTER INJECTION — supabase-js does not escape .or() filter strings, so the
    search `q` on /api/collectors, /api/works and /inventory could query columns the
    endpoint never returns (internal valuations, notes) as a boolean oracle. Input is now
    stripped of PostgREST grammar before it reaches the filter.
  * OPEN REDIRECT — `back` on /api/act was used raw as Location; now must be a local path.
  * UNAUTH STORAGE ABUSE — /api/inquiry had no length caps on any stored field; 21 fields
    now capped and non-strings rejected (this also closed a path that forced public blob
    writes via type confusion).
  * SPILL PII ENTROPY — inquiry payloads were named with Math.random() + addRandomSuffix
    OFF while sitting at public blob URLs. Now crypto-random + the store's own suffix.
  * NO CLICKJACKING DEFENCE — added X-Frame-Options DENY, frame-ancestors none, nosniff,
    Referrer-Policy. /api/act settles and voids invoices from plain form posts.
  * RAW DB ERRORS reached the browser via ?err= — now logged server-side, generic message
    shown; our own human-written errors still pass through.
  * MITM ON MIGRATIONS — scripts/migrate.mjs had rejectUnauthorized:false while sending the
    DB password. Now verifies against a pinned Supabase root CA (db/supabase-root-ca.crt).
  * Campaign preview iframes had no sandbox; lib/email.js esc() did not escape quotes.
  VERIFIED CLEAN: no credential ever committed (all 4,324 git blobs scanned); no secret in
  any client bundle; Shopify + Stripe webhook signature verification is correct (raw body,
  timing-safe, fails closed — and both are inert with no secret set); no dangerouslySetInnerHTML
  anywhere; /d/ and /o/ tokens are 160-bit crypto-random; both noindex; blob store is not
  listable; no reachable dependency CVE (the 2 npm audit findings are build-time postcss).
  STILL OPEN — the shared CRM_ACCESS_CODE fallback grants full staff access with no rate
  limit, no lockout, no revocation, and the cookie value IS the password. It is deliberate
  (no-lockout during the Clerk migration) and is now the single biggest remaining hole.
  REMOVE IT the moment all four have signed in via Clerk.
- ENGINE FINISHING PASS 9/6 (migration 0039): invoice creation is now ONE transactional
  Postgres function (`create_manual_invoice`) — a mid-way failure used to orphan a sale
  marked 'invoiced' with no invoice, invisible on every screen; "Mark paid in full" is now
  REVERSIBLE (`unsettle_invoice` + an Undo payment button) — it was the only permanent
  action in the system; Finance balances come from the `invoice_balances` view instead of
  summing a payments fetch capped at 1000 rows (the money on screen would have started
  drifting once the gallery passed a thousand payments).
- Pipeline went from 9 SEQUENTIAL round trips to 3 waves and drops the fields the board
  never renders (referrer, utm, device, seconds_on_page, price_band, outlet, visitor_id).
  Sub-second warm.
- scripts/test-money-chain.mjs: 18-assertion regression test over the real endpoints
  (transactional create, no-collector refusal, negative-line refusal, balances, overpayment
  refusal, partial payment, reserve conflict x2, settlement side-effects x4, undo x5,
  teardown). 18/18 passing. Run it after touching invoicing, payments, settlement or holds.
- RESERVES SHIPPED 9/6 (migration 0038). A hold sits on the WORK, not the lead, so two reps
  cannot promise the same canvas. Built on the existing holds table with kind='reserve'
  (+ placed_by, note, inquiry_id, released_at) and an `artwork_reserves` view that reports
  lapsed-vs-active on read, so an expired hold stops blocking with no cron job.
  Guards (the actual value, all verified live): invoicing a work held for someone else is
  REFUSED with a message naming who holds it, until when, and which rep placed it; a second
  hold for a different collector is refused; invoicing for the rightful holder succeeds and
  auto-converts the hold. Surfaces: pipeline drawer ("Is this work spoken for?" — hold for
  1/3/7/14 days with a reason), work page (ON HOLD pill + who/why/release), and Today's
  "Holds running out" now driven by real work reserves instead of the lead stage.
- Migrations work again WITHOUT the revoked management token: scripts/migrate.mjs connects
  straight to Postgres through the shared pooler using SUPABASE_DB_PASSWORD from
  SECRETS.local.md (per-project host vanishes when a project pauses; the pooler does not).
- 9/6 ENGINE CLEANED TO REAL BUSINESS ONLY. Pipeline = 3 genuine inbound leads. Invoices,
  payments, commissions, sales, holds, offers all at 0. Activity log down to 7 real entries.
  Removed: a stale on-approval hold and its fabricated events, which sat on a REAL
  collector's timeline (Michael Joseph Netsky, the $1.46M top buyer, appeared to have taken
  a work on approval — he never did); 15 activities orphaned by the demo purge. Verified no
  real collector carries test billing data, no live details tokens remain, and no runaway
  internal estimates. Book intact: 27,039 collectors / 1,000 buyers / $50.7M / 1,440 works
  available. site_events shows real anonymous traffic arriving now.
- 9/6 RECOVERED. Wyatt restored the Supabase project; data came back 100% intact (every
  table matched the 8/28 export exactly). The service-role key survived the restore, so no
  env changes were needed. Sequence run: verified schema+data -> replayed all 6 parked
  inquiries (0 left) -> confirmed the 3 real collectors landed as Inbound -> purged the demo
  cast + all test rows (12 synthetic collectors; $225k of fake sales and 2 fake buyers
  removed; real book intact at 27,039 collectors / 1,000 buyers / $50.7M) -> re-tested the
  live capture loop (writes straight to the DB now, no longer parking) -> fresh backup
  (35,055 rows) taken and copied to Drive as the new baseline.
  NOTE: scripts/verify-restore.py had a bug that cried wolf about 8 "missing" objects —
  it queried select=id on views and visitor_links, which have no id column. Fixed to select=*.
  STILL TO CONFIRM: that the project is actually on Pro now. If it is still on the free
  tier it will pause again after ~7 days idle. Also still needed: a fresh sbp_ management
  token (the old one is revoked, so migrations currently have to go through PostgREST).
- 9/6: the outage screen now LISTS the parked leads with tap-to-call phone + email, so a
  database outage no longer blocks selling — captured is not the same as usable. Real leads
  are also exported to Drive ("Chase — inquiries captured during the database outage").
- 9/6 BERNIE REQUEST — ALREADY SATISFIED, no action taken: "Andres Valencia Surreal Man has
  to come off the website." Verified across all 199 published products: `surreal-man-2024`
  returns 404, is in no collection and no search result. The ONLY live Valencia is
  `untitled-2` "Untitled, 2024", which the image confirms is THE COUPLE — the piece Bernie
  explicitly said can stay. DO NOT unpublish it (it is also the work Roni Sorondo inquired
  about on 9/6). `alberto-the-clown-2024` (the print) is currently OFF (404).
  OPEN QUESTION for Bernie: he said "only the Jeri Lynn piece can seat there and one print
  that is there already" — we hold no work titled Jeri/Lynn by Valencia, and the Valencia
  print is currently off. Worth one line back to him to confirm which piece and which print.
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
- CLERK — PRODUCTION LIVE 9/6. App "Chase Contemporary" app_3Iymy9uMJ9X4CtIO4nBKxPaUENR,
  owned by wyatt@chasecontemporary.com. **pk_live/sk_live are set in Vercel.** Clerk bound
  production to `clerk.chase-engine.vercel.app` and serves it through the `/__clerk` proxy
  path, so NO DNS was needed (a custom domain was briefly added to Vercel then removed).
  All four team_members carry the email Clerk matches on (bernie@ added 9/6).
  !! TWO DASHBOARD SETTINGS STILL WRONG — read from the live instance:
    a) `sign_up mode = public` — anyone reaching /sign-in can create an account.
       CODE NOW BLOCKS THEM (see below), but turn it to restricted/invite-only anyway.
    b) `password = required`, `email verifications = ['email_code']` — it is asking for a
       PASSWORD, not the email link Devyn wanted. Switch the sign-in method to **Email link**.
  Defence in depth added 9/6: `isStaff()` in crm/lib/identity.js — a signed-in account whose
  email is not in team_members is refused by `Shell` (every page renders through it, shows a
  plain "this account isn't on the team" screen) AND by /api/act, so a stranger who signs up
  cannot read or write anything. A dashboard toggle is never the only thing protecting 27k
  collector records.
  LAST STEP once all four have signed in: remove CRM_ACCESS_CODE, /login and RepPicker.

## Housekeeping
- PURGE DEMO DATA before go-live: full cascade on collectors where email like 'demo-%@import.chasecontemporary.com' (Bernie-demo cast seeded 8/28: Ellison/Fontaine/Park/Reyes/Petrov/Cho/Voss/Shah, invoices 0009-0011, Sara commissions $14,880 Aug, offer + site_events for Ellison). ALSO: restore artworks marked sold by demo settlements (Elena Voss 'bought' the already-sold McCrow AK47 - delete the dup purchase row) and re-set inquiries/holds. The 8/27 purge SQL pattern is in the session log.

## Deliberately LAST
- "What Bernie Sees" owner dashboard: killed the placeholder Board page (8/27). Build only after launch, composed from the data every other page is accumulating (Finance collections, Artists velocity, Commissions, campaign attribution, response speed). Not before.

## Parked decisions
- artcloud.market seat: keep during transition or sunset — Bernie
- Squarespace login for archive restore — Kristine
- Consignment economics question (95% of history) — Bernie
- Credential rotation once accounts settle
