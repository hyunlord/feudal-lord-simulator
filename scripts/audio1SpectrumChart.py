"""AUDIO-1 gate ② charts: the spectrum logs of scripts/audio1Captures.mjs drawn as one JPEG per moment — the eight
octave bands over time (dB, a heat strip), the master level, and the sounds that started at each sample. Needs
matplotlib. Run: python3 scripts/audio1SpectrumChart.py <audio-captures.json> <out-dir>"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

log = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
BANDS = ["63", "125", "250", "500", "1k", "2k", "4k", "8k"]
for key, moment in log["moments"].items():
    rows = moment["rows"]
    t = [row["t"] for row in rows]
    bands = np.array([row["bandsDb"] or [-120] * 8 for row in rows]).T
    fig, (top, bottom) = plt.subplots(2, 1, figsize=(9, 4.2), sharex=True, gridspec_kw={"height_ratios": [3, 1.4]})
    image = top.imshow(bands, aspect="auto", origin="lower", cmap="magma", vmin=-100, vmax=-20, extent=[t[0] - 0.125, t[-1] + 0.125, -0.5, 7.5])
    top.set_yticks(range(8)); top.set_yticklabels(BANDS, fontsize=7); top.set_ylabel("Hz (octave)", fontsize=8)
    top.set_title(f"{key} · {moment['state']} (tick {moment['tick']}) · loops: {', '.join(sorted(set(k.split(':')[0] for k in moment['summary']['loops'])))}", fontsize=8)
    fig.colorbar(image, ax=top, pad=0.01).set_label("dB", fontsize=7)
    bottom.plot(t, [row["rmsDb"] if row["rmsDb"] is not None else -120 for row in rows], color="navy")
    bottom.set_ylabel("level dB", fontsize=8); bottom.set_xlabel("s", fontsize=8); bottom.set_ylim(-80, -10)
    for row in rows:
        for index, sound in enumerate(row["started"]):
            bottom.annotate(sound, (row["t"], -14 - 6 * index), fontsize=6, rotation=0, color="firebrick")
    fig.tight_layout()
    fig.savefig(out / f"spectrum-{key}.jpg", dpi=90, pil_kwargs={"quality": 78})
    plt.close(fig)
print("charts", len(log["moments"]))
