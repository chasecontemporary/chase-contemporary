#!/usr/bin/env python3
"""Import the REAL Artcloud exports (pulled 2026-08-26 from pro.artcloud.com) into the Chase Engine.

Inputs (data/artcloud/, gitignored):
  contacts.csv                    27,017 contacts (full enrichment + Artcloud Id)
  inventory.csv                    1,446 works (Inventory Number = join key, CDN image URLs)
  sales-2011-2016.csv / -2016-2021 / -2021-2026
                                  invoice line items via Analytics > Sales Over Time
                                  (Type: Artwork/Archived = art lines; Service/blank = fees)

Idempotent: collectors upsert on email, artworks on artcloud_id, purchases on artcloud_key.
Usage: python3 scripts/import_artcloud_real.py [--dry]
"""
import csv, json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'artcloud'
URL = 'https://iplqycxyqmutswhlbbgj.supabase.co/rest/v1'
KEY = next(l.split('key: ')[1].strip() for l in (ROOT / 'SECRETS.local.md').read_text().splitlines()
           if 'service_role key:' in l)
DRY = '--dry' in sys.argv

def api(method, path, body=None, params=''):
    req = urllib.request.Request(f'{URL}/{path}?{params}', method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
                 'User-Agent': 'chase-engine/1.0',
                 'Prefer': 'resolution=merge-duplicates,return=minimal' if method == 'POST' else 'count=exact'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or 'null')

def get_all(path, sel):
    out, off = [], 0
    while True:
        req = urllib.request.Request(f'{URL}/{path}?select={sel}&limit=1000&offset={off}',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'User-Agent': 'chase-engine/1.0'})
        chunk = json.loads(urllib.request.urlopen(req).read())
        out += chunk
        if len(chunk) < 1000: return out
        off += 1000

def rd(name):
    with open(DATA / name, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))

def cents(s):
    s = re.sub(r'[^0-9.\-]', '', s or '')
    return int(round(float(s) * 100)) if s not in ('', '-', '.') else 0

def iso(s):
    s = (s or '').strip()
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m: return f'{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}'
    return s[:10] if re.match(r'^\d{4}-\d{2}-\d{2}', s) else None

def batch_upsert(table, rows, conflict):
    for i in range(0, len(rows), 500):
        api('POST', table, rows[i:i+500], f'on_conflict={conflict}')

# ---------- collectors ----------
contacts = rd('contacts.csv')
col_rows, seen_email = [], set()
for r in contacts:
    email = (r.get('Email') or '').strip().lower() or f"artcloud-{r['Id']}@import.chasecontemporary.com"
    if email in seen_email: continue
    seen_email.add(email)
    phone = next((r.get(k) for k in ('Phone (Mobile)', 'Phone (Home)', 'Phone (Other)') if (r.get(k) or '').strip()), None)
    col_rows.append({
        'email': email, 'artcloud_id': r['Id'],
        'salutation': r.get('Salutation') or None,
        'first_name': r.get('First Name') or None, 'last_name': r.get('Last Name') or None,
        'spouse_first_name': r.get('Spouse First Name') or None, 'spouse_last_name': r.get('Spouse Last Name') or None,
        'company': r.get('Company') or None, 'job_title': r.get('Job Title') or None,
        'phone': phone, 'website': r.get('Website') or None,
        'address_line1': r.get('Address Line 1') or None, 'address_line2': r.get('Address Line 2') or None,
        'city': r.get('City') or None, 'state': r.get('State') or None,
        'zip': r.get('Zip') or None, 'country': r.get('Country') or None,
        'source': r.get('Origin') or 'Artcloud import',
        'newsletter': r.get('Subscribed') == 'Yes',
        'tags': [t.strip() for t in (r.get('Tags') or '').split(',') if t.strip()] or None,
        'notes': r.get('Private Notes') or None,
        'created_at': iso(r.get('Created')) or '2020-01-01',
    })
print(f'collectors to upsert: {len(col_rows)}')

# ---------- artworks ----------
inventory = rd('inventory.csv')
art_rows, seen_aid = [], set()
for i, r in enumerate(inventory):
    aid = (r.get('Inventory Number') or '').strip() or (
        'sku:' + r['SKU'].strip() if (r.get('SKU') or '').strip() else f'row:{i}')
    if aid in seen_aid: continue
    seen_aid.add(aid)
    artist = ' '.join(x for x in (r.get('Artist First Name'), r.get('Artist Last Name')) if x) or None
    art_rows.append({
        'artcloud_id': aid, 'title': r.get('Title') or 'Untitled', 'artist': artist,
        'price_cents': cents(r.get('Price')) or None, 'medium': r.get('Medium') or None,
        'image_url': r.get('Image') or None, 'available': r.get('Active') == 'Yes',
        'acquired_at': (lambda d: d if d and int(d[:4]) >= 2005 else None)(iso(r.get('Date Added'))),
        'dims_h_in': float(r['Height']) if re.match(r'^\d+(\.\d+)?$', r.get('Height') or '') else None,
        'dims_w_in': float(r['Width']) if re.match(r'^\d+(\.\d+)?$', r.get('Width') or '') else None,
    })
print(f'artworks to upsert: {len(art_rows)}')

# ---------- sales -> purchases ----------
sales, seen_key = [], set()
for f in ('sales-2011-2016.csv', 'sales-2016-2021.csv', 'sales-2021-2026.csv'):
    for r in rd(f):
        if r.get('Type') not in ('Artwork', 'Archived'): continue
        key = f"{r.get('Invoice Number')}|{r.get('Inventory #')}|{iso(r.get('Date Sold'))}"
        if key in seen_key: continue
        seen_key.add(key)
        sales.append((key, r))
print(f'art sale lines (deduped): {len(sales)}')

if DRY:
    print('[dry] stopping before writes'); sys.exit(0)

batch_upsert('collectors', col_rows, 'email')
batch_upsert('artworks', art_rows, 'artcloud_id')
print('collectors + artworks upserted')

cols = get_all('collectors', 'id,email,first_name,last_name')
by_email = {c['email']: c['id'] for c in cols}
by_name = {}
for c in cols:
    n = f"{(c.get('first_name') or '').strip()} {(c.get('last_name') or '').strip()}".strip().lower()
    if n: by_name.setdefault(n, []).append(c['id'])
arts = get_all('artworks', 'id,artcloud_id')
by_aid = {a['artcloud_id']: a['id'] for a in arts if a.get('artcloud_id')}

new_cols, pur_rows, unmatched = {}, [], 0
for key, r in sales:
    email = (r.get('Contact Email') or '').strip().lower()
    name = (r.get('Contact Name') or '').strip()
    cid = by_email.get(email) if email else None
    if not cid and name:
        hits = by_name.get(name.lower(), [])
        cid = hits[0] if len(hits) == 1 else None
    if not cid:
        synth = email or 'sale-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') + '@import.chasecontemporary.com'
        if synth not in new_cols:
            parts = name.split(' ', 1)
            new_cols[synth] = {'email': synth, 'first_name': parts[0] or 'Unknown',
                               'last_name': parts[1] if len(parts) > 1 else None, 'source': 'Artcloud sale'}
        cid = synth  # placeholder, resolved after insert
        unmatched += 1
    pur_rows.append({'artcloud_key': key, 'collector_id': cid,
        'artwork_id': by_aid.get((r.get('Inventory #') or '').strip()),
        'title': r.get('Title') or 'Untitled', 'artist': r.get('Artist Name') or None,
        'amount_cents': cents(r.get('Sold Price')),
        'purchased_at': iso(r.get('Date Sold')), 'source': r.get('User') or 'Artcloud'})

if new_cols:
    vals = [v for v in new_cols.values()]
    batch_upsert('collectors', [{'email': v['email'], 'first_name': v.get('first_name'),
        'last_name': v.get('last_name'), 'source': v.get('source')} for v in vals], 'email')
    cols2 = get_all('collectors', 'id,email')
    by_email2 = {c['email']: c['id'] for c in cols2}
    for p in pur_rows:
        if isinstance(p['collector_id'], str) and '@' in p['collector_id']:
            p['collector_id'] = by_email2[p['collector_id']]
print(f'buyers created for unmatched sale contacts: {len(new_cols)} (lines unmatched: {unmatched})')

batch_upsert('purchases', pur_rows, 'artcloud_key')
print(f'purchases upserted: {len(pur_rows)}')
print('total sold value:', '${:,.0f}'.format(sum(p['amount_cents'] for p in pur_rows) / 100))
