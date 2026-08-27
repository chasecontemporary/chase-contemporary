# Competitive discovery — gallery CRMs vs the Chase Engine (2026-08-28)

Research agent sweep of Artlogic, ARTERNAL, ArtCloud (the incumbent Chase left), Artsy for
Galleries, ArtBinder, Art Galleria, Artshell; ArtBase treated as dead. Lens: a 2-4 person
team, ~27K contacts, ~1,400 works — do not overbuild.

## Where the engine already leads the category

- Full web-visit / UTM / journey attribution: nobody in the category has it.
- Kanban pipeline w/ heat scoring + collector LTV context: beats Artlogic's list pipeline,
  matches ARTERNAL's auto-scoring pitch.
- Collections follow-up ladder (Unsent → FU1/2/3 → Paid): competitors only offer
  "set a follow-up date."
- Rep commissions computed on collected cash: everyone else pushes this to spreadsheets.
- Klaviyo-backed email: competitors' native campaign tools are their most-complained-about
  feature; deliverability is a solved problem we rent.
- Branded documents (invoice/tear sheet/COA), partial payments: parity or better.

## The daily loop (from reviews + job listings)

Look up a work → send a beautiful offer → log the response → invoice → chase payment.
The engine covers four of five at or above category level. The missing step is the
tracked offer link.

## Missing + high leverage (now ordered in BACKLOG.md)

1. **Offer sheets / private-view links** — tokenized branded page of 3-10 curated works
   with prices for one collector, viewed-tracking. The single most-praised feature in
   Artlogic reviews (PrivateViews); ARTERNAL sells the same. We have the infra: tokenized
   pages + site_events tracking.
2. **Reserves on works with expiry** — auto-release, stops two reps selling one canvas.
   (Not take-home trials; the work never leaves the wall.)
3. **Email logging to collector records** — a BCC dropbox that files mail onto the
   timeline. ARTERNAL built a company on "the deal history lives in the inbox."
4. **Artwork location field + movement log** — asked hourly in a working gallery.
5. **Artist sold-works statement PDF** — read-only, off existing sale lines; artists will
   ask "what sold, what am I owed" even with consignment accounting dropped.

## Deliberately skipped (bloat by the evidence)

Unified WhatsApp/WeChat inbox (brittle, 20-seat feature) · built-in website builder
(#1 complaint source across competitors; Shopify site is better) · native email engine
(Klaviyo's job) · native payments (Shopify's job) · fair-organizer tooling, artist
submission portals, auction-data modules, library cataloguing (Artlogic's "built for
archiving, not selling" trap) · accounting modules (every QuickBooks integration in the
category is reviewed as broken) · custom report builders (purpose-built views beat a
report engine at 4 users) · offline iPad fair apps (responsive private-view links cover it).

## Home screens across the category → what we built

ArtCloud: to-dos + notifications + activity feed. Artlogic: global search box first.
ARTERNAL: revenue dashboard. Artsy: inbox + analytics. Consensus for a small team:
**action feed + omnisearch**, not a metrics wall. Today (rebuilt 8/28) = omnisearch +
what's-new pulse + needs-attention exceptions + a 4-number money strip; the metrics wall
stays deferred as Bernie's post-launch page.

Full agent report with sources lives in the session log; key sources: artlogic.net,
arternal.com/crm + /reporting, help.artcloud.com dashboard docs, Capterra reviews
(Artlogic, ArtCloud), partners.artsy.net, artgalleria.com, artbinder.com, artshell.eu.
