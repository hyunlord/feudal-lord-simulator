"""INSTALL-4e gate 1: the 35 Wave 4e rows -- Astra ledger SHA, the received inbox file, the inbox file without its C2PA
caBX chunk, the installed runtime file and the project ledger row (docs/provenance/assets.csv) -- must agree.
Run: python3 scripts/wave4eLedgerCheck.py [out.json]"""
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
csv.field_size_limit(sys.maxsize)


def without_cabx(data):
    out, i = data[:8], 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        if data[i + 4:i + 8] != b"caBX":
            out += data[i:i + 12 + n]
        i += 12 + n
    return out


sha = lambda data: hashlib.sha256(data).hexdigest()
astra = list(csv.DictReader(open(ROOT / "assets-inbox/wave4e/provenance-wave4e.csv", encoding="utf-8-sig")))
ledger = {row["sourcePath"]: row for row in csv.DictReader(open(ROOT / "docs/provenance/assets.csv"))}
rows = []
for row in astra:
    inbox = "assets-inbox/wave4e/" + row["file"][len("assets/"):]
    data = (ROOT / inbox).read_bytes()
    entry = ledger.get(inbox)
    runtime = entry and (ROOT / entry["runtimePath"]).read_bytes()
    rows.append({"id": row["id"], "inbox": inbox, "runtime": entry and entry["runtimePath"], "astraSha": row["sha256"],
                 "inboxSha": sha(data), "inboxWithoutCaBX": sha(without_cabx(data)), "runtimeSha": runtime and sha(runtime),
                 "ledgerRuntimeSha": entry and entry["runtimeSha256"], "ledgerSourceSha": entry and entry["sourceSha256"],
                 "ok": entry is not None and sha(without_cabx(data)) == row["sha256"] == sha(runtime) == entry["runtimeSha256"]
                 and entry["sourceSha256"] == sha(data) and entry["status"] == "runtime"})
result = {"rows": len(rows), "ok": sum(r["ok"] for r in rows), "detail": rows}
text = json.dumps(result, indent=1)
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(text + "\n")
print(result["ok"], "/", result["rows"])
