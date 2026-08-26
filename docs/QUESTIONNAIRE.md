# Chase Revenue Engine — Master Questionnaire

Every question that needs an answer before/while building. Organized by category; blockers marked ⛔ (can't start the workstream without it). Answers get recorded inline here as they come in.

## A. Company & brand identity

1. ⛔ You called this "a brand new company." Is the entity new, or is this Chase Contemporary continuing? What's the exact legal entity name (for terms, privacy, invoices, Shopify billing)?
2. ⛔ What happened with the reported Nov 2023 Castle Fine Art merger ("Castle Contemporary" at 413 W Broadway)? Is that dead, live, or does the new company replace it?
3. ⛔ Domain: are we building on chasecontemporary.com, or a new domain? Who controls DNS/registrar?
4. ⛔ Locations: the plan says New York · Palm Beach · Los Angeles; the current About page says "digital-first, no permanent space"; research found SoHo (413 W Broadway), East Hampton (66 Newtown Ln, 2021), Palm Beach (2024 IG announcement), LA ("900 N Broadway #1090", unverified). Which physical locations exist TODAY, with exact street addresses and hours? (Directly drives local SEO/GEO, LocalBusiness schema, contact pages, and the "3 locations" pipeline sources.)
5. Team roster: who works the sales floor? Names/emails/phones for each rep. Are Isabel Sullivan (director), Christopher Pusey (partner), Holland Chase still involved? Who is Rep A/B/C on the future leaderboard?
6. Bernie's public narrative: the Schachter interview is brutally candid (prison, recovery, Brunei). For GEO we want a Bernie bio page + press index that AI engines cite. How much of that story does the brand lean into vs. leave as external citations only?
7. Brand assets: is there a logo/brand guide/fonts/colors, or is visual identity part of this project? Who designs — Riley/MOA, or an outside designer? Is there a Figma?
8. Voice: who writes/approves site copy? Does Bernie want approval on brand voice?

## B. Access & tech stack (the logins)

9. ⛔ Shopify: store URL + collaborator/staff access. What plan tier is it on (Plus vs Basic/Grow matters for checkout customization, B2B features, Functions)? Which theme, and is it licensed? What apps are installed?
10. ⛔ Domain registrar/DNS login.
11. Email/workspace: is info@chasecontemporary.com on Google Workspace? Who owns it? Access to the shared inbox for "inbox archaeology" (the plan's cheapest win)?
12. Existing marketing tools: Klaviyo/Mailchimp/Shopify Email? List sizes and opt-in status?
13. Artsy: does the gallery still have an Artsy presence/subscription (plan lists Artsy as a pipeline source)? API/CSV access? Same for artnet, 1stDibs, Incollect, fair portals (Art Miami).
14. Payments: Shopify Payments active? Stripe account? Which bank for ACH/wire receipt? Any existing financing partner (Art Money, Affirm)?
15. Accounting: QuickBooks/Xero? Who does the books ("accounting sync" is in the plan's application layer)?
16. Comms for sales-floor alerts: Slack workspace (exists?) or SMS (Twilio, whose numbers)?
17. Analytics/search: GA4, Google Search Console, Meta pixel — do these exist? Access?
18. Socials: IG/X handles and who posts (for linking + press amplification, not automation).

## C. Data & migration (W3 backbone)

19. ⛔ Where does the business actually live today — spreadsheets, Artsy CMS, Artlogic, the Shopify admin, email? What's the canonical artwork inventory (count, images, provenance docs, condition reports)?
20. Collector list: how many contacts, where, and what's their email consent status?
21. Historical sales: what records exist (invoices, Shopify orders, Artsy sales, paper)? How far back do we import?
22. Consignments: are artist consignment terms written down anywhere? Split % per artist?
    **ANSWERED (Devyn, 2026-08-25): Bernie OWNS all the artwork outright — no artist consignments, no artist splits or statements. The commissions system is purely internal.**
23. Rep commissions: what are the actual splits (rep %, house %, location share, discount sharing) that W8 should encode?
    **PARTIALLY ANSWERED (Devyn, 2026-08-25): there is a pre-agreed commission structure; on settlement the database splits automatically and drives each person's share into their pool — zero manual calculation or reconciliation. Still need: the actual percentages and who's in the pool.**
24. Current roster: the site lists 14 artists; press history lists ~25. Who is actually represented today, and which are estate/secondary-market relationships?

## D. Architecture decisions

25. ⛔ The backbone database: plan says managed Postgres. Default recommendation: Supabase (same stack as MoaOS, fast to stand up, row-level security for role-based access). Confirm, or preference for something else? Who pays for the infra (new company's card vs MOA)?
26. ⛔ CRM: plan describes a thin custom interface over the gallery's own database. Confirm custom build (Next.js on Vercel, Clerk/Google auth — MoaOS pattern) vs. an off-the-shelf CRM adapted. Custom is what the PDF sells; saying so explicitly before we build it.
27. Source of truth: Postgres canonical with Shopify as the storefront/checkout surface (products, editions, payment links synced) — or Shopify-first with the DB layered on? (Recommend Postgres-canonical; Shopify holds only what's sellable.)
28. Lead enrichment (W2): which provider (Apollo, Clearbit, FullEnrich, manual research)? Monthly budget for it?
29. Lifecycle email (W7): Klaviyo (Shopify-native, human-approval via drafts) vs. custom sends via Resend from the CRM? Recommend Klaviyo for flows + CRM-drafted one-to-ones in Gmail.
30. Sales-floor ping (W1): Slack channel, SMS, or both? Response-time clock starts on which event?
31. The AI query layer ("collectors who bought street art under $50k near Palm Beach"): who gets to use it (Bernie only? reps?), and does it live in the CRM UI?
32. Role-based access: which roles on day 1 (owner, rep, director, artist-statements portal later)?
33. Dashboards ("What Bernie Sees"): in-CRM, or is a weekly email digest enough for phase 1?

## E. Payments & pricing policy (W4)

34. ⛔ Pricing visibility policy: which works show public prices (editions?) vs POA (originals?)? Today the site hides prices but has a cart — that hybrid needs a deliberate rule.
35. Card fees: priced-in or surcharged? (Plan says "fees priced in, never absorbed by accident.")
36. ACH: Shopify Payments ACH / Stripe ACH / bank-direct? Wire: which account's instructions get auto-generated?
37. The Hold: deposit amount (flat $ or % of price), 72-hour window confirmed? Refund policy text? Who can place/extend a hold?
38. Financing: which partner do we sign up (Art Money is art-native; Affirm caps low for $50k+ works)? Or phase-2?
39. Payment links: OK to use Shopify draft orders/checkout links as the mid-call close mechanism?
40. Sales tax: where does the company have nexus (NY, FL, CA)? Resale certificate handling? Who's the tax advisor?
41. International: sell/ship internationally at launch? Currencies? Who handles fine-art logistics today (Dietl, UOVO, other), and does "shipments · tracking" mean integrating their emails or manual entry?

## F. Site experience & GEO (W5, W6)

42. Design direction: rebuild on the current theme's bones or start clean? 2–3 gallery sites you/Bernie consider the bar (e.g., Gagosian, Perrotin, David Zwirner)?
43. ⛔ The old editorial site (about, ~50 exhibition archives, artist pages) is deleted and 404ing while still indexed. Do we restore the exhibition archive (via Wayback + your files) as SEO/GEO surface? Do you have the old site's export/backups?
44. Press page: green light to publish the compiled press index (Forbes, Artnet, Hyperallergic…) with links as GEO citation anchors?
45. Bernie bio page: yes/no, and does Bernie approve the draft personally?
46. Artist pages: who supplies bios, headshots, CVs, market/auction context per artist?
47. Current campaigns: the Pelé collection and "Summer Sale" are live — preserve, sunset, or rework during the refresh?
48. Editions strategy: the plan's upside lever ("editions self-serve") — is there real edition inventory to sell self-serve at launch?
49. Blog/editorial: who produces ongoing content (MOA? Bernie dictating stories?)? The Schachter-style stories are GEO gold — is Bernie willing to record more?
50. Photography: is existing artwork photography museum-grade, or do we need shoots?

## G. Rollout, ops, and commercials

51. ⛔ Is the 3-phase/16-week rollout agreed and when is day 1? Is the MOA engagement signed (scope/fee), or is this build pre-contract?
52. Week-one wins depend on a staffed floor: who actually answers inquiries today, and in what hours/time zones? Is a 5-minute SLA staffable?
53. Who is the named human approver for every outbound email (the plan's hard rule)?
54. Real baseline numbers: can we get actual inquiry volume/close rate/avg deal from the inbox + Shopify to replace the placeholder math (~120/mo, 3%, $18k)?
55. Fairs calendar for the next 6 months (drives launch timing and the "next fair's invite list" query).
56. Success definition at week 16: what makes Bernie say this worked?

## H. Legal & compliance

57. Privacy policy/terms: who's counsel? CCPA (CA) + FL + NY obligations for collector data; "collector data never leaves" needs a written policy.
58. Email list: was the existing list opt-in? CAN-SPAM physical address to use?
59. Artist agreements: do consignment contracts permit automated statements/data use, or do any need addenda?
60. Recorded calls for the "winning script" (plan says "where consent allows") — which states are involved (CA/FL = two-party consent) and is anyone actually recording?


---

## INTAKE ANSWERS — received from Kristine Hughes via Devyn, 2026-08-26

- **Entity (Q1):** **Zenzeba Group Inc** owns Chase Contemporary; receives wires/ACH at **JPMorgan Chase** (managed by Bernie Chase & Kristine Hughes).
- **Shopify (Q9):** **Grow plan**, account owner Bernie Chase. Collaborator invite sent to devyn@magnumopus.agency 8/25 9:32 PM (in inbox, pending Devyn's accept). NOTE: Shopify has NEVER processed a sale.
- **Domain (Q10):** GoDaddy; Kristine Hughes has the login.
- **Email (Q11):** Kristine manages Google Workspace; **Sara Skeat** uses/manages info@chasecontemporary.com. Delegate access for Devyn requested.
- **Marketing + CRM today (Q12/19/20):** **ARTCLOUD** is the system of record: inventory, collector/client list (~27,000 contacts), and email campaigns all live there. Sara maintains it (adds from website, Art Miami, her network). → PRIMARY MIGRATION SOURCE. Credentials received (stored locally, not in repo; rotate after access established).
- **Payments (Q14):** Stripe (used for Artsy sales), Shopify Payments configured but unused, **Square** handhelds at Art Miami + Square invoices drafted by Kristine when clients pay by card instead of wire.
- **Accounting (Q15):** QuickBooks Online under Zenzeba Group Inc; Kristine does the books.
- **Platforms (Q13):** Artsy, Artnet, MutualArt all active; Sara manages subscriptions/content.
- **Locations (Q4):** NO physical galleries. Inventory stored in Palm Beach, Miami, New York, Los Angeles, Solana Beach. No gallery phone line (only Bernie's and Sara's cells).
- **Team (Q5/52):** Sales team = **Sara Skeat** (603.309.0643, info@ primary, sara@chasecontemporary.com) + Bernie. Sara answers inquiries.
- **Artist agreements (Q22):** being researched; possibly in old Google Drive from the Isabel Sullivan / Marla era. (Moot for splits: Bernie owns inventory.)
- **Brand (Q7):** Logo PNGs received (repo `brand/logos/`): stacked 3-line, 2-line, 1-line lockups, geometric sans.
- **Old site (Q43):** **Old Squarespace account is STILL ACTIVE with all historical content/assets** — Bernie kept it. Archive restore from source, not Wayback.
- **Fairs (Q55):** none committed next 6 months.
- **Shipping (Q41):** YSDS Art, Hangman, SBA Global Logistics, FedEx.
- **Analytics (Q17):** unknown/likely none; Kristine never had access.
- **People directory:** Kristine Hughes (ops/books/domain/workspace), Sara Skeat (sales/content/info@), Bernie Chase (owner).
