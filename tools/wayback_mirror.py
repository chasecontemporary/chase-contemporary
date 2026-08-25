#!/usr/bin/env python3
"""Mirror the latest Wayback snapshot of every legacy chasecontemporary.com page.
Polite: 1 req/sec, resumable (skips already-downloaded files)."""
import os, re, time, urllib.request, urllib.parse, json

ROOT = os.path.expanduser("~/chase-contemporary/research/chase-contemporary")
RAW = os.path.join(ROOT, "wayback-cdx-raw.txt")
OUT = os.path.join(ROOT, "wayback-mirror")
os.makedirs(OUT, exist_ok=True)

paths = {}
for line in open(RAW):
    parts = line.split(" ")
    if len(parts) < 2:
        continue
    url, ts = parts[0], parts[1]
    p = urllib.parse.urlparse(url).path.rstrip("/") or "/"
    if p not in paths or ts > paths[p][1]:
        paths[p] = (url, ts)

def fname(p):
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", p).strip("_") or "root"
    return slug[:180] + ".html"

log = open(os.path.join(OUT, "_mirror-log.txt"), "a")
todo = sorted(paths.items())
done = fail = skip = 0
for p, (url, ts) in todo:
    out = os.path.join(OUT, fname(p))
    if os.path.exists(out) and os.path.getsize(out) > 500:
        skip += 1
        continue
    # id_ returns the original page without the Wayback toolbar
    wb = f"https://web.archive.org/web/{ts}id_/{url}"
    try:
        req = urllib.request.Request(wb, headers={"User-Agent": "Mozilla/5.0 (research mirror; contact devyn@magnumopus.agency)"})
        data = urllib.request.urlopen(req, timeout=60).read()
        open(out, "wb").write(data)
        done += 1
        log.write(f"OK {p} {ts} {len(data)}\n")
    except Exception as e:
        fail += 1
        log.write(f"FAIL {p} {ts} {e}\n")
    log.flush()
    time.sleep(1.1)

summary = {"total": len(todo), "downloaded": done, "skipped_existing": skip, "failed": fail}
json.dump(summary, open(os.path.join(OUT, "_summary.json"), "w"), indent=2)
print(summary)
