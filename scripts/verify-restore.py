#!/usr/bin/env python3
"""Post-restore verification.

A Supabase restore brings back a snapshot — which may be older than the last migration.
This checks that the schema the app depends on is actually present and that the data
survived, comparing row counts against the last known-good export.

    python3 scripts/verify-restore.py
"""
import gzip, json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE = os.path.join(ROOT, 'backups', '2026-08-28T02-25-27Z')

# Tables the app reads; the later ones only exist if 0035/0036 were in the snapshot.
CORE = ['collectors', 'artworks', 'inquiries', 'purchases', 'invoices', 'invoice_lines',
        'payments', 'commissions', 'commission_rules', 'sales', 'sale_items',
        'activities', 'collector_interests', 'holds', 'team_members', 'audiences', 'campaigns']
RECENT = ['offers', 'offer_responses', 'site_events', 'visitor_links']
VIEWS = ['collector_index', 'collector_journey', 'artist_stats', 'artist_comps',
         'book_stats', 'finance_monthly', 'inventory_by_location', 'artist_performance']


def env():
    path = os.path.join(ROOT, 'crm', '.env.local')
    out = {}
    for line in open(path):
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            out[k] = v.strip().strip('"')
    url, key = out.get('SUPABASE_URL'), out.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or url.startswith('['):
        sys.exit('crm/.env.local has redacted values — restore them from SECRETS.local.md')
    return url.rstrip('/'), key


def count(base, key, table):
    """Exact count via the Content-Range header — not capped at 1000 like a row fetch."""
    req = urllib.request.Request(f'{base}/rest/v1/{table}?select=id&limit=1',
                                 headers={'apikey': key, 'Authorization': f'Bearer {key}',
                                          'Prefer': 'count=exact'})
    try:
        r = urllib.request.urlopen(req)
        rng = r.headers.get('Content-Range', '')
        return int(rng.split('/')[-1]) if '/' in rng else 0
    except urllib.error.HTTPError as e:
        return f'MISSING ({e.code})'
    except Exception as e:
        return f'ERROR ({e})'


def baseline_counts():
    out = {}
    if not os.path.isdir(BASELINE):
        return out
    for f in os.listdir(BASELINE):
        if f.endswith('.json.gz'):
            with gzip.open(os.path.join(BASELINE, f), 'rt') as fh:
                out[f[:-8]] = len(json.load(fh))
    return out


def main():
    base, key = env()
    was = baseline_counts()
    print(f'  project: {base}\n')
    missing, shrunk = [], []

    print('  TABLES                     now        8/28 baseline')
    for t in CORE + RECENT:
        n = count(base, key, t)
        b = was.get(t)
        flag = ''
        if isinstance(n, str):
            missing.append(t); flag = '   <-- schema missing'
        elif b is not None and n < b:
            shrunk.append((t, b, n)); flag = f'   <-- LOST {b - n}'
        print(f'  {t:<22} {str(n):>8}   {"" if b is None else b:>8}{flag}')

    print('\n  VIEWS / RPCs')
    for v in VIEWS:
        n = count(base, key, v)
        ok = not isinstance(n, str)
        print(f'  {v:<22} {"ok" if ok else n}')
        if not ok:
            missing.append(v)

    print()
    if missing:
        print(f'  !! {len(missing)} object(s) missing — the snapshot predates a migration.')
        print('     Re-apply in order: db/migrations/0035-site-events.sql, 0036-offers.sql, 0037-harden.sql')
    if shrunk:
        print(f'  !! {len(shrunk)} table(s) smaller than the 8/28 export — restore predates it.')
        print('     The export is the newer copy; replay from backups/2026-08-28T02-25-27Z.')
    if not missing and not shrunk:
        print('  Everything the app depends on is present, and nothing shrank. Good to go.')


if __name__ == '__main__':
    main()
