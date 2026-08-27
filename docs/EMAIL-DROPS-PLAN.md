# Email Marketing + Drops — business plan

The email program is the demand engine on top of the CRM: the site converts, the pipeline
closes, email creates the moments. Design language = the website's (optic white, black caps
with tracking, wall-label captions, INQUIRE buttons). Hard rule inherited from day one:
**nothing sends without Devyn's explicit approval on the final draft.** The engine drafts;
a human pulls the trigger, every time.

## What's already built (2026-08-26)

- **Audiences** (`/audiences`): saved segments evaluated live at send time — segment
  (everyone / buyers / active pipeline / trade / VIP) × artist interest × minimum lifetime
  spend, newsletter-consented by default, synthetic import emails always excluded.
  Powered by `audience_ids()/audience_count()` in Postgres. Baselines today:
  478 mailable VIPs · 624 consented buyers · 163 Hambleton-interested.
- **Campaigns** (`/campaigns`): draft composer — kind (drop / newsletter / one-off),
  subject + preheader + story copy, artwork picker from available site works, audience
  attachment, live recipient count, pixel-perfect email preview rendered in the site's
  design (`crm/lib/email.js`), approve workflow (draft → approved). Send stays disabled
  until a provider is connected.
- **Taste data underneath**: every collector's artist affinity, price sweet spot, and
  cadence — audiences can target "interested in X" because Sara's Artcloud tags (1,058
  pins) + purchase history + live inquiries all feed the same interest layer.

## The drop model (the business against it)

A **drop** is a manufactured moment: a small set of works released at a stated time to a
prioritized audience. The art-world version of a streetwear release — scarcity + access.

1. **Tiered access:** VIPs (and top-LTV buyers) get the drop 24–48h before the full list.
   The early window is the loyalty reward; it also concentrates the first inquiries into a
   window the sales floor can actually work.
2. **Sequence per drop** (all drafted in advance, each send individually approved):
   - T-3 days · tease — one image, no prices, "NEW RELEASE" mark
   - T-0 · VIP release — full works + prices/POR + INQUIRE
   - T+1/2 · full-list release
   - T+5 · last-look — remaining works, taste-matched segments only
3. **Cadence:** 1–2 drops per month, one newsletter (editorial: press, artist stories from
   the GEO research, studio material) between drops. Never more than one email per list per
   week — the list is the asset; fatigue is the tax.
4. **Measurement (already trackable in the engine):** every inquiry carries source/UTM into
   the pipeline, so each campaign reads out inquiries → conversations → invoices → paid, and
   revenue-per-send. Campaign stats land on the campaign page once sends go live.

## PIVOT 8/27: Klaviyo is the delivery engine (Devyn's call)

Division of labor: the ENGINE owns audience intelligence (taste/LTV/VIP segments Klaviyo
cannot compute) and drop composition (inventory-native, brand-true renders); KLAVIYO owns
delivery, deliverability, compliance/unsubscribes, flows, and open/click tracking, with
native Shopify store integration. Sync design: engine audience -> Klaviyo List via API
(membership refreshed pre-send); engine campaign -> Klaviyo campaign (HTML template +
synced list). Attribution returns via UTM on every INQUIRE into the pipeline.
Nav: one "Email" section with Audiences/Campaigns tabs inside.

## What sending requires (the one external dependency)

- **Klaviyo account under gallery identity** (wyatt@) + private API key; connect the
  Shopify store (one click in Klaviyo); domain auth via DNS at GoDaddy (SPF/DKIM).
- **CAN-SPAM mailing address** to put in the footer ({{mailing_address}} placeholder ready).
- **Unsubscribe handling**: provider list-unsubscribe + a suppression flag on collectors
  (newsletter=false already modeled; unsubscribes sync back).
- Then: send worker (batched, throttled, per-recipient {{first_name}} merge), campaign
  status → sent, per-campaign stats.

## Roadmap

- **v1 (live now):** audiences, drafts, brand-true previews, approval workflow.
- **v1.1 (when provider lands):** real sends + suppression sync + per-campaign funnel stats.
- **v2:** new-artwork-upload → suggested taste-matched audience + pre-drafted drop email
  (the "suggested emails from history" Devyn specced); A/B subjects; send-time optimization;
  post-purchase flows (logistics, condition confidence, "your collection" recap emails).
