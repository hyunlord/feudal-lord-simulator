#!/bin/sh
# ASSET-1 pipeline, in order (read-only on the repository at ../a1trunk).
set -e
python3 hashall.py ../a1trunk hashes.json
python3 reconcile.py
python3 paths.py
python3 pixmetrics.py metric_paths.json metrics.json
python3 specks.py
python3 innersemi.py
python3 specs.py
python3 items.py
python3 render_sheets.py
python3 write_csvs.py
python3 fixlists.py
python3 scale_table.py
python3 write_report.py
