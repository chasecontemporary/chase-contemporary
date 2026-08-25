#!/usr/bin/env python3
"""Chase Contemporary — front-end prototype v2 (senior polish pass).
Generated from the live Shopify catalog. Karma-register: white, black, Nimbus, air.
Every template maps 1:1 to a future Shopify theme template."""
import json, os, re, html, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "..", "research", "chase-contemporary")
OUT = os.path.join(ROOT, "site")

ARTIST_EXCLUDE = {"summer-sale", "pele"}
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

artists = sorted((c for c in collections if c["handle"] not in ARTIST_EXCLUDE),
                 key=lambda c: c["title"].split()[-1])

# product -> artist collection (for breadcrumb / prev-next / related)
artist_of = {}
for c in artists:
    for p in col_products.get(c["handle"], []):
        artist_of.setdefault(p["id"], c)

def esc(s): return html.escape(s or "", quote=True)

def artist_href(p, depth):
    c = artist_of.get(p["id"])
    return (("../" * depth) + f"artists/{c['handle']}.html") if c else None

def col_preview(c, w=640):
    for p in col_products.get(c["handle"], []):
        if p.get("images"):
            src = p["images"][0]["src"]; sep = "&" if "?" in src else "?"
            return f"{src}{sep}width={w}"
    return ""
def strip_html(s): return re.sub(r"<[^>]+>", "\n", s or "")
def details(p):
    return [l.strip() for l in strip_html(p.get("body_html", "")).splitlines() if l.strip()][:3]
def is_edition(p): return p.get("product_type") == "Print"

DIM_PAT = re.compile(r'(\d+(?:\.\d+)?)\s*(?:h\b|"|\u201d|in\b|inches)?\s*[x\u00d7]\s*(\d+(?:\.\d+)?)\s*(?:w\b|"|\u201d)?\s*(in\b|inches|cm)?', re.I)
def phys(p):
    """(height_in, width_in) parsed from body_html; art convention is H x W."""
    body = strip_html(p.get("body_html", ""))
    m = DIM_PAT.search(body)
    if not m: return None
    h, w = float(m.group(1)), float(m.group(2))
    if (m.group(3) or "").lower() == "cm": h, w = h / 2.54, w / 2.54
    if h < 4 or w < 4 or h > 300 or w > 300: return None
    return (h, w)

def scale_pct(p, max_w):
    """Rendered width as % of the grid cell, proportional to true physical width."""
    d = phys(p)
    if not d or not max_w: return 86
    return max(38, min(100, round(d[1] / max_w * 100)))

def max_phys_w(ps):
    ws = [phys(p)[1] for p in ps if phys(p)]
    return max(ws) if ws else None
def price_line(p):
    if is_edition(p):
        v = p["variants"][0] if p["variants"] else {}
        try:
            n = float(v.get("price", 0))
            if n > 0: return f"${n:,.0f}"
        except (TypeError, ValueError): pass
    return "Price on request"
def imgsrc(p, w):
    if not p.get("images"): return ""
    src = p["images"][0]["src"]; sep = "&" if "?" in src else "?"
    return f"{src}{sep}width={w}"
def pic(p, w, cls="", sizes="(max-width: 720px) 92vw, 46vw", style=""):
    if not p.get("images"): return ""
    im = p["images"][0]
    wh = f'width="{im["width"]}" height="{im["height"]}" ' if im.get("width") and im.get("height") else ""
    st = f'style="{style}" ' if style else ""
    return (f'<img class="{cls}" {st}src="{imgsrc(p, w)}" '
            f'srcset="{imgsrc(p, w)} 1x, {imgsrc(p, w * 2)} 2x" sizes="{sizes}" {wh}'
            f'alt="{esc(p["title"])}, {esc(p["vendor"])}" loading="lazy" decoding="async" '
            f'onload="this.classList.add(\'ld\')">')

CSS = """
:root { --ink: #111; --mute: #79766f; --hair: #eceae6; --pad: 72px; --colgap: 44px; --rowgap: 88px; --sp: 96px; }
@media (max-width: 1080px) { :root { --pad: 44px; } }
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-regular.ttf'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-medium.ttf'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'NSN'; src: url('/assets/fonts/nimbus-sans-novus-light.ttf'); font-weight: 300; font-display: swap; }

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'NSN', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: var(--ink);
       -webkit-font-smoothing: antialiased; text-transform: uppercase;
       animation: pagein .45s ease both; }
@keyframes pagein { from { opacity: 0; } to { opacity: 1; } }
body.leaving { opacity: 0; transition: opacity .18s ease; animation: none; }
::selection { background: var(--ink); color: #fff; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
img.fx { opacity: 0; transition: opacity .7s ease; } img.fx.ld { opacity: 1; }
:focus-visible { outline: 1px solid var(--ink); outline-offset: 4px; }

.wrap { padding: 0 var(--pad); max-width: 1360px; margin: 0 auto; }
@media (max-width: 720px) { :root { --pad: 20px; } }

/* ---------- header ---------- */
html, body { overflow-x: hidden; }
header { background: none; padding: 46px 20px 6px; text-align: center; }
.mark { display: inline-block; font-size: 13px; font-weight: 500; letter-spacing: .4em; white-space: nowrap; }
nav { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; margin-top: 16px; }
nav .sep { font-size: 8.5px; color: var(--mute); letter-spacing: .26em; white-space: pre; }
main { padding-top: 0; }
nav { display: flex; gap: 28px; }
nav a { font-size: 8.5px; letter-spacing: .26em; color: var(--mute); transition: color .18s ease; }
nav a::after { content: ''; display: block; height: 1px; margin-top: 4px; background: currentColor;
               transform: scaleX(0); transform-origin: left; transition: transform .28s cubic-bezier(.2,.6,.2,1); }
nav a:hover { color: var(--ink); }
nav a:hover::after, nav a.on::after { transform: scaleX(1); }
nav a.on { color: var(--ink); }
@media (max-width: 720px) { nav a { font-size: 8px; letter-spacing: .18em; } }

main { min-height: 62vh; }

/* ---------- shared ---------- */
.section-label { font-size: 9px; letter-spacing: .3em; color: var(--mute); margin: var(--sp) 0 36px; }
.page-title { font-size: 28px; font-weight: 300; letter-spacing: .3em; margin-top: 64px; }
.page-sub { font-size: 9px; letter-spacing: .24em; color: var(--mute); margin: 14px 0 0; }

.r { opacity: 0; transform: translateY(12px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.6,.2,1); }
.r.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .r { opacity: 1; transform: none; transition: none; }
  img.fx { opacity: 1; transition: none; }
  body { animation: none; }
}

/* ---------- statement ---------- */
.statement { font-size: 16px; font-weight: 300; letter-spacing: .22em; line-height: 2.3;
             max-width: 760px; margin: var(--sp) 0 10px; }

/* ---------- editorial feature layout ---------- */
.feat { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: var(--colgap);
        row-gap: var(--rowgap); align-items: end; }
.f-a { grid-column: 1 / span 7; }
.f-b { grid-column: 9 / span 4; padding-bottom: 44px; }
.f-c { grid-column: 3 / span 8; }
.f-d { grid-column: 1 / span 4; padding-bottom: 36px; }
.f-e { grid-column: 6 / span 7; }
.f-f { grid-column: 4 / span 6; }
.feat .card img { max-height: 64vh; }
@media (max-width: 720px) {
  .feat { row-gap: 56px; }
  .f-a, .f-b, .f-c, .f-d, .f-e, .f-f { grid-column: 1 / span 12; padding-bottom: 0; }
}
.card .num { font-size: 7.5px; letter-spacing: .3em; color: var(--mute); margin-bottom: 12px; }

/* ---------- hero ---------- */
.hero { display: block; overflow: hidden; margin-top: 34px; }
.hero img { width: 100vw; height: 86vh; object-fit: cover; object-position: center 28%;
            transform: scale(1.06); will-change: transform; }
@media (max-width: 720px) { .hero img { height: 60vh; } }
.hero-cap { display: flex; justify-content: space-between; align-items: baseline;
            margin-top: 18px; flex-wrap: wrap; gap: 8px; }
.hero-cap .t { font-size: 11px; font-weight: 500; letter-spacing: .24em; }
.hero-cap .s { font-size: 8.5px; letter-spacing: .24em; color: var(--mute); }
.hero a:hover img { opacity: .96; } .hero img { transition: opacity .3s ease; }

/* ---------- works grid: natural proportions, baseline-aligned ---------- */
.grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: var(--colgap); row-gap: var(--rowgap); }
@media (max-width: 720px) { .grid { grid-template-columns: 1fr; row-gap: 56px; } }
.card { display: flex; flex-direction: column; }
.card .cim { display: flex; flex-direction: column; flex: 1; }
.card .im { display: flex; align-items: flex-end; flex: 1; min-height: 34vh; }
@media (max-width: 720px) { .card .im { flex: none; min-height: 0; } }
.card img { width: 100%; height: auto; max-height: 62vh; object-fit: contain; object-position: left bottom;
            transition: opacity .7s ease; }
.card .cim img { transition: opacity .7s ease, transform .45s cubic-bezier(.2,.6,.2,1); }
.card .cim:hover img.ld { opacity: .95; transform: translateY(-5px); }
@media (prefers-reduced-motion: reduce) { .card .cim:hover img.ld { transform: none; } }
.card .cap { margin-top: 16px; }
.cap .artist { display: inline-block; font-size: 9.5px; font-weight: 500; letter-spacing: .22em; }
a.artist::after { content: ''; display: block; height: 1px; margin-top: 3px; background: currentColor;
                  transform: scaleX(0); transform-origin: left; transition: transform .28s cubic-bezier(.2,.6,.2,1); }
a.artist:hover::after { transform: scaleX(1); }
.card:has(.cim:hover) a.artist::after, .card:has(.wl:hover) a.artist::after { transform: scaleX(1); }
.cap .wl { display: block; }
.cap .title { font-size: 8.5px; letter-spacing: .18em; color: var(--mute); margin-top: 6px; line-height: 1.9; }
.cap .price { font-size: 8.5px; letter-spacing: .16em; color: var(--ink); margin-top: 6px; }


/* ---------- artist index ---------- */
.index-list { list-style: none; margin-bottom: 40px; }
.index-list li { border-bottom: 1px solid var(--hair); }
.index-list li:first-child { border-top: 1px solid var(--hair); }
.index-list a { display: flex; justify-content: space-between; align-items: baseline;
                padding: 20px 0; transition: padding .25s ease; }
.index-list a:hover { padding-left: 10px; }
.index-list .n { font-size: 13px; letter-spacing: .28em; font-weight: 400; }
.index-list .c { font-size: 8px; letter-spacing: .22em; color: var(--mute); }

/* ---------- artist hover preview ---------- */
#apv { position: fixed; z-index: 60; width: 320px; pointer-events: none; opacity: 0;
       transform: translateY(6px); transition: opacity .28s ease, transform .28s ease; }
#apv.show { opacity: 1; transform: none; }
#apv img { width: 100%; height: auto; box-shadow: 0 6px 40px rgba(17,17,17,.14); }
@media (hover: none), (max-width: 880px) { #apv { display: none; } }

/* ---------- work page ---------- */
.crumb { font-size: 8.5px; letter-spacing: .24em; color: var(--mute); margin: 32px 0 36px; display: inline-block; }
.crumb:hover { color: var(--ink); }
.work { display: grid; grid-template-columns: minmax(0, 13fr) minmax(300px, 7fr); gap: 72px; align-items: start; }
@media (max-width: 880px) { .work { grid-template-columns: 1fr; gap: 34px; } }
.work-img img { width: 100%; max-height: 84vh; object-fit: contain; object-position: left top; cursor: zoom-in; }
.work-info { position: sticky; top: 110px; padding-top: 2px; }
@media (max-width: 880px) { .work-info { position: static; } }
.work-info .artist { font-size: 12px; font-weight: 500; letter-spacing: .26em; }
.work-info .artist a:hover { color: var(--mute); }
.work-info .title { font-size: 10px; letter-spacing: .2em; margin-top: 14px; line-height: 1.9; }
.work-info .meta { font-size: 8.5px; letter-spacing: .18em; color: var(--mute); margin-top: 18px; line-height: 2.2; }
.work-info .price { font-size: 10px; letter-spacing: .2em; margin-top: 26px; }
.work-info .status { font-size: 7.5px; letter-spacing: .26em; color: var(--mute); margin-top: 12px; }
.btn-inq { display: block; width: 100%; background: var(--ink); color: #fff; border: 1px solid var(--ink);
  text-align: center; font-size: 9.5px; font-weight: 500; letter-spacing: .32em; padding: 17px 0 16px;
  margin-top: 32px; font-family: inherit; text-transform: uppercase; cursor: pointer;
  transition: background .25s ease, color .25s ease; }
.btn-inq:hover { background: #fff; color: var(--ink); }
.alt-acts { margin-top: 18px; display: flex; flex-direction: column; gap: 11px; }
.alt-acts button { border: 0; background: none; font-family: inherit; text-transform: uppercase;
  text-align: left; padding: 0; font-size: 8px; letter-spacing: .24em; color: var(--mute); cursor: pointer;
  transition: color .18s ease; }
.alt-acts button:hover { color: var(--ink); }
.alt-acts button::before { content: '\2192\00a0\00a0'; color: var(--mute); }
.cap { position: relative; }
.cap .cta { position: absolute; right: 0; bottom: 1px; font-size: 8px; font-weight: 500;
  letter-spacing: .26em; opacity: 0; transform: translateY(3px); transition: opacity .3s ease, transform .3s ease; }
.card:hover .cta { opacity: 1; transform: none; }
@media (hover: none) { .cap .cta { display: none; } }
.act { display: inline-block; margin-top: 30px; font-size: 9px; font-weight: 500; letter-spacing: .3em;
       border: 0; border-bottom: 1px solid var(--ink); padding: 0 0 5px; cursor: pointer;
       background: none; font-family: inherit; color: var(--ink); text-transform: uppercase;
       transition: color .18s ease, border-color .18s ease; }
.act:hover { color: var(--mute); border-color: var(--mute); }
.assure { font-size: 7.5px; letter-spacing: .2em; color: var(--mute); margin-top: 34px; line-height: 2.4; }
.wnav { display: flex; justify-content: space-between; margin-top: 44px; padding-top: 18px;
        border-top: 1px solid var(--hair); }
.wnav a { font-size: 8px; letter-spacing: .26em; color: var(--mute); }
.wnav a:hover { color: var(--ink); }

/* inquiry */
.inq { max-height: 0; overflow: hidden; opacity: 0;
       transition: max-height .6s cubic-bezier(.2,.6,.2,1), opacity .4s ease .1s; }
.inq.show { max-height: 1200px; opacity: 1; margin-top: 34px; }
.inq .fhead { font-size: 8.5px; font-weight: 500; letter-spacing: .28em; margin-top: 26px;
              padding-top: 22px; border-top: 1px solid var(--hair); }
.inq .row2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 26px; }
@media (max-width: 1080px) { .inq .row2 { grid-template-columns: 1fr; } }
.inq select { width: 100%; border: 0; border-bottom: 1px solid var(--ink); font-family: inherit;
       font-size: 10px; letter-spacing: .1em; padding: 7px 0; outline: none; background: transparent;
       border-radius: 0; text-transform: uppercase; color: var(--ink); appearance: none;
       -webkit-appearance: none; cursor: pointer; }
.inq .ck { display: flex; gap: 12px; align-items: baseline; margin-top: 16px; cursor: pointer; }
.inq .ck input { width: 11px; height: 11px; accent-color: var(--ink); flex: none; transform: translateY(1px); }
.inq .ck span { font-size: 8px; letter-spacing: .2em; color: var(--mute); line-height: 2; }
.inq .ck:hover span { color: var(--ink); }
.inq label { display: block; font-size: 7.5px; letter-spacing: .24em; color: var(--mute); margin: 18px 0 7px; }
.inq input, .inq textarea { width: 100%; border: 0; border-bottom: 1px solid var(--ink);
       font-family: inherit; font-size: 12px; letter-spacing: .06em; padding: 7px 0; outline: none;
       text-transform: none; border-radius: 0; background: transparent; }
.inq input:focus, .inq textarea:focus { border-bottom-width: 2px; }
.inq textarea { min-height: 64px; resize: vertical; }
.inq .note { font-size: 7.5px; color: var(--mute); letter-spacing: .18em; margin-top: 16px; line-height: 2.2; }
.inq-done { display: none; margin-top: 30px; font-size: 9px; letter-spacing: .22em; line-height: 2.2; }
.inq-done.show { display: block; }

/* related */
.rel { margin-top: var(--sp); }
.rel .grid { grid-template-columns: 1fr 1fr 1fr; column-gap: 40px; row-gap: 60px; }
@media (max-width: 720px) { .rel .grid { grid-template-columns: 1fr; } }
.rel .card .im { min-height: 0; }
.rel .card img { max-height: 34vh; }

/* ---------- mobile inquire bar ---------- */
.mbar { display: none; }
@media (max-width: 880px) {
  .mbar { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
    background: rgba(255,255,255,.96); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    border-top: 1px solid var(--hair); padding: 16px 20px; justify-content: space-between; align-items: center; }
  .mbar .p { font-size: 9px; letter-spacing: .18em; }
  .mbar .act { margin-top: 0; }
  body.workpage { padding-bottom: 64px; }
}

.price, .cap .price, .index-list .c, .num { font-variant-numeric: tabular-nums; }

/* ---------- lightbox ---------- */
.lb { position: fixed; inset: 0; background: rgba(255,255,255,.97); z-index: 90; display: none;
      align-items: center; justify-content: center; padding: 5vh 5vw; cursor: zoom-in; overflow: hidden; }
.lb.show { display: flex; animation: pagein .25s ease both; }
.lb img { max-width: 100%; max-height: 100%; object-fit: contain;
          transition: transform .35s cubic-bezier(.2,.6,.2,1); transform-origin: center; }
.lb.zoomed { cursor: zoom-out; }
.lb.zoomed img { transform: scale(2.4); }
.lb .x { position: absolute; top: 22px; right: 26px; font-size: 9px; letter-spacing: .26em;
         color: var(--mute); cursor: pointer; z-index: 2; }
.lb .x:hover { color: var(--ink); }

/* ---------- prose / footer ---------- */
.prose { max-width: 620px; font-size: 10px; letter-spacing: .16em; line-height: 2.5; }
.prose p { margin-bottom: 26px; }
footer { margin-top: calc(var(--sp) + 24px); border-top: 1px solid var(--hair); }
footer .wrap { display: grid; grid-template-columns: repeat(5, 1fr); gap: 34px;
               padding-top: 52px; padding-bottom: 72px; }
@media (max-width: 880px) { footer .wrap { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { footer .wrap { grid-template-columns: 1fr; } }
footer .col { font-size: 7.5px; letter-spacing: .22em; color: var(--mute); line-height: 2.6; }
footer .col b { color: var(--ink); font-weight: 500; }
.news form { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--ink);
             max-width: 230px; margin-top: 10px; }
.news input { border: 0; font-family: inherit; font-size: 10px; letter-spacing: .06em;
              padding: 7px 0; width: 100%; outline: none; text-transform: none; background: transparent; }
.news button { border: 0; background: none; font-family: inherit; font-size: 11px; cursor: pointer;
               color: var(--ink); padding: 0 0 4px; }
"""

JS = """
document.addEventListener('DOMContentLoaded', function () {
  try {
    var j = JSON.parse(sessionStorage.getItem('cc_journey') || '[]');
    j.push(location.pathname); if (j.length > 40) j = j.slice(-40);
    sessionStorage.setItem('cc_journey', JSON.stringify(j));
    if (!sessionStorage.getItem('cc_t0')) sessionStorage.setItem('cc_t0', Date.now());
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    set('cc-journey', j.join(' > '));
    set('cc-ref', document.referrer || 'direct');
    set('cc-utm', location.search || '');
    var t = Date.now();
    setInterval(function () { set('cc-secs', Math.round((Date.now() - t) / 1000)); }, 2000);
  } catch (e) {}

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.r').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.r').forEach(function (el) { el.classList.add('in'); });
  }

  document.querySelectorAll('img.fx').forEach(function (im) { if (im.complete && im.naturalWidth) im.classList.add('ld'); });

  if (location.hash === '#inquire' && document.getElementById('inq')) {
    inq(document.getElementById('inqbtn'));
    setTimeout(function(){ document.getElementById('inq').scrollIntoView({behavior:'smooth', block:'center'}); }, 250);
  }

  var links = document.querySelectorAll('a[data-img]');
  if (links.length && window.matchMedia('(hover: hover)').matches) {
    var pv = document.createElement('div'); pv.id = 'apv';
    var pim = document.createElement('img'); pv.appendChild(pim); document.body.appendChild(pv);
    var px = 0, py = 0, raf = null;
    var place = function () {
      raf = null;
      var w = pv.offsetWidth || 320, h = pv.offsetHeight || 240;
      var x = Math.min(px + 36, window.innerWidth - w - 24);
      var y = Math.min(Math.max(py - h / 2, 24), window.innerHeight - h - 24);
      pv.style.left = x + 'px'; pv.style.top = y + 'px';
    };
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () {
        var src = a.getAttribute('data-img'); if (!src) return;
        pim.src = src; pv.classList.add('show');
      });
      a.addEventListener('mouseleave', function () { pv.classList.remove('show'); });
      a.addEventListener('mousemove', function (e) {
        px = e.clientX; py = e.clientY;
        if (!raf) raf = requestAnimationFrame(place);
      });
    });
  }

  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!rm) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href');
      if (!href || href.indexOf('#') === 0 || /^(https?:|mailto:|tel:)/.test(href)) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(function () { location.href = href; }, 170);
    });
    var hero = document.querySelector('.hero img');
    if (hero) {
      var hraf = null;
      window.addEventListener('scroll', function () {
        if (hraf) return;
        hraf = requestAnimationFrame(function () {
          hraf = null;
          hero.style.transform = 'scale(1.06) translateY(' + (window.scrollY * 0.08) + 'px)';
        });
      }, { passive: true });
    }
  }

  var wi = document.querySelector('.work-img img'), lb = document.getElementById('lb');
  if (wi && lb) {
    wi.addEventListener('click', function(){ lb.classList.add('show'); document.body.style.overflow='hidden'; });
    var close = function(){ lb.classList.remove('show'); lb.classList.remove('zoomed'); document.body.style.overflow=''; };
    var x = document.createElement('div'); x.className='x'; x.textContent='CLOSE'; lb.appendChild(x);
    x.addEventListener('click', function(e){ e.stopPropagation(); close(); });
    lb.addEventListener('click', function(e){
      var im = lb.querySelector('img');
      if (!im || e.target !== im) { close(); return; }
      if (!lb.classList.contains('zoomed')) {
        var r = im.getBoundingClientRect();
        im.style.transformOrigin = ((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%';
        lb.classList.add('zoomed');
      } else { lb.classList.remove('zoomed'); }
    });
    lb.addEventListener('mousemove', function(e){
      if (!lb.classList.contains('zoomed')) return;
      var im = lb.querySelector('img'); if (!im) return;
      im.style.transformOrigin = (e.clientX/lb.clientWidth*100)+'% '+(e.clientY/lb.clientHeight*100)+'%';
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
  }
});
function inqPre(kind){
  var t = document.getElementById('f-m');
  var title = (document.querySelector('input[name=artwork_title]')||{}).value || 'this work';
  var artist = (document.querySelector('input[name=artist]')||{}).value || '';
  var by = artist ? ' by ' + artist : '';
  if (t) {
    if (kind === 'hold') t.value = 'I would like to place a 72-hour hold on ' + title + by + '. Please send the deposit link.';
    if (kind === 'viewing') t.value = 'I would like to schedule a private viewing of ' + title + by + '.';
    if (kind === 'images') t.value = 'Please send additional images and a condition report for ' + title + by + '.';
  }
  inq(document.getElementById('inqbtn'));
}
function inq(btn){ document.getElementById('inq').classList.add('show'); if(btn) btn.style.display='none';
  var alts = document.getElementById('altacts'); if (alts) alts.style.display='none';
  setTimeout(function(){ var f=document.querySelector('#inq input'); if(f) f.focus(); }, 350); }
function sendInq(e){ e.preventDefault();
  document.getElementById('inq').classList.remove('show');
  document.getElementById('inq-done').classList.add('show'); }
function newsl(e){ e.preventDefault(); e.target.innerHTML =
  '<span style="font-size:8px;letter-spacing:.22em;">THANK YOU</span>'; }
"""

FAVICON = ("data:image/svg+xml," + html.escape(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
    "<rect width='32' height='32' fill='white'/>"
    "<text x='16' y='21' font-family='Helvetica' font-size='13' letter-spacing='1' "
    "text-anchor='middle' fill='#111'>CC</text></svg>", quote=True))

def page(title, body, active="", depth=0):
    pre = "../" * depth
    items = [("ARTISTS", "artists/index.html"), ("EXHIBITIONS", "exhibitions/index.html"),
             ("ABOUT", "about.html"), ("CONTACT", "contact.html")]
    nav = '<span class="sep">,&#x2002;</span>'.join(
        f'<a href="{pre}{h}" class="{"on" if n == active else ""}">{n}</a>' for n, h in items)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<link rel="preconnect" href="https://cdn.shopify.com">\n<link rel="icon" href="{FAVICON}">
<link rel="stylesheet" href="/assets/chase.css?v={V}"><script src="/assets/chase.js?v={V}" defer></script></head>
<body>
<header>
  <a class="mark" href="{pre}index.html">CHASE CONTEMPORARY</a>
  <nav>{nav}</nav>
</header>
<main>{body}</main>
<footer><div class="wrap">
  <div class="col"><b>NEW YORK</b><br>413 WEST BROADWAY<br>BY APPOINTMENT</div>
  <div class="col"><b>PALM BEACH</b><br>ADDRESS TK<br>BY APPOINTMENT</div>
  <div class="col"><b>LOS ANGELES</b><br>ADDRESS TK<br>BY APPOINTMENT</div>
  <div class="col"><b>FOLLOW</b><br><a href="https://www.instagram.com/chasecontemporary/">INSTAGRAM</a><br>INFO@CHASECONTEMPORARY.COM</div>
  <div class="col news"><b>NEWSLETTER</b>
    <form onsubmit="newsl(event)"><input placeholder="Email address" aria-label="Email address" required type="email"><button aria-label="Subscribe">&rarr;</button></form>
  </div>
</div></footer>
<div class="lb" id="lb"></div>
</body></html>"""

def card(p, depth=0, cls="", num=None, max_w=None):
    pre = "../" * depth
    n = f'<div class="num">{num:02d}</div>' if num else ""
    d = phys(p)
    dims = f' — {d[0]:g} × {d[1]:g} IN' if d and max_w else ""
    ah = artist_href(p, depth)
    artist = (f'<a class="artist" href="{ah}">{esc(p["vendor"])}</a>' if ah
              else f'<span class="artist">{esc(p["vendor"])}</span>')
    return f"""<div class="card r {cls}"><a class="cim" href="{pre}works/{p['handle']}.html">
  <div class="im">{pic(p, 900, "fx")}</div>{n}</a>
  <div class="cap">{artist}
  <a class="wl" href="{pre}works/{p['handle']}.html"><div class="title">{esc(p['title'])}{dims}</div>
  <div class="price">{price_line(p)}</div></a>
  <a class="cta" href="{pre}works/{p['handle']}.html#inquire">{"ACQUIRE" if is_edition(p) else "INQUIRE"}</a></div></div>"""

# ---------- build ----------
os.makedirs(OUT, exist_ok=True)
for child in os.listdir(OUT):                       # keep OUT inode (server cwd)
    q = os.path.join(OUT, child)
    shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
for d in ["artists", "works", "exhibitions", "assets"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
shutil.copytree(os.path.join(ROOT, "assets", "fonts"), os.path.join(OUT, "assets", "fonts"))
open(os.path.join(OUT, "assets", "chase.css"), "w").write(CSS)
open(os.path.join(OUT, "assets", "chase.js"), "w").write(JS)
import hashlib
V = hashlib.md5((CSS + JS).encode()).hexdigest()[:10]

pele = col_products.get("pele", [])
hero_p = next((p for p in pele if p.get("images")), products[0])
featured = [p for p in products if p.get("images") and not is_edition(p)][:6]

body = f"""
<a class="hero" href="exhibitions/index.html">{pic(hero_p, 2000, "fx", "100vw")}</a>
<div class="wrap">
  <div class="hero-cap"><span class="t">{esc(EXHIBITION['title'])} — {esc(EXHIBITION['sub'])}</span>
    <span class="s">CURRENT EXHIBITION</span></div>
  <div class="statement r">CONTEMPORARY AND STREET ART — HAMBLETON, RETNA, SCHARF, VALENCIA — IN NEW YORK, PALM BEACH, AND LOS ANGELES.</div>
  <div class="section-label r">SELECTED WORKS</div>
  <div class="feat">{''.join(card(p, 0, cls) for p, cls in zip(featured, ["f-a","f-b","f-c","f-d","f-e","f-f"]))}</div>
  <div class="section-label r">ARTISTS</div>
  <ul class="index-list r">
    {''.join(f'<li><a href="artists/{c["handle"]}.html" data-img="{col_preview(c)}"><span class="n">{esc(c["title"])}</span><span class="c">{len(col_products.get(c["handle"], []))} WORKS</span></a></li>' for c in artists)}
  </ul>
</div>"""
open(os.path.join(OUT, "index.html"), "w").write(page("Chase Contemporary", body))

body = f"""<div class="wrap"><div class="page-title r in">ARTISTS</div>
<div class="section-label r"></div>
<ul class="index-list r in">
  {''.join(f'<li><a href="{c["handle"]}.html" data-img="{col_preview(c)}"><span class="n">{esc(c["title"])}</span><span class="c">{len(col_products.get(c["handle"], []))} WORKS</span></a></li>' for c in artists)}
</ul></div>"""
open(os.path.join(OUT, "artists", "index.html"), "w").write(page("Artists — Chase Contemporary", body, "ARTISTS", 1))

for c in artists:
    ps = [p for p in col_products.get(c["handle"], []) if p.get("images")]
    body = f"""<div class="wrap">
    <div class="page-title r in">{esc(c['title'])}</div>
    <div class="page-sub r in">{len(ps)} WORKS</div>
    <div class="section-label"></div>
    <div class="grid">{''.join(card(p, 1, num=i + 1, max_w=max_phys_w(ps)) for i, p in enumerate(ps))}</div></div>"""
    open(os.path.join(OUT, "artists", f"{c['handle']}.html"), "w").write(
        page(f"{c['title']} — Chase Contemporary", body, "ARTISTS", 1))

for p in products:
    det = details(p)
    ed = is_edition(p)
    c = artist_of.get(p["id"])
    siblings = [s for s in (col_products.get(c["handle"], []) if c else []) if s.get("images")]
    idx = next((i for i, s in enumerate(siblings) if s["id"] == p["id"]), -1)
    prev_p = siblings[idx - 1] if idx > 0 else None
    next_p = siblings[idx + 1] if 0 <= idx < len(siblings) - 1 else None
    related = [s for s in siblings if s["id"] != p["id"]][:3]
    crumb = (f'<a class="crumb" href="../artists/{c["handle"]}.html" data-img="{col_preview(c, 480)}">&larr; {esc(c["title"])}</a>'
             if c else '<span class="crumb"></span>')
    wnav = ""
    if prev_p or next_p:
        left = f'<a href="{prev_p["handle"]}.html" data-img="{imgsrc(prev_p, 640)}">&larr; PREVIOUS</a>' if prev_p else "<span></span>"
        right = f'<a href="{next_p["handle"]}.html" data-img="{imgsrc(next_p, 640)}">NEXT &rarr;</a>' if next_p else "<span></span>"
        pos = f'<span style="font-size:8px;letter-spacing:.26em;color:var(--mute)">{idx + 1:02d} / {len(siblings):02d}</span>' if idx >= 0 else ""
        wnav = f'<div class="wnav">{left}{pos}{right}</div>'
    rel = ""
    if related:
        rel = f"""<div class="rel"><div class="section-label r">MORE FROM {esc(p['vendor'])}</div>
        <div class="grid">{''.join(card(w, 1) for w in related)}</div></div>"""
    body = f"""<div class="wrap">{crumb}<div class="work">
  <div class="work-img r in">{pic(p, 1400, "fx", "(max-width: 880px) 92vw, 60vw")}</div>
  <div class="work-info r in">
    <div class="artist"><a href="../artists/{c['handle'] + '.html' if c else '#'}">{esc(p['vendor'])}</a></div>
    <div class="title">{esc(p['title'])}</div>
    <div class="meta">{'<br>'.join(esc(l) for l in det)}</div>
    <div class="price">{price_line(p)}</div>
    <div class="status">AVAILABLE</div>
    <button class="btn-inq" id="inqbtn" onclick="inq(this)">{"ACQUIRE" if ed else "INQUIRE"}</button>
    <div class="alt-acts" id="altacts">
      {"" if ed else '<button onclick="inqPre(&#x27;hold&#x27;)">PLACE A 72-HOUR HOLD</button>'}
      <button onclick="inqPre('viewing')">SCHEDULE A PRIVATE VIEWING</button>
      <button onclick="inqPre('images')">REQUEST IMAGES &amp; CONDITION REPORT</button>
    </div>
    <form class="inq" id="inq" onsubmit="sendInq(event)">
      <div class="fhead">INQUIRE — {esc(p['title'])}</div>
      <div class="row2">
        <div><label for="f-fn">FIRST NAME *</label><input id="f-fn" required autocomplete="given-name"></div>
        <div><label for="f-ln">LAST NAME *</label><input id="f-ln" required autocomplete="family-name"></div>
      </div>
      <div class="row2">
        <div><label for="f-e">EMAIL *</label><input id="f-e" type="email" required autocomplete="email"></div>
        <div><label for="f-p">PHONE</label><input id="f-p" type="tel" autocomplete="tel"></div>
      </div>
      <div class="row2">
        <div><label for="f-c">CITY</label><input id="f-c" autocomplete="address-level2"></div>
        <div><label for="f-h">HOW DID YOU FIND US</label>
          <select id="f-h"><option value="" selected>SELECT</option><option>INSTAGRAM</option>
          <option>SEARCH</option><option>ART FAIR</option><option>PRESS</option>
          <option>WORD OF MOUTH</option><option>WALKED BY</option></select></div>
      </div>
      <label for="f-m">MESSAGE</label>
      <textarea id="f-m">I am interested in {esc(p['title'])} by {esc(p['vendor'])}. Please send availability, additional images, and a condition report.</textarea>
      <label class="ck"><input type="checkbox" checked><span>KEEP ME INFORMED OF NEW WORKS BY {esc(p['vendor'].upper())} AND GALLERY EXHIBITIONS</span></label>
      <label class="ck"><input type="checkbox"><span>I AM AN ART ADVISOR OR INTERIOR DESIGNER (TRADE)</span></label>
      <input type="hidden" name="artwork_handle" value="{esc(p['handle'])}">
      <input type="hidden" name="artwork_title" value="{esc(p['title'])}">
      <input type="hidden" name="artist" value="{esc(p['vendor'])}">
      <input type="hidden" name="price_band" value="{esc(price_line(p))}">
      <input type="hidden" name="product_type" value="{esc(p.get('product_type') or 'Artwork')}">
      <input type="hidden" name="page_journey" id="cc-journey">
      <input type="hidden" name="referrer" id="cc-ref">
      <input type="hidden" name="utm" id="cc-utm">
      <input type="hidden" name="seconds_on_page" id="cc-secs">
      <button class="btn-inq" type="submit" style="margin-top:26px">SEND INQUIRY</button>
      <div class="note" style="margin-top:12px">ATTACHED AUTOMATICALLY FOR THE GALLERY: THIS ARTWORK, PRICE BAND, YOUR PATH THROUGH THE SITE, AND HOW YOU ARRIVED.</div>
      <div class="note">A MEMBER OF THE GALLERY WILL RESPOND WITHIN MINUTES DURING GALLERY HOURS.<br>YOUR DETAILS STAY WITH THE GALLERY AND ARE NEVER SHARED.</div>
    </form>
    <div class="inq-done" id="inq-done">RECEIVED.<br>A MEMBER OF THE GALLERY WILL BE IN TOUCH SHORTLY.</div>
    <div class="assure">HAND-SIGNED ORIGINALS · CERTIFICATE OF AUTHENTICITY<br>WORLDWIDE FINE-ART SHIPPING · CARD, ACH, WIRE, FINANCING</div>
    {wnav}
  </div></div>
  {rel}</div>
<div class="mbar"><span class="p">{price_line(p)}</span><button class="act" onclick="document.getElementById('inq').scrollIntoView({{behavior:'smooth',block:'center'}});inq(document.getElementById('inqbtn'))">{"ACQUIRE" if ed else "INQUIRE"}</button></div>
<script>document.addEventListener('DOMContentLoaded',function(){{document.body.classList.add('workpage');
var l=document.getElementById('lb');
if(l) l.innerHTML='<img src="{imgsrc(p, 2400)}" alt="{esc(p['title'])}">';
document.addEventListener('keydown',function(e){{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  {f"if(e.key==='ArrowLeft') location.href='{prev_p['handle']}.html';" if prev_p else ""}
  {f"if(e.key==='ArrowRight') location.href='{next_p['handle']}.html';" if next_p else ""}
}});}});</script>"""
    open(os.path.join(OUT, "works", f"{p['handle']}.html"), "w").write(
        page(f"{p['title']} — {p['vendor']}", body, "", 1))

grid = ''.join(card(p, 1) for p in pele if p.get("images"))
body = f"""<div class="wrap"><div class="page-title r in">{esc(EXHIBITION['title'])}</div>
<div class="page-sub r in">{esc(EXHIBITION['sub'])} · CURRENT EXHIBITION</div>
<div class="statement r" style="margin-top:56px;">A COLLECTION CELEBRATING THE KING — WORKS HONORING PELÉ'S LEGACY, PRESENTED BY THE GALLERY.</div>
<div class="section-label"></div>
<div class="grid">{grid}</div>
<div class="section-label r">ARCHIVE</div>
<div class="prose r"><p>FIFTY EXHIBITIONS, 2017 TO TODAY — HAMBLETON, VALENCIA, TAUPIN, SCHARF, FEUERMAN — RETURN TO THIS PAGE AS THE ARCHIVE IS RESTORED.</p></div></div>"""
open(os.path.join(OUT, "exhibitions", "index.html"), "w").write(page("Exhibitions — Chase Contemporary", body, "EXHIBITIONS", 1))

body = """<div class="wrap"><div class="page-title r in">ABOUT</div>
<div class="section-label"></div>
<div class="prose r in">
<p>CHASE CONTEMPORARY WAS FOUNDED IN NEW YORK IN 2017 BY BERNIE CHASE. FROM ITS CHELSEA BEGINNINGS TO A TEN-THOUSAND-SQUARE-FOOT FLAGSHIP ON WEST BROADWAY, THE GALLERY HAS STAGED MORE THAN FIFTY SOLO EXHIBITIONS.</p>
<p>THE PROGRAM CENTERS ON CONTEMPORARY AND STREET ART — RICHARD HAMBLETON, RETNA, KENNY SCHARF — ALONGSIDE THE ARTISTS THE GALLERY HAS DISCOVERED AND CHAMPIONED, INCLUDING ANDRES VALENCIA.</p>
<p>[BIO COPY PENDING BERNIE'S APPROVAL — DRAFTED FROM THE PRESS ARCHIVE.]</p>
</div></div>"""
open(os.path.join(OUT, "about.html"), "w").write(page("About — Chase Contemporary", body, "ABOUT"))

body = """<div class="wrap"><div class="page-title r in">CONTACT</div>
<div class="section-label"></div>
<div class="prose r in">
<p>INFO@CHASECONTEMPORARY.COM</p>
<p>NEW YORK · PALM BEACH · LOS ANGELES</p>
<p>FOR ACQUISITIONS, PRIVATE VIEWINGS, AND CONSIGNMENT INQUIRIES, A MEMBER OF THE GALLERY RESPONDS WITHIN MINUTES DURING GALLERY HOURS.</p>
</div></div>"""
open(os.path.join(OUT, "contact.html"), "w").write(page("Contact — Chase Contemporary", body, "CONTACT"))

print(f"built {len(products) + len(artists) + 5} pages -> {OUT}")
