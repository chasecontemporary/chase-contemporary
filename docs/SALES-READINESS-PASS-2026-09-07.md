# Sales readiness pass, 2026-09-07: inquiry to booked revenue

One full pass through production, the way a salesperson drives it, plus what is still
missing before Sara, Wyatt and Bernie can run their day on the engine. Findings are
mirrored in BACKLOG.md; this file is the detail.

Method: a synthetic collector (walkthrough-test@import.chasecontemporary.com, never emailed)
was pushed through every real endpoint the UI calls, signed in as Wyatt, from the live
site's inquiry payload to a settled invoice and undo, then torn down. The UI was walked in
Chrome as Wyatt (Today, Pipeline, drawer, sale wizard steps 1 to 3, Finance, Commissions,
collector card). `scripts/test-money-chain.mjs` was run afterwards: 18/18 green. The book
is unchanged: 3 real inquiries, 0 invoices / sales / holds / offers / payments.

## What the pass proved (all on production, 16.4 s end to end)

| Step | Rep action | Engine result | Verified |
|---|---|---|---|
| 1 | Collector browses 3 pages, submits the product-page form | 200 in 400 ms, collector upserted, newsletter flag kept, journey stitched (3 views) | yes |
| 2 | Opens Today, Pipeline | Lead in "Answer now" as unclaimed, "On the site" pulse row, card on the board with image | yes |
| 3 | Claims, logs a call, notes, moves to In conversation | owner, contacted_at, first_called_at, stage_changed_at all stamped, activity trail correct | yes |
| 4 | Holds the work 3 days | Reserve row placed_by Wyatt, work page shows ON HOLD | yes |
| 5 | Sends a details link, collector fills it in | Billing + shipping saved, token burned, link expiry enforced | yes, but see D2 |
| 6 | Sends a private selection, collector opens it and taps interested | View counted, new lead created assigned to the sender, Today shows "Selection opened" + "Form completed" | yes |
| 7 | The paper | Tear sheet + COA generated (10.7 s for both) | yes |
| 8 | Invoices from the wizard: work at 10% off + tax + shipping | One transaction: sale, 3 invoice lines, hold converted, lead moved to Invoiced, balance $22,531 | yes |
| 9 | Generates the PDF, marks sent, records a 50% deposit | PDF on Blob, ar_status sent, balance halves, commission row (0%, RATE PENDING) | yes |
| 10 | Marks paid in full | Invoice paid, work sold, purchase booked, sale paid, second commission row | yes, but see D1 |
| 11 | Commissions as Wyatt, collector card, work page | Personal view, "your rate not set yet"; card shows lifetime $19,800; work page SOLD, "Sold to" | yes |

## Defects found by the pass (D1 is the one that corrupts the board)

D1. A paid sale never closes the lead. After "Mark paid in full" the inquiry stays at
`invoice`, so the card sits in the Invoiced column forever, the Pipeline KPI "Invoiced,
awaiting payment" keeps counting money that is already in the bank, and the collector card
lists the inquiry as "Invoice". Cause: `create_manual_invoice` (db/migrations/0039) writes
neither `invoices.inquiry_id` nor `sale_items.inquiry_id`, so `closeOutInvoice`
(crm/lib/settle.js:725-731) finds no lead to move to `paid`. `unsettle_invoice` has the
same blind spot. Fix: carry `p_inquiry_id` into both rows inside the function.

D2. The collector's last screen after the details form is an error. `/api/details` burns
the token on completion, then redirects to `/d/<token>`, which now renders "This link is no
longer active. Please contact the gallery". The thank-you branch is unreachable. Fix:
redirect to `/p/thanks` (exists) or check `details_completed_at` before the token.

D3. Nobody is told a lead arrived. `SLACK_WEBHOOK_URL` is not set in production, so the
Slack ping in `/api/inquiry` never fires; the only signals are the Shopify contact email to
info@ and opening Today. The three real leads (Sorondo, Scheiwiller, Volpicelli) were
16 h old and unanswered at the time of the pass.

D4. A sold work stays for sale on chasecontemporary.com. Settlement flips
`artworks.available` but nothing reaches Shopify, and the theme has no sold state, so the
product page keeps its price and INQUIRE. The next collector who inquires lands on the
board with a red "marked sold in inventory" note that only appears once a rep opens the
drawer.

D5. The invoice cannot be paid from the invoice. The payment block prints "Wire
instructions are provided under separate cover" (`WIRE_INSTRUCTIONS` unset), there is no
pay link (Shopify off), no due date from the wizard, and no deposit terms when a 50%
deposit is expected.

D6. The collector timeline is partial. `collectors/[id]/page.js:21` loads only activities
whose `entity_id` is the collector, so the call log, stage moves, invoice, deposit and paid
events (all stamped on inquiry or invoice ids) never appear on the person's record.

D7. Today and Finance disagree on money. Today "Collected this month" sums settled
payments ($22,531, tax and shipping included); Finance "Collected in September" reads
`finance_monthly`, which is purchases (art only, $19,800), and "Closed 2026" on Finance
mixes ten years of imported Artcloud purchases.

D8. `POST /api/offer` falls back to `owner: 'Sara'` when the selection has no creator
(crm/app/api/offer/route.js:915). Contradicts the unclaimed rule from 9/7.

D9. Commission rates exist for Sara only (10%). Every Wyatt sale writes $0 "RATE PENDING"
rows (two per invoice with a deposit). Rates can only be set by a verified owner, and Bernie
has no production Clerk account, so nobody can set them today. With the shared code Bernie
sees an empty personal page, not the team.

D10. Small: `payment_received` activity prints "$11,265.5"; run rate reads "$198,000/yr"
after a one-day tenure; "Buys via engine (1)" leaks internal wording; an inquiry with no
work shows "acquire" as its title and a dash as its value on the card; the wizard's step bar
is cobalt where BRAND.md says black is the action colour; the drawer header shows the
phone as plain text, not a tel: link; Today's "Answer now" rows carry no phone or email and
link to the board, not to the lead.

## What salespeople cannot do yet: the build list

Gate 1, before the floor runs its day on it (small code + data, this week):
1. New-lead alerting: set the Slack webhook; notify the claiming rep by email/SMS; escalate
   to everyone if unclaimed after 15 minutes. The 5-minute SLA is already computed on Today,
   it just never leaves the page.
2. Fix D1, D2, D6, D8 (each is a few lines; D1 is one migration).
3. `WIRE_INSTRUCTIONS` from Kristine (Zenzeba Group Inc, JPMorgan Chase) on the invoice, a
   default due date (7 days) and a deposit line when a 50% deposit is expected.
4. Commission percentages and pool membership from Bernie; Bernie and Sara sign in through
   Clerk (production instance) so rates can be set and pay is visible; then retire the
   shared code.
5. Reach the person in one tap: tel:/mailto: on Today's "Answer now" rows and in the drawer
   header; "Open in Pipeline" deep-links to the lead (`/pipeline?lead=<id>` opens the drawer).
6. First reply from the engine: a templated first-response draft (availability, price or
   POA line, tear sheet, selection link) one click from the drawer, opened in the rep's mail
   client, and the send logged on the collector. Everything today is a bare mailto:.

Gate 2, the working week of a rep:
7. Next-action date per lead with a "Due today" list on Today (0/2/7/21 cadence). Leads go
   quiet silently until the 5-day exception fires.
8. A Lost stage with a reason. There is no way to close a lead as lost; Nurture is the bin.
9. Sales tax by ship-to state (nexus rules from Kristine; a state table or TaxJar). The rep
   types tax by hand today.
10. After the money: shipping carrier, quote, tracking, shipped and delivered states on the
    sale (YSDS / Hangman / SBA / FedEx), COA signed and sent, thank-you. The sale ends at
    "paid" today and the collector never hears from the system again.
11. Website sync on settlement: mark sold on Shopify (unpublish or a Sold state in the theme)
    the moment an invoice settles. This is the one Shopify job that cannot wait for the
    merch lane.
12. Pay link (built, needs the Admin token) and card/ACH for tickets under $10k.
13. Invoice care: edit or void lines, re-issue, send the PDF as an attachment from the engine.
14. Collector card: full timeline across inquiry, invoice and work events; a Call button that
    logs; email and SMS history.
15. Mobile verification on a real phone (the 900px layer exists; this pass could not capture
    it).

Gate 3, the multi-rep gallery:
16. Lead routing rules (round robin, by artist, by geography) and claim-from-Slack.
17. Rep scorecards on Team: response time, close rate, revenue, by month.
18. Documents: purchase agreement + DocuSign above $50k; COA gains year, edition, inventory
    number, issue date and Bernie's signature image.
19. Artwork location and movement log (needed the day a sale ships).
20. Duplicate-collector merge and phone-only inquiries.
21. Data hygiene on the 1,440 works on hand: 208 with no location, 272 with no price or
    estimate, 20 with no image. Each weakens the picker, the selection page and the paper.
22. Training manual refresh (artifact 9c35703a): unclaimed leads, reserves, the wizard.

## Data the gallery must supply (not code)

- Wire instructions text (Kristine).
- Commission percentages and who is in the pool (Bernie).
- Sales-tax nexus states (Kristine / accountant).
- Bernie and Sara sign in via Clerk once each (production).
- A Slack channel + webhook for the sales floor.
- Shopify Admin API token with write_products and draft_orders (Bernie / Devyn), when the
  merch lane opens.
