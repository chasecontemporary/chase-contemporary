#!/usr/bin/env python3
"""Chase Contemporary — front-end prototype, generated from the live Shopify catalog.
Design register: Karma-gallery restraint. Nimbus Sans Novus, white, black, air.
Every template maps 1:1 to a future Shopify theme template."""
import json, os, re, html, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "..", "research", "chase-contemporary")
OUT = os.path.join(ROOT, "site")

ARTIST_EXCLUDE = {"summer-sale", "pele"}          # not artists
EXHIBITION = {"handle": "pele", "title": "Pelé", "sub": "The King of Football — A Collection"}

products = json.load(open(os.path.join(DATA, "shopify-products.json")))["products"]
collections = json.load(open(os.path.join(DATA, "shopify-collections.json")))["collections"]
by_id = {p["id"]: p for p in products}
col_products = {}
for c in collections:
    h = c["handle"]
    try:
        d = json.load(open(os.path.join(DATA, "shopify-collection-products", f"{h}.json")))
        col_products[h] = [by_id[p["id"]] for p in d["products"] if p["id"] in by_id]
    except FileNotFoundError:
        col_products[h] = []

artists = [c for c in collections if c["handle"] not in ARTIST_EXCLUDE]
artists.sort(key=lambda c: c["title"].split()[-1])

def strip_html(s):
    return re.sub(r"<[^>]+>", "\n", s or "")

def details(p):
    lines = [l.strip() for l in strip_html(p.get("body_html", "")).splitlines() if l.strip()]
    return lines[:3]

def is_edition(p):
    return p.get("product_type") == "Print"

def price_line(p):
    if is_edition(p):
        v = p["variants"][0] if p["variants"] else {}
        try:
            n = float(v.get("price", 0))
            return f"${n:,.0f}"
        except (TypeError, ValueError):
            return "Price on request"
    return "Price on request"

def img(p, width=1100):
    if p.get("images"):
        src = p["images"][0]["src"]
        sep = "&" if "?" in src else "?"
        return f"{src}{sep}width={width}"
    return ""

def esc(s):
    return html.escape(s or "", quote=True)

CSS = """
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-regular.ttf'); font-weight: 400; }
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-medium.ttf'); font-weight: 500; }
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-light.ttf'); font-weight: 300; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; }
body { font-family: 'NSN', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111;
       -webkit-font-smoothing: antialiased; text-transform: uppercase; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

.wrap { padding: 0 48px; max-width: 1280px; margin: 0 auto; }
@media (max-width: 720px) { .wrap { padding: 0 20px; } }

header { padding: 34px 0 30px; }
header .wrap { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 14px; }
.mark { font-size: 12px; font-weight: 500; letter-spacing: .32em; white-space: nowrap; }
nav { display: flex; gap: 26px; }
nav a { font-size: 9.5px; letter-spacing: .24em; color: #767470; }
nav a:hover, nav a.on { color: #111; }

main { min-height: 62vh; }
.section-label { font-size: 9.5px; letter-spacing: .28em; color: #767470; margin: 54px 0 26px; }

.hero { margin-top: 10px; }
.hero img { width: 100%; max-height: 74vh; object-fit: cover; object-position: center 30%; }
.hero-cap { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; flex-wrap: wrap; gap: 8px; }
.hero-cap .t { font-size: 11.5px; font-weight: 500; letter-spacing: .22em; }
.hero-cap .s { font-size: 9.5px; letter-spacing: .2em; color: #767470; }

.grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 44px; row-gap: 72px; }
@media (max-width: 720px) { .grid { grid-template-columns: 1fr; row-gap: 56px; } }
.grid-3 { grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 960px) { .grid-3 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) { .grid-3 { grid-template-columns: 1fr; } }

.card img { width: 100%; aspect-ratio: 4/3.4; object-fit: contain; object-position: left bottom; background: #fff; }
.card .cap { margin-top: 14px; }
.cap .artist { font-size: 10px; font-weight: 500; letter-spacing: .2em; }
.cap .title { font-size: 9.5px; letter-spacing: .16em; color: #767470; margin-top: 5px; }
.cap .price { font-size: 9.5px; letter-spacing: .16em; margin-top: 5px; }

.index-list { list-style: none; }
.index-list li { padding: 13px 0; }
.index-list a { font-size: 13px; letter-spacing: .26em; font-weight: 400; }
.index-list a:hover { color: #767470; }

.work { display: grid; grid-template-columns: minmax(0, 7fr) minmax(260px, 3fr); gap: 56px; margin-top: 12px; }
@media (max-width: 860px) { .work { grid-template-columns: 1fr; gap: 30px; } }
.work-img img { width: 100%; max-height: 78vh; object-fit: contain; object-position: left top; }
.work-info { padding-top: 4px; }
.work-info .artist { font-size: 11px; font-weight: 500; letter-spacing: .24em; }
.work-info .title { font-size: 10px; letter-spacing: .18em; color: #111; margin-top: 12px; }
.work-info .meta { font-size: 9px; letter-spacing: .16em; color: #767470; margin-top: 14px; line-height: 2; }
.work-info .price { font-size: 10px; letter-spacing: .18em; margin-top: 22px; }
.act { display: inline-block; margin-top: 26px; font-size: 9.5px; font-weight: 500; letter-spacing: .28em;
       border-bottom: 1px solid #111; padding-bottom: 4px; cursor: pointer; background: none; border-top: 0;
       border-left: 0; border-right: 0; text-transform: uppercase; font-family: inherit; color: #111; }
.act:hover { color: #767470; border-color: #767470; }
.assure { font-size: 8.5px; letter-spacing: .16em; color: #767470; margin-top: 26px; line-height: 2.1; }

.inq { display: none; margin-top: 30px; }
.inq.show { display: block; }
.inq label { display: block; font-size: 8.5px; letter-spacing: .2em; color: #767470; margin: 16px 0 6px; }
.inq input, .inq textarea { width: 100%; border: 0; border-bottom: 1px solid #111; font-family: inherit;
       font-size: 11px; letter-spacing: .1em; padding: 6px 0; outline: none; text-transform: none; }
.inq textarea { min-height: 60px; resize: vertical; }
.inq .note { font-size: 8.5px; color: #767470; letter-spacing: .14em; margin-top: 14px; line-height: 2; }

.prose { max-width: 560px; font-size: 10.5px; letter-spacing: .14em; line-height: 2.3; }
.prose p { margin-bottom: 22px; }

footer { margin-top: 110px; padding: 44px 0 60px; border-top: 1px solid #eceae6; }
footer .wrap { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 34px; }
footer .col { font-size: 8.5px; letter-spacing: .2em; color: #767470; line-height: 2.4; }
footer .col b { color: #111; font-weight: 500; }
.news input { border: 0; border-bottom: 1px solid #111; font-family: inherit; font-size: 10px;
       letter-spacing: .1em; padding: 6px 0; width: 210px; outline: none; text-transform: none; }
"""

JS = """
function inq(){ var f=document.getElementById('inq'); f.classList.add('show');
  document.getElementById('inqbtn').style.display='none'; }
function sendInq(e){ e.preventDefault();
  alert('PROTOTYPE — in production this submits to the gallery CRM with full artwork context attached.'); }
"""

def page(title, body, active="", depth=0):
    pre = "../" * depth
    nav_items = [("ARTISTS", "artists/index.html"), ("EXHIBITIONS", "exhibitions/index.html"),
                 ("ABOUT", "about.html"), ("CONTACT", "contact.html")]
    nav = "".join(
        f'<a href="{pre}{h}" class="{"on" if n == active else ""}">{n}</a>' for n, h in nav_items)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<link rel="stylesheet" href="/assets/chase.css"><script src="/assets/chase.js"></script></head>
<body>
<header><div class="wrap">
  <a class="mark" href="{pre}index.html">CHASE CONTEMPORARY</a>
  <nav>{nav}</nav>
</div></header>
<main>{body}</main>
<footer><div class="wrap">
  <div class="col"><b>NEW YORK</b><br>413 WEST BROADWAY<br>BY APPOINTMENT</div>
  <div class="col"><b>PALM BEACH</b><br>ADDRESS TK<br>BY APPOINTMENT</div>
  <div class="col"><b>LOS ANGELES</b><br>ADDRESS TK<br>BY APPOINTMENT</div>
  <div class="col news"><b>NEWSLETTER</b><br><br><input placeholder="Email address"></div>
</div></footer>
</body></html>"""

def card(p, depth=0):
    pre = "../" * depth
    return f"""<div class="card"><a href="{pre}works/{p['handle']}.html">
  <img src="{img(p, 900)}" alt="{esc(p['title'])}" loading="lazy">
  <div class="cap"><div class="artist">{esc(p['vendor'])}</div>
  <div class="title">{esc(p['title'])}</div>
  <div class="price">{price_line(p)}</div></div></a></div>"""

# ---------- build ----------
if os.path.exists(OUT):
    shutil.rmtree(OUT)
for d in ["", "artists", "works", "exhibitions", "assets"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
shutil.copytree(os.path.join(ROOT, "assets", "fonts"), os.path.join(OUT, "assets", "fonts"))
open(os.path.join(OUT, "assets", "chase.css"), "w").write(CSS)
open(os.path.join(OUT, "assets", "chase.js"), "w").write(JS)

# homepage: hero = current exhibition, featured works, artist index
pele = col_products.get("pele", [])
hero_p = next((p for p in pele if p.get("images")), products[0])
featured = [p for p in products if p.get("images") and not is_edition(p)][:6]
body = f"""
<div class="wrap">
  <div class="hero"><a href="exhibitions/index.html"><img src="{img(hero_p, 1600)}" alt="{esc(EXHIBITION['title'])}"></a>
    <div class="hero-cap"><span class="t">{esc(EXHIBITION['title'])} — {esc(EXHIBITION['sub'])}</span>
    <span class="s">CURRENT EXHIBITION</span></div></div>
  <div class="section-label">SELECTED WORKS</div>
  <div class="grid">{''.join(card(p) for p in featured)}</div>
  <div class="section-label">ARTISTS</div>
  <ul class="index-list">
    {''.join(f'<li><a href="artists/{c["handle"]}.html">{esc(c["title"])}</a></li>' for c in artists)}
  </ul>
</div>"""
open(os.path.join(OUT, "index.html"), "w").write(page("Chase Contemporary", body))

# artists index
body = f"""<div class="wrap"><div class="section-label">ARTISTS</div>
<ul class="index-list">
  {''.join(f'<li><a href="{c["handle"]}.html">{esc(c["title"])}</a></li>' for c in artists)}
</ul></div>"""
open(os.path.join(OUT, "artists", "index.html"), "w").write(page("Artists — Chase Contemporary", body, "ARTISTS", 1))

# artist pages
for c in artists:
    ps = [p for p in col_products.get(c["handle"], []) if p.get("images")]
    body = f"""<div class="wrap"><div class="section-label">ARTIST</div>
    <div style="font-size:15px;font-weight:500;letter-spacing:.3em;margin-bottom:56px;">{esc(c['title'])}</div>
    <div class="grid">{''.join(card(p, 1) for p in ps)}</div></div>"""
    open(os.path.join(OUT, "artists", f"{c['handle']}.html"), "w").write(
        page(f"{c['title']} — Chase Contemporary", body, "ARTISTS", 1))

# work pages
for p in products:
    det = details(p)
    ed = is_edition(p)
    act = ("ACQUIRE" if ed else "INQUIRE")
    body = f"""<div class="wrap"><div class="work">
  <div class="work-img"><img src="{img(p, 1600)}" alt="{esc(p['title'])}"></div>
  <div class="work-info">
    <div class="artist">{esc(p['vendor'])}</div>
    <div class="title">{esc(p['title'])}</div>
    <div class="meta">{'<br>'.join(esc(l) for l in det)}</div>
    <div class="price">{price_line(p)}</div>
    <button class="act" id="inqbtn" onclick="inq()">{act}</button>
    <form class="inq" id="inq" onsubmit="sendInq(event)">
      <label>NAME</label><input required>
      <label>EMAIL</label><input type="email" required>
      <label>MESSAGE</label><textarea>I am interested in {esc(p['title'])} by {esc(p['vendor'])}.</textarea>
      <button class="act" type="submit">SEND</button>
      <div class="note">A MEMBER OF THE GALLERY WILL RESPOND WITHIN MINUTES DURING GALLERY HOURS.</div>
    </form>
    <div class="assure">HAND-SIGNED ORIGINALS · CERTIFICATE OF AUTHENTICITY<br>WORLDWIDE FINE-ART SHIPPING · CARD, ACH, WIRE, FINANCING</div>
  </div></div></div>"""
    open(os.path.join(OUT, "works", f"{p['handle']}.html"), "w").write(
        page(f"{p['title']} — {p['vendor']}", body, "", 1))

# exhibitions
grid = ''.join(card(p, 1) for p in pele if p.get("images"))
body = f"""<div class="wrap"><div class="section-label">CURRENT EXHIBITION</div>
<div style="font-size:15px;font-weight:500;letter-spacing:.3em;">{esc(EXHIBITION['title'])}</div>
<div style="font-size:9.5px;letter-spacing:.2em;color:#767470;margin:10px 0 56px;">{esc(EXHIBITION['sub'])}</div>
<div class="grid">{grid}</div>
<div class="section-label">ARCHIVE</div>
<div class="prose"><p>FIFTY EXHIBITIONS, 2017 TO TODAY — HAMBLETON, VALENCIA, TAUPIN, SCHARF, FEUERMAN — RETURN TO THIS PAGE AS THE ARCHIVE IS RESTORED.</p></div></div>"""
open(os.path.join(OUT, "exhibitions", "index.html"), "w").write(page("Exhibitions — Chase Contemporary", body, "EXHIBITIONS", 1))

# about
body = """<div class="wrap"><div class="section-label">ABOUT</div>
<div class="prose">
<p>CHASE CONTEMPORARY WAS FOUNDED IN NEW YORK IN 2017 BY BERNIE CHASE. FROM ITS CHELSEA BEGINNINGS TO A TEN-THOUSAND-SQUARE-FOOT FLAGSHIP ON WEST BROADWAY, THE GALLERY HAS STAGED MORE THAN FIFTY SOLO EXHIBITIONS.</p>
<p>THE PROGRAM CENTERS ON CONTEMPORARY AND STREET ART — RICHARD HAMBLETON, RETNA, KENNY SCHARF — ALONGSIDE THE ARTISTS THE GALLERY HAS DISCOVERED AND CHAMPIONED, INCLUDING ANDRES VALENCIA.</p>
<p>[BIO COPY PENDING BERNIE'S APPROVAL — DRAFTED FROM THE PRESS ARCHIVE.]</p>
</div></div>"""
open(os.path.join(OUT, "about.html"), "w").write(page("About — Chase Contemporary", body, "ABOUT"))

# contact
body = """<div class="wrap"><div class="section-label">CONTACT</div>
<div class="prose">
<p>INFO@CHASECONTEMPORARY.COM</p>
<p>NEW YORK · PALM BEACH · LOS ANGELES</p>
<p>FOR ACQUISITIONS, PRIVATE VIEWINGS, AND CONSIGNMENT INQUIRIES, A MEMBER OF THE GALLERY RESPONDS WITHIN MINUTES DURING GALLERY HOURS.</p>
</div></div>"""
open(os.path.join(OUT, "contact.html"), "w").write(page("Contact — Chase Contemporary", body, "CONTACT"))

n = len(products) + len(artists) + 5
print(f"built {n} pages -> {OUT}")
