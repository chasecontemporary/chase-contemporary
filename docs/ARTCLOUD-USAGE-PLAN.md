# Artcloud → Chase Engine: usage-driven parity plan

Deterministic rule: a feature earns a place in the Chase Engine only if their own data proves
common use. Measured 2026-08-26 from the full exports (27,017 contacts / 1,446 inventory /
2,661 sale lines, $50.7M). Feature list ranked by evidence, then built in waves.

## Evidence table (what they actually use)

| Artcloud feature | Evidence of use | Verdict |
|---|---|---|
| Physical locations per work | 100% of inventory has Location: Hangman 534, WPB warehouses ~390, Solana 71, consignees ("Peter Tunney" 23, "Eastern Projects" 39), "Sold to X", "On Open Invoice to X" | **CORE — we have nothing. Build.** |
| Consignment economics | 2,528 of 2,661 sale lines = Ownership "Consignment" with a consignment cost (typ. 50%) | **CORE — contradicts "Bernie owns all"; engine must carry per-work cost + margin** |
| Rep attribution on sales | User on every line: Nicole Donaldson 2,389, Isabel Sullivan 93, Palm Beach 72, Giavanna Mattera 53, C. Pusey 26 | Covered (team layer) — import historical rep onto purchases |
| Contact tags as taste system | 548 "VIP list" + artist-name tags (Connor Brothers 154, Artsy 154, Hambleton 138, RETNA 129…) | **Backfill tags → pinned interests; VIP segment** |
| Discounts | 1,015 / 2,661 lines (38%) | Covered (deal-ticket chips) — keep |
| Sales tax on invoices | 842 lines | **Add tax line to invoices** |
| Private notes on contacts | 2,713 contacts | Covered (imported to notes) — surface better |
| Origin / relationship type | Client 2,320, Press 345, Art Consultant 91, Interior Designer 82, Critic 49, Auction House 39 | Covered (source) — add as filter |
| Artcloud Marketplace listings | 1,136 works live on artcloud.market; inquiry notifications observed in-app | **Transition decision needed — it is a live lead source** |
| Shipping on invoices | 44 lines | Minor — one optional line item |
| Editions | 163 inventory rows | Minor — edition label on unit page |
| Payment method logging | ~25 lines with real values (Wire/Visa/Square) | Minor — free-text field on payment |
| Framed / frame cost | 186 framed, frame cost on lines | Minor — attribute on unit |
| Purchased price / insurance value | 122 / 25 rows | Rare — columns exist in import, no UI needed |
| To-Do's | "No To-Do's yet" on their Home | NOT used — skip (Today page already stronger) |
| UTM on contacts | 5 of 27,017 | NOT used — skip (we already capture UTM live) |
| "Interested" field | empty on all 27,017 | NOT used — our taste engine replaces it |
| Artcloud Website module | On Website = No for all 1,446 | NOT used — skip |

## Waves

### Wave 1 — inventory truth (location + economics)  ← the real gap
1. `artworks.location` + import from CSV; Inventory page: location filter + "value by location"
   rollup (they think in warehouses: Hangman / WPB / Solana / consignees).
2. `artworks.ownership`, `consignment_cost_cents`, `purchased_price_cents`, `frame_cost_cents`;
   import. Sale drawer + finance show **margin per sale** (sold − consignment/cost), because
   38% of lines discount and 95% carry a consignment split — margin is the number that matters.
3. Import historical rep (User) onto purchases as `sold_by`; team page gains all-time leaderboard
   including historical reps.

### Wave 2 — invoice completeness
Tax line (842 uses), optional shipping line (44), payment method note on mark-paid.
PDF + Stripe links stay in v2 backlog.

### Wave 3 — taste + segments
1. Backfill contact artist-tags → `collector_interests` (kind artist, added_by import).
2. VIP segment chip on Collectors (tag "VIP list").
3. Audiences = saved segments (named filter over collectors) — the bridge to the phase-2 email
   module; build the segment store now, email later.

### Wave 4 — flows observed at the edges
"On approval / on open invoice" state for a work (out with a client or partner gallery, due
date, convert-or-return) — evidenced by location strings. Layaway/installments stay v2 unless
Bernie confirms use.

### Wave 5 — marketplace transition (decision, not code)
1,136 works listed on artcloud.market generating inquiries. Options: keep the Artcloud seat
for marketplace only during transition, or sunset and let the new site + GEO replace it.
Flag for Bernie call. Also: bulk image export request to support@artcld.com (sold works have
no images locally).

## Open questions for Devyn/Bernie
- Consignment reality: 95% of historical sales carry a consignment split. Who are the
  consigners — artists, or Bernie's other entities? Commissions math depends on it.
- Nicole Donaldson sold 2,389 of 2,661 historical lines — who is she? (Not in the roster we
  were given.)
- Marketplace: keep or sunset?

---

## DECISIONS (Devyn, 2026-08-26)

Past data is context, not gospel: the engine is a NEW operating system for a NEW sales funnel.
Consignment history does NOT reshape the commissions design (pool model stands). Implement
what makes sense forward, keep what we love. Final change list:

**Changing / adding**
1. Inventory locations: `artworks.location`, import from CSV, location filter + value-by-location
   rollup on Inventory. (Works physically live in 5+ storages; ops needs this daily.)
2. Invoice completeness: sales-tax line, optional shipping line, payment-method note on mark-paid.
3. Taste backfill: Sara's artist tags -> pinned interests; VIP list -> VIP segment chip on Collectors.
4. Audiences: saved named segments over collectors (foundation for phase-2 email module).
5. On-approval flow: minimal — a work out with a client/partner (who + due date + convert/return),
   built on the holds table. LOW priority, after 1–4.

**Keeping as-is (already stronger than Artcloud)**
Pipeline/Kanban + drawer, deal-ticket discounts, team attribution + leaderboard, Today page,
taste engine, LTV command center, one-invoice-per-sale bundles, commissions pool on settlement.

**Explicitly dropped**
Consignment cost/ownership modeling (historical artifact), historical rep leaderboard,
To-Do's, Artcloud Website module, per-contact UTM fields, layaway (unless Bernie asks).

**Still open for Bernie:** artcloud.market keep-or-sunset (1,136 listed works, real inquiries).
