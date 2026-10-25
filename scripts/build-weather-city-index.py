"""Build bounded lookup shards from GeoNames cities15000 and admin1CodesASCII.

Usage: python scripts/build-weather-city-index.py cities15000.txt admin1CodesASCII.txt
Source/licence: https://www.geonames.org/ (CC BY 4.0).
"""
from pathlib import Path
from collections import defaultdict
import sys, json, hashlib, gzip, unicodedata

def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if c.isalnum())

root = Path(__file__).resolve().parent.parent / 'gateway/data/weather-cities'
root.mkdir(parents=True, exist_ok=True)
admins = {}
for line in Path(sys.argv[2]).read_text().splitlines():
    parts = line.split('\t')
    admins[parts[0]] = parts[1]
buckets = defaultdict(lambda: defaultdict(dict))
count = 0
for line in Path(sys.argv[1]).read_text().splitlines():
    p = line.split('\t')
    if p[6] != 'P' or p[7] in ['PPLH', 'PPLQ', 'PPLW']: continue
    row = [p[0], p[1], p[8], float(p[4]), float(p[5]), int(p[14]), admins.get(p[8]+'.'+p[10], '')]
    for alias in set([p[1], p[2], *p[3].split(',')]):
        key = normalize(alias)
        if len(key) < 2: continue
        bucket = hashlib.sha256(key.encode()).hexdigest()[:2]
        buckets[bucket][key][p[0]] = row
    count += 1
for bucket, aliases in buckets.items():
    payload = {key: sorted(rows.values(), key=lambda r: -r[5]) for key, rows in sorted(aliases.items())}
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
    (root / (bucket+'.json.gz')).write_bytes(gzip.compress(raw, mtime=0))
print(json.dumps({'cities':count,'aliases':sum(len(x) for x in buckets.values()),'shards':len(buckets),'bytes':sum(p.stat().st_size for p in root.glob('*.gz'))}))
