"""PLAGUE-b: mark the empty-house boards in each b1 close-up — the pixels that differ from the same frame drawn without
the boards (plagueBCaptures.ts NO_BOARDS) — and save the marked JPEG with the changed pixel count. A house whose frame
without the base paintings' boards (NO_BASE_BOARDS) is unchanged wears a Wave 26 variant's own `boarded` layer.
    python3 scripts/plagueBMarkBoards.py <captures dir>"""
import json, sys, pathlib
from PIL import Image, ImageChops

out = pathlib.Path(sys.argv[1])
facts = {}
CROP = (120, 60, 360, 330)  # the house (its tile is the frame's centre, 240 × 280; the painting rises above it)
for shot in sorted(out.glob("b1-vacant-house-*[0-9].png")):
    shown = Image.open(shot).convert("RGB")
    frames = {suffix: Image.open(shot.with_name(shot.stem + suffix + ".png")).convert("RGB") for suffix in ("-noboards", "-nobase")}
    # Changed pixels around the house (JPEG-free PNGs; walkers' steps between the two loads count too).
    changed = {suffix: ImageChops.difference(shown, frame).crop(CROP).convert("L").point(lambda v: 255 if v > 24 else 0).histogram()[255]
               for suffix, frame in frames.items()}
    # Side by side: as drawn | the same frame without any boards.
    pair = Image.new("RGB", (2 * (CROP[2] - CROP[0]) + 8, CROP[3] - CROP[1]), (40, 36, 30))
    pair.paste(shown.crop(CROP), (0, 0)); pair.paste(frames["-noboards"].crop(CROP), (CROP[2] - CROP[0] + 8, 0))
    pair.save(shot.with_name(shot.stem + "-pair.jpg"), quality=78)
    shown.save(shot.with_suffix(".jpg"), quality=72)
    facts[shot.stem] = {"changedWithoutBoards": changed["-noboards"], "changedWithoutBaseBoards": changed["-nobase"],
                        "boards": "Wave 7 boarded_lN (base painting)" if changed["-nobase"] > 0 else "Wave 26 variant's own boarded layer"}
    for suffix in ("", "-noboards", "-nobase"): shot.with_name(shot.stem + suffix + ".png").unlink()
(out / "plague-b-boards.json").write_text(json.dumps(facts, indent=2))
print(json.dumps(facts, indent=2))
