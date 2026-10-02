#!/usr/bin/env python3
"""NAT-5 (RUN-02 / decision N4-D3, user 2026-10-03): install the three storehouse snow layers.

Astra's layers (assets-inbox/storehouse-corner/candidates-20261003/assets/storehouse_{a,b,c}_snow-v1.png, ledger
status confirmed) are drawn on the storehouse picture's own canvas (160 x 136, same pivot, offset (0, 0)), so they are
copied as they are to public/assets/storehouse-snow/ and drawn into the storehouse's fitted rect
(src/render/storehouseSnowArt.ts). Each file must match its ledger sha256; the ledger rows get installed_by NAT-5.
The gate corner pieces in the same pack are not installed (the user rejected them; corners are being redone).
Rerunnable: copies again and leaves an already-set installed_by alone.
"""
import csv
import hashlib
import io
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = "storehouse-corner/candidates-20261003/assets"
LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
OUT = ROOT / "public/assets/storehouse-snow"
VARIANTS = ("a", "b", "c")
SIZE = (160, 136)


def png_size(path: Path) -> tuple[int, int]:
    return struct.unpack(">II", path.read_bytes()[16:24])


def main() -> None:
    text = LEDGER.read_text(encoding="utf-8")
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0]
    file_col, sha_col, status_col, by_col = (header.index(name) for name in ("file", "sha256", "status", "installed_by"))
    OUT.mkdir(parents=True, exist_ok=True)
    for variant in VARIANTS:
        name = f"storehouse_{variant}_snow-v1.png"
        source = ROOT / "assets-inbox" / PACK / name
        row = next(row for row in rows[1:] if row[file_col] == f"{PACK}/{name}")
        if row[status_col] != "confirmed":
            raise SystemExit(f"{name}: ledger status {row[status_col]}, not confirmed")
        if hashlib.sha256(source.read_bytes()).hexdigest() != row[sha_col]:
            raise SystemExit(f"{name}: sha256 differs from the ledger")
        if png_size(source) != SIZE:
            raise SystemExit(f"{name}: {png_size(source)}, not the storehouse canvas {SIZE}")
        shutil.copyfile(source, OUT / f"storehouse_{variant}_snow.png")
        if row[by_col] == "":
            row[by_col] = "NAT-5"
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="\r\n").writerows(rows)
    LEDGER.write_text(buffer.getvalue(), encoding="utf-8", newline="")
    print(f"installed {len(VARIANTS)} storehouse snow layers into {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
