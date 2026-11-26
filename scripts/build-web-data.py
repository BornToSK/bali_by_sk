"""Rebuild the static, gzip-compressed copy used by the trip website."""
from pathlib import Path
import gzip

root = Path(__file__).resolve().parents[1]
source = root / "itinerary.json"
target = root / "itinerary.json.gz"
original = source.read_bytes()
compressed = gzip.compress(original, compresslevel=9, mtime=0)
assert gzip.decompress(compressed) == original
target.write_bytes(compressed)
print(f"{source.name}: {len(original):,} bytes -> {target.name}: {len(compressed):,} bytes")
