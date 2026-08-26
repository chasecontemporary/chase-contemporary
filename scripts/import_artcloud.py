#!/usr/bin/env python3
"""Artcloud -> Chase Engine importer.
Reads Artcloud CSV exports from data/artcloud/ and upserts into Supabase.
  contacts.csv   -> collectors            (dedupe by email; no-email rows get placeholder key)
  inventory.csv  -> artworks              (match by sku/inventory_number via artcloud_id)
  invoices.csv   -> invoices + purchases  (Closed/paid -> purchases on the collector)
Usage:
  python3 scripts/import_artcloud.py --dry      # parse + report, write nothing
  python3 scripts/import_artcloud.py            # import for real
Column names are matched loosely (case/space-insensitive) against Artcloud's
migration-template headers, so minor export variations still map.
"""
import csv, json, re, sys, urllib.request, time

SUPABASE_URL = "https://iplqycxyqmutswhlbbgj.supabase.co"
def service_key():
    for line in open("SECRETS.local.md"):
        if "service_role key:" in line:
            return line.split("key:")[1].strip()
    sys.exit("service_role key not found in SECRETS.local.md")

KEY = service_key()
DRY = "--dry" in sys.argv

def rest(path, rows, on_conflict=None):
    if DRY or not rows: return len(rows)
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if on_conflict: url += f"?on_conflict={on_conflict}"
    req = urllib.request.Request(url, data=json.dumps(rows).encode(), method="POST", headers={
        "apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"})
    urllib.request.urlopen(req, timeout=120)
    return len(rows)

def fetch(path, params=""):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}?{params}", headers={
        "apikey": KEY, "Authorization": f"Bearer {KEY}"})
    return json.load(urllib.request.urlopen(req, timeout=120))

def norm(h): return re.sub(r"[^a-z0-9]", "", (h or "").lower())

def reader(path):
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        rows = list(csv.DictReader(f))
    return [{norm(k): (v or "").strip() for k, v in r.items()} for r in rows]

def pick(r, *names):
    for n in names:
        v = r.get(norm(n))
        if v: return v
    return None

def money_cents(v):
    if not v: return 0
    try: return round(float(re.sub(r"[^0-9.-]", "", v)) * 100)
    except: return 0

def chunks(xs, n=500):
    for i in range(0, len(xs), n): yield xs[i:i+n]

# ---------------- contacts ----------------
def import_contacts():
    try: rows = reader("data/artcloud/contacts.csv")
    except FileNotFoundError: print("contacts.csv not found, skipping"); return
    out, skipped = [], 0
    for r in rows:
        email = (pick(r, "email") or "").lower()
        if not email:
            fn, ln = pick(r, "firstname", "first_name") or "", pick(r, "lastname", "last_name") or ""
            if not (fn or ln): skipped += 1; continue
            email = f"noemail+{norm(fn)}{norm(ln)}@import.chasecontemporary.com"
        out.append({
            "email": email,
            "salutation": pick(r, "salutation", "prefix"),
            "first_name": pick(r, "firstname", "first_name"),
            "last_name": pick(r, "lastname", "last_name"),
            "spouse_first_name": pick(r, "spouse_first_name"),
            "spouse_last_name": pick(r, "spouse_last_name"),
            "phone": pick(r, "phone_mobile", "phone_home", "phone_other", "phone"),
            "company": pick(r, "company"),
            "website": pick(r, "website"),
            "address_line1": pick(r, "billing_address_line1", "address_line1", "billing_address_1"),
            "address_line2": pick(r, "billing_address_line2", "address_line2"),
            "city": pick(r, "billing_city", "city"),
            "state": pick(r, "billing_state", "state"),
            "zip": pick(r, "billing_zip", "zip", "billing_postal_code"),
            "country": pick(r, "billing_country", "country"),
            "newsletter": (pick(r, "is_subscribed", "subscribed") or "").lower() in ("yes","true","1"),
            "source": pick(r, "origin"),
            "notes": pick(r, "notes"),
            "tags": [t.strip() for t in (pick(r, "tags") or "").split(",") if t.strip()],
            "artcloud_id": pick(r, "import_key", "id"),
        })
    seen, dedup = set(), []
    for o in out:
        if o["email"] in seen: continue
        seen.add(o["email"]); dedup.append(o)
    n = 0
    for c in chunks(dedup): n += rest("collectors", c, on_conflict="email"); time.sleep(0.1)
    print(f"contacts: {len(rows)} rows -> {len(dedup)} collectors upserted ({skipped} skipped, {len(out)-len(dedup)} dupes)")

# ---------------- inventory ----------------
def import_inventory():
    try: rows = reader("data/artcloud/inventory.csv")
    except FileNotFoundError: print("inventory.csv not found, skipping"); return
    out = []
    for r in rows:
        title = pick(r, "title")
        if not title: continue
        artist = " ".join(x for x in [pick(r, "artist_first_name"), pick(r, "artist_last_name")] if x) or pick(r, "artist")
        out.append({
            "artcloud_id": pick(r, "sku", "inventory_number", "import_key") or f"{norm(title)}-{norm(artist or '')}",
            "title": title, "artist": artist,
            "price_cents": money_cents(pick(r, "price")),
            "product_type": pick(r, "type") or "Artwork",
            "is_edition": bool(pick(r, "edition_count")),
            "available": (pick(r, "active") or "yes").lower() not in ("no","false","0","inactive"),
            "medium": pick(r, "medium"),
            "dims_h_in": pick(r, "height"), "dims_w_in": pick(r, "width"),
        })
    for o in out:
        for k in ("dims_h_in","dims_w_in"):
            try: o[k] = float(o[k]) if o[k] else None
            except: o[k] = None
    n = 0
    for c in chunks(out): n += rest("artworks", c, on_conflict="artcloud_id"); time.sleep(0.1)
    print(f"inventory: {len(rows)} rows -> {n if not DRY else len(out)} artworks upserted")

# ---------------- invoices ----------------
def import_invoices():
    try: rows = reader("data/artcloud/invoices.csv")
    except FileNotFoundError: print("invoices.csv not found, skipping"); return
    emails = sorted({(pick(r, "client_email", "email") or "").lower() for r in rows if pick(r, "client_email", "email")})
    cmap = {}
    for c in chunks(emails, 100):
        got = fetch("collectors", "select=id,email&email=in.(" + ",".join(f'"{e}"' for e in c) + ")") if not DRY else []
        for g in got: cmap[g["email"]] = g["id"]
    invs, buys, unmatched = [], [], 0
    for r in rows:
        email = (pick(r, "client_email", "email") or "").lower()
        cid = cmap.get(email)
        amount = money_cents(pick(r, "item_price", "total", "amount", "invoice_total"))
        status = (pick(r, "status") or "").lower()
        paid = status in ("closed", "paid") or (pick(r, "paid") or "").lower() in ("yes","true","1")
        title = pick(r, "item_description", "description", "title") or "Artwork"
        date = pick(r, "date", "invoice_date") or None
        if not cid: unmatched += 1
        invs.append({"collector_id": cid, "title": title, "amount_cents": amount,
                     "status": "paid" if paid else "open", "issued_at": date,
                     "paid_at": date if paid else None, "notes": "artcloud import"})
        if paid and cid:
            buys.append({"collector_id": cid, "title": title, "amount_cents": amount,
                         "purchased_at": date, "source": "artcloud"})
    for c in chunks(invs): rest("invoices", c); time.sleep(0.1)
    for c in chunks(buys): rest("purchases", c); time.sleep(0.1)
    print(f"invoices: {len(rows)} rows -> {len(invs)} invoices, {len(buys)} purchases ({unmatched} without collector match)")

if __name__ == "__main__":
    print("DRY RUN — nothing written" if DRY else "LIVE IMPORT")
    import_contacts(); import_inventory(); import_invoices()
    print("done.")
