# Build plan 3: one engine

Everything built so far works. It is not yet one system. A work is described in the engine
and sold on a website that knows nothing about it; money arrives in a bank the engine cannot
see; paper is generated in the engine and signed somewhere else. This plan closes those seams
so that a person at the gallery does their whole day inside the engine and the other services
behave like limbs rather than destinations.

## The two spines

Everything in the business is an event on a **work** or on a **person**. If a feature does not
advance one of those, it does not belong.

```
a work     acquired -> valued -> photographed -> published -> reserved -> invoiced
           -> paid -> papered -> shipped -> delivered -> owned by someone

a person   seen -> captured -> claimed -> spoken to -> shown things -> invoiced
           -> paid -> served -> sold to again
```

The engine already owns most of both. It stops being one system at exactly five seams.

| Seam | Today | Closed by |
|---|---|---|
| Publishing a work to the site | 187 of 1,440 available works are public. By hand. | A |
| A purchase coming back | Only a pay link settles an invoice. A normal checkout reaches nothing. | B |
| Money landing | Wires are typed in. Shopify payouts are invisible. | C |
| Paper getting signed | Agreements generate, nothing can be sent. | D |
| Letters going out | Composers fall back to a mail draft. | D |

## Where the numbers actually stand

| | |
|---|---|
| Works in the book | 4,198 |
| Available to sell | 1,440 |
| Available with an image | 1,420 |
| Available with a price | 1,168 |
| Carrying a Shopify product id | 187 |
| Collectors | 27,041 |
| Historical purchases imported | 2,659 |
| Orders the store has ever taken | 0 |

That last line is the risk running under all of this. The storefront has never taken money.
Nothing here ships to everyone at once.

## Decisions taken (Devyn, 2026-09-18)

1. **Publish everything we have a picture of, but Bernie approves before anything goes live.**
   A bulk push stages works as drafts. Nothing reaches the public without him pressing approve.
2. **Editions can be bought outright. Originals never.** An original is always Price on request
   and always goes through a rep.
3. **The engine is the ledger.** Wires, Shopify payouts and commissions reconcile in Finance,
   and Kristine exports to QuickBooks from there.

## Hard rules, unchanged

- DVN project, never referenced in MoaOS, MOA repos or the MOA workspace.
- No em dashes anywhere: code, emails, PDFs, docs, commits.
- Nothing is sent to a collector without a person pressing Send. Alerts to reps are automatic.
- Every write goes through /api/act inside `must()`; a rejected write surfaces as NOT SAVED.
- Black is the primary action, square 2px corners, wall-label typography wherever a work is named.
- Test on production with a synthetic collector on `@import.chasecontemporary.com`, tear down
  after, restore any work touched. Never touch a real collector.
- After touching invoicing, payments, settlement, holds or leads, run `scripts/test-money-chain.mjs`.
  After touching any page, run `scripts/test-pages.mjs`. After capture, `scripts/test-capture.mjs`.
  After agreements or signing, `scripts/test-signing.mjs`.
- Every account under the gallery identity so it transfers. The Shopify app is already correct:
  created in the Chase Contemporary organization as wyatt@chasecontemporary.com.

---

## A. Publishing: get the inventory in front of people

The point of the whole Shopify exercise. 1,253 available works are invisible today.

**A1. The readiness gate.** Extend `crm/lib/readiness.js` into one function that answers, for a
work, whether it may be published: an image at or above the minimum pixel width, a sharpness
score above the floor (`research/image-quality-scores.csv` already holds these), an artist, a
title, a medium, dimensions, and either a price or a deliberate Price on request. Anything
failing lands in Inventory under the existing "Fix the record" chips instead.

**A2. Bulk staging.** A `publish_stage` act action that pushes a filtered set as Shopify
products with `status: draft`, in batches that respect the Admin API rate limit, writing
`shopify_product_id` back so it is idempotent and a re-run never duplicates. Originals push with
no purchasable price so the theme renders INQUIRE; editions push with their price so it renders
ACQUIRE. Reconcile against the 187 already live rather than pushing over them.

**A3. Bernie's approval queue.** A page, `/approvals`, that is his and only his: each staged work
as it will actually look, image large, wall label, price or POA, with Approve and Send back. Approve
flips the Shopify product to active and stamps `site_status`. Send back returns it to Inventory
with a reason. Bulk approve a whole artist in one press, because 1,400 works one at a time is not
a real thing to ask of anyone. This is also the honest version of the owner dashboard that was
deliberately parked: it exists now because he has a job to do on it.

**A4. Publishing in waves.** The queue is filtered by artist, so a release is one artist at a time.
Each approved wave is a reason to send a drop, which is what the email engine was built for.

**A5. The site can carry it.** Confirm collections exist for every artist being published, that the
gallery corridor and artist pages pick up new works automatically, and that 1,400 products do not
slow the collection pages. Check before the first big wave, not after.

Done when: Bernie has approved at least one full artist, those works are live, and a work that
fails the gate cannot be pushed.

## B. Checkout comes back into the engine

**B1. Close the hole.** `/api/shopify-webhook` currently settles an invoice only when the order
carries `engine_invoice_id` from a pay link. Add `orders/paid` handling for an order with no such
attribute: match or create the collector by email, create the sale, create an invoice already
marked paid, book the purchase, mark the work sold, write the commission, and log it on the
collector's timeline. Register the webhook at install through `ensureWebhook`.

**B2. Refunds and cancellations.** `refunds/create` and `orders/cancelled` run the existing
`unsettle_invoice` path so a reversal is never a manual repair.

**B3. Originals cannot be bought, enforced twice.** Once at publish, an original goes up without a
purchasable price, and once at the webhook, an order containing a work marked original is accepted
but flagged loudly on Today for a rep to look at rather than silently booked.

**B4. Who gets the commission.** An unattended sale has no rep. It books to the house by default,
and a rep can claim it from the collector card if it was in fact their collector. Decide the
default with Bernie before the first edition sells, not after.

Done when: a real edition is bought end to end on the live site with a card, it appears in Finance
and on the collector as paid, the work goes off sale, and a refund puts it all back.

## C. The money is one number

**C1. Payout sync.** Pull Shopify Payments payouts and their transactions into Finance so card
money is visible beside wire money, with the fee separated out. Without it, Finance is only ever
telling half the story.

**C2. One definition of collected.** Today and Finance were made to agree on the 17th. Extend the
same rule to card money so there is never a second answer.

**C3. The export Kristine needs.** A dated CSV from Finance: invoices, payments, fees, refunds and
commissions, in a shape QuickBooks accepts. She should never be asked to read a screen.

**C4. Wires stay manual, for now.** A bank feed matching Chase wires to invoice numbers is the
right end state and is explicitly not in this plan. Note it in the backlog and move on.

Done when: a month of card and wire money reconciles to the cent, and Kristine has taken one export
without asking a question.

## D. The dormant lanes, in the order they unblock

Each is built and tested. Each needs one account or one DNS record. None of them is code.

1. **Shopify token.** Install the app, put `SHOPIFY_ADMIN_TOKEN` and `SHOPIFY_API_SECRET` in Vercel.
   Everything in A, B and C depends on this one.
2. **Resend DNS.** Three records in GoDaddy through Kristine, then `MAIL_FROM`. Turns on every
   collector letter, the rep alerts and the morning digest. The draft is already in Devyn's Drafts.
3. **DocuSign.** Account, app, consent, Connect webhook, eight variables. `docs/SIGNING.md` is the
   runbook. Start the sandbox early: promotion to production needs 20 envelopes and a review.
4. **Counsel.** The agreements print a draft watermark until `AGREEMENTS_REVIEWED=1`.
5. **Slack signing secret,** plus reinstalling the app for the two new scopes, to turn on Claim.
6. **Wire instructions and tax nexus** from Kristine, so an invoice is payable from the invoice.
7. **Commission rates and pool** from Bernie, so pay stops reading RATE PENDING.
8. **Klaviyo, last and only when a drop is scheduled.** It is $400 to $500 a month at 27k profiles
   against about $90 on Resend broadcasts. Do not pay for it before there is something to send.

## E. Retire the seams

- **Remove the shared access code,** `/login` and RepPicker, the moment all four have signed in
  through Clerk. It is the single biggest hole left in the system: the cookie value is the password.
- **The 939 legacy URLs** still return 404. Build the redirect map now for every old URL whose
  subject still exists, using the Admin API. The rest waits on the Squarespace login from Kristine.
- **Artcloud.** Decide whether the seat lapses. The import is done and nothing reads it live.

## Sequence

```
now        Shopify token          -> everything else in A, B, C
then       A1 A2, staging         -> A3 approvals, with Bernie in the room for the first wave
alongside  D2 Resend DNS          -> letters and the digest go live
then       B1 B2 B3, one artist   -> one real edition sale, then a refund
then       C1 C2 C3               -> the first clean month
alongside  D3 DocuSign + D4 counsel -> the first signed agreement
last       E                      -> the shared code dies
```

## The canary rule

The storefront has never taken an order. Before any wave: publish one artist, buy one edition with
a real card, refund it, and confirm the engine told the truth at every step. Only then scale. A
gallery discovering a broken checkout through a collector is not a recoverable mistake.
