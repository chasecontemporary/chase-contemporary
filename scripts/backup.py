#!/usr/bin/env python3
"""Full export of the Chase Engine database.

The production project is on Supabase's free plan, which gives no restorable
backups. Until that changes this script IS the backup. It paginates past
PostgREST's 1,000-row response cap, so the exports are complete, not truncated.

    python3 scripts/backup.py                 # -> backups/2026-08-28T…/
    python3 scripts/backup.py --verify DIR    # re-count a previous export

Credentials come from crm/.env.local (never committed).
"""
import argparse, gzip, json, os, sys, urllib.request, urllib.error
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 1000          # PostgREST hard cap per response

TABLES = [
    'collectors', 'artworks', 'artist_bios', 'inquiries', 'purchases',
    'sales', 'sale_items', 'invoices', 'invoice_lines', 'payments',
    'commissions', 'commission_rules', 'activities', 'collector_interests',
    'holds', 'deals', 'audiences', 'campaigns', 'team_members',
    'offers', 'offer_responses', 'site_events', 'visitor_links',
]


def env():
    path = os.path.join(ROOT, 'crm', '.env.local')
    if not os.path.exists(path):
        sys.exit('crm/.env.local not found — run: vercel env pull, then fill in the '
                 'sensitive values from SECRETS.local.md')
    out = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        out[k] = v.strip().strip('"')
    url, key = out.get('SUPABASE_URL'), out.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key or url.startswith('['):
        sys.exit('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing or redacted in '
                 'crm/.env.local (vercel env pull masks sensitive values).')
    return url.rstrip('/'), key


def fetch_all(base, key, table):
    """Every row, in pages, so nothing is silently cut at 1,000."""
    rows, offset = [], 0
    while True:
        req = urllib.request.Request(
            f'{base}/rest/v1/{table}?select=*&order=id.asc'
            f'&limit={PAGE}&offset={offset}',
            headers={'apikey': key, 'Authorization': f'Bearer {key}'})
        try:
            page = json.loads(urllib.request.urlopen(req).read())
        except urllib.error.HTTPError as e:
            # tables without an `id` column can't be ordered by it — fall back
            if offset == 0 and e.code == 400:
                req = urllib.request.Request(
                    f'{base}/rest/v1/{table}?select=*&limit={PAGE}&offset={offset}',
                    headers={'apikey': key, 'Authorization': f'Bearer {key}'})
                page = json.loads(urllib.request.urlopen(req).read())
            else:
                raise
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        offset += PAGE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verify', metavar='DIR', help='re-count a previous export')
    args = ap.parse_args()

    if args.verify:
        total = 0
        for f in sorted(os.listdir(args.verify)):
            if not f.endswith('.json.gz'):
                continue
            with gzip.open(os.path.join(args.verify, f), 'rt') as fh:
                n = len(json.load(fh))
            total += n
            print(f'  {f[:-8]:<22} {n:>7,}')
        print(f'  {"TOTAL":<22} {total:>7,}')
        return

    base, key = env()
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
    out = os.path.join(ROOT, 'backups', stamp)
    os.makedirs(out, exist_ok=True)

    manifest, total = {}, 0
    for t in TABLES:
        try:
            rows = fetch_all(base, key, t)
        except Exception as e:                       # a dropped table shouldn't kill the run
            print(f'  {t:<22} SKIPPED ({e})')
            manifest[t] = {'error': str(e)}
            continue
        with gzip.open(os.path.join(out, f'{t}.json.gz'), 'wt') as fh:
            json.dump(rows, fh)
        manifest[t] = {'rows': len(rows)}
        total += len(rows)
        print(f'  {t:<22} {len(rows):>7,}')

    manifest['_meta'] = {'taken_at': stamp, 'project': base, 'total_rows': total}
    with open(os.path.join(out, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, indent=2)
    print(f'\n  {total:,} rows -> backups/{stamp}/')
    print('  Keep a copy off this machine. Verify with: '
          f'python3 scripts/backup.py --verify backups/{stamp}')


if __name__ == '__main__':
    main()
