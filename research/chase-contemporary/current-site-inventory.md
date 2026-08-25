# Current site inventory — chasecontemporary.com (as of 2026-08-25)

- **URL:** https://www.chasecontemporary.com/
- **Platform:** Shopify (confirmed — "Powered by Shopify" footer, cart/checkout present). The refresh is a Shopify rebuild, not a migration.

## Structure
- Nav: Home, Artists, Exhibitions, About, Press, Contact
- Featured "Summer Sale" collection
- Current exhibition: **Pelé** (dedicated collection page)

## Artists listed (15+)
Andres Valencia, Angel Ortiz (LA II/LA2), Kinki Texas, Liu Shuishi, Logan Sylve, Ole Aakjær, Pelé, Peter Tunney, Raphael Mazzucco, Retna, Richard Hambleton, Risk, Robert Cottingham, The Connor Brothers.

## Commerce behavior today
- High-res artwork images; **no visible pricing** while browsing
- Add-to-cart exists despite hidden prices
- Positioning copy: "Hand-Signed Originals ✦ Limited Edition Works ✦ Authenticated Art"; Certificate of Authenticity per piece
- Newsletter signup (multiple forms): "Be the first to hear about new works, artist features, exhibition openings, and exclusive collecting opportunities."
- Contact: info@chasecontemporary.com (the shared inbox the Revenue Engine plan calls out as where revenue dies)
- **No physical address on the homepage** — gap vs. plan's NY/Palm Beach/LA + local SEO/GEO needs

## Implications for the build
- W1: replace mailto/generic contact with embedded per-artwork inquiry forms carrying artwork context
- W4: price-hidden + cart is a broken hybrid today; needs deliberate rails (POA works → inquiry/hold; editions → self-serve checkout)
- W6: no address, likely thin structured data — full Schema.org (VisualArtwork, ArtGallery, Person) pass needed
- W7: newsletter capture exists but presumably not wired to any CRM/lifecycle flows
