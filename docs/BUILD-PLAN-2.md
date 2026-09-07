# Build plan 2: from "the floor can sell" to "the floor runs on it"

Scope: everything left after the 9/7 stack build (docs/INTEGRATIONS.md). Ordered by what
unblocks a salesperson's day soonest. Each workstream is self-contained: its own migration,
act actions, UI, test, doc line. Two are key-gated (marked). Hard rules apply to all.

## Hard rules (every session, every workstream)
- This is a DVN project, not MOA. Never reference it in MoaOS, MOA repos, or the MOA workspace.
- No em dashes anywhere: code strings, emails, PDFs, docs, commits. Commas, colons, periods.
- Nothing is sent to a collector without a person pressing Send. Alerts to reps are automatic.
- Black is the primary action. Cobalt is links and focus only. Square 2px corners. Tracked caps
  labels. Wall-label typography wherever a work is named (ARTIST caps, *title* italic).
- Usability outranks aesthetics: nothing shrinks, contrast only rises, 36px hit targets.
- Every write goes through /api/act inside `must()`; a rejected write must surface as NOT SAVED.
- Migrations: `db/migrations/00NN-name.sql`, applied with
  `SUPABASE_DB_PASSWORD=<from SECRETS.local.md> node scripts/migrate.mjs db/migrations/00NN-name.sql`.
  Enable RLS on every new table.
- After touching invoicing, payments, settlement, holds or leads: run
  `CRM_CODE=<code> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-money-chain.mjs`
  (20/20). Extend it when the chain grows.
- Test on production with a synthetic collector on `@import.chasecontemporary.com`, tear down
  every row afterwards, restore any work you touched. Never touch a real collector.
- Deploy: commit, `git push`, then `cd crm && vercel --prod --yes --token <Vercel token>`.
- Log what shipped at the top of docs/BACKLOG.md and mirror one line to the Google Doc
  "Chase Engine, Feature Backlog" (gws docs +write, id 1g8EX3McHwPvBdtRRvOaydQbzChmRlMIJzqU17jT39HI).
- Keep the training manual current when a rep-facing behaviour changes.

## Workstreams, in order

### A. After the money (sale fulfilment)
The sale ends at "paid" today; the collector never hears from the system again.
- Migration: `shipments` (sale_id, artwork_id, carrier, quote_cents, tracking, ship_from
  location, ship_to snapshot, status packed | shipped | delivered | installed, dates, notes)
  and `sales.fulfilment_status`.
- Act: `shipment_set` (carrier/quote/tracking/status), `coa_mark_signed`, `sale_close`.
- UI: a "Fulfilment" block on the paid invoice row in Finance and on the collector card:
  carrier picker (YSDS, Hangman, SBA, FedEx, other), quote, tracking, status steps, COA
  signed + sent tick, thank-you template send (needs Resend), "Delivered" closes the sale.
- Today: "Sold, not shipped" exception list.
- Templates: shipping_confirmation, delivered_thank_you (added to lib/templates.js).
- Test: settle -> shipment -> delivered -> sale closed; undo path unaffected.

### B. Invoice care
- Act: `invoice_line_edit` (add / change / remove a line on an OPEN invoice with no payments),
  `invoice_reissue` (void + clone with a new number, keeps lines), `invoice_credit`
  (negative line with reason). Refuse edits once any payment is settled.
- PDF regenerates on every change; the old PDF stays in `documents` as history.
- Finance: an Edit lines drawer on open invoices; a Re-issue button; credit line kind.
- Test: edit before payment allowed, after payment refused, re-issue keeps the sale.

### C. Lead routing and claim-from-Slack (key-gated: Slack app, not just a webhook)
- Migration: `routing_rules` (order, match: artist | source | budget_min | geography,
  assign_to, active) and `team_members.on_duty`.
- Capture: apply rules at insert; unmatched stays unclaimed (the floor rule stands).
- Slack app with interactivity: "Claim" button on the inquiry message posts back to
  `/api/slack/action` (signed with SLACK_SIGNING_SECRET) and assigns the lead.
- Team page: rules editor; on-duty toggle; round robin among on-duty reps as a rule type.

### D. Documents
- Purchase agreement template (pdf-lib, the invoice brand pipeline) with a signature block
  anchored for DocuSign; on-approval agreement. Content assembled from Kristine/Sara's
  current practice; counsel blesses before first use. Data: parties, work, price, schedule,
  title retention, risk, governing law.
- COA gains year, edition, inventory number, issue date, Bernie's signature image
  (assets/img/signature.png) and a GALLERY SIGNATURE anchor.
- DocPreview gains a Documents list per sale; `documents.kind` extended.

### E. Artwork location and movement
- Migration: `artwork_moves` (artwork_id, from_location, to_location, reason: storage |
  framer | photographer | shipped | returned | fair, moved_at, by, note).
- Act: `artwork_move`. Inventory unit page: current location, move log, Move button with the
  known locations (PB, Miami, NY, LA, Solana Beach, Hangman, framer).
- Fulfilment (A) writes a move on shipped.

### F. Collector hygiene
- Duplicate finder: same phone, same name + city, near-identical email; a Merge action that
  re-points inquiries, purchases, invoices, offers, activities, messages, documents, and
  keeps the richer record. Logged.
- Phone-only inquiries: capture accepts phone without email (synthetic email minted, flagged),
  the drawer says "no email on file" and the composer offers Text only.

### G. Rep scorecards (Team)
- Team page: per rep, last 30 / 90 days: inquiries claimed, median first response, holds
  placed, invoices sent, collected, close rate, lost reasons. All from existing tables.

### H. Data hygiene tooling
- Inventory filters: no location (208), no price or estimate (272), no image (20); inline
  edit for location and estimate; bulk "set location" for a filtered set.

### I. Keys land (as Devyn delivers them)
- Set the variable, redeploy, verify the feature live, log it. Order: Slack, Resend + DNS,
  wire text + nexus, Clerk sign-ins + commission rates, Twilio, DocuSign, Shopify, Klaviyo.
- When all four have signed in through Clerk: remove CRM_ACCESS_CODE, /login, RepPicker.

### J. Mobile pass on a real phone, then the manual
- Walk Today, Pipeline (drawer, stage picker), composer, wizard on iOS Safari; fix what
  breaks. Refresh the training manual artifact (9c35703a) for reserves, next action, Lost,
  composer, fulfilment.

## Parallelism
A, B, D, E, G, H touch different tables and pages and can run in parallel worktrees.
Shared hotspot: `crm/app/api/act/route.js`. Each workstream adds its actions in ONE
contiguous block placed just above `} else if (action === 'note') {` and nowhere else, so
merges are trivial. C waits for the Slack app; I waits for keys; J is last.

## Definition of done, per workstream
1. Migration applied on production and committed.
2. Act actions inside `must()`; human-written errors; json + redirect paths both work.
3. UI in the register, on desktop and at 390px.
4. Live pass with a synthetic collector, torn down; money chain still green.
5. BACKLOG.md line + Google Doc mirror; manual updated if rep-facing.
6. Deployed; commit message says what a rep can now do.
