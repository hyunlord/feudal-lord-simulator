"""Walker sheet manifest for the V2 walker composer (src/render/walkerSheetManifest.generated.ts).

Sheets:
  - Wave 5a reskins (public/assets/walkers-v2, 296x148, 74 px cells, columns NE SE SW NW, rows gait frame 0 / 1). Each
    is one of four templates (civilian man / woman, merchant, cleric) edited cell for cell at 1/6 of the 1774x887
    template, with the template's bounds, feet and hand pixels kept (Wave 5a ledger `processing`: registration to
    the template bounds, protected feet / face / hand pixels). So feet and figure heights are the template's / 6.
  - Legacy occupation sheets (public/assets/runtime-actors-v1, 1774x887): builder, farmer, logger, carter and guard
    keep their own art (they hold their tool), civilian man / woman and merchant / cleric are the templates.

Per frame, in 74 px cell units (the legacy sheets are read at 296/1774 like the reskins):
  - foot and figure height: the template's registered frame (runtimeActorManifest) x 296/1774;
  - hands: rows 28..42 (Wave 5a `protectedRegions.hands` y65..81 at 1/2 = 32..40, widened by 4 px up and 2 px down;
    lower rows catch flared skirts), the side's outermost silhouette column (alpha > 100) is the hanging hand; the
    anchor is the middle row of that column's run, 2 px inward. Measured on the template, used by its reskins.
Winter cloak: the Wave 5a cloak was painted over the civilian templates; a sheet takes it when at most
CLOAK_POKE_LIMIT head pixels (rows 0..29 of a cell) stay outside the cloak's alpha (a brimmed hat or coif poking out
beside the hood), and never for the clergy.

Run: python3 scripts/buildWalkerSheetManifest.py
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIRECTIONS = ["NE", "SE", "SW", "NW"]
HAND_TOP, HAND_BOTTOM = 28, 42
CLOAK_POKE_LIMIT = 60
CLERGY = {"priest", "monk", "nun"}
# Legacy occupation art already holds its tool in the right hand (hammer, sickle, axe, spear): no held prop.
HOLDS_TOOL = {"builder", "farmer", "logger", "guard"}
LEGACY = {
    # id: (class band, sex, occupation tags); templates carry no occupation of their own.
    "builder": ("artisan", "male", ["builder"]),
    "farmer": ("labor", "male", ["farmer"]),
    "logger": ("labor", "male", ["logger"]),
    "carter": ("labor", "male", ["carter", "quarryman"]),
    "guard": ("guard", "male", ["guard"]),
    "civilian_man": ("labor", "male", []),
    "civilian_woman": ("servant", "female", []),
    "merchant": ("merchant", "male", []),
    "cleric": ("priest", "male", []),
}
BAND_OCCUPATIONS = {
    "labor": ["farmer", "logger", "quarryman", "carter", "builder"],
    "artisan": ["builder", "logger"],
    "textile": ["carter"],
    "merchant": ["distributor", "carter"],
    "servant": ["distributor", "carter"],
    "poor": ["distributor"],
    "gentry": [],
    "priest": [],
    "monk": [],
    "nun": [],
    "visitor": [],
}


def actor_manifest():
    text = (ROOT / "src/render/runtimeActorManifest.generated.ts").read_text()
    return {entry["id"]: entry for entry in json.loads(text[text.index("["):text.rindex("]") + 1])}


def sheet_image(path):
    image = Image.open(path).convert("RGBA")
    return image if image.size == (296, 148) else image.resize((296, 148), Image.LANCZOS)


def hands_of(image):
    alpha = np.array(image)[..., 3] > 100
    out = {}
    for gait in range(2):
        for index, direction in enumerate(DIRECTIONS):
            cell = alpha[gait * 74:(gait + 1) * 74, index * 74:(index + 1) * 74]
            hands = {}
            for side in ("left", "right"):
                rows = [(y, int(xs.min()) if side == "left" else int(xs.max()))
                        for y in range(HAND_TOP, HAND_BOTTOM + 1) for xs in [np.nonzero(cell[y])[0]] if len(xs) > 0]
                outer = min(x for _, x in rows) if side == "left" else max(x for _, x in rows)
                run = [y for y, x in rows if x == outer]
                hands[side] = {"x": outer + 2 if side == "left" else outer - 2, "y": run[len(run) // 2]}
            out[(direction, gait)] = hands
    return out


def cloak_poke(image, sex):
    cloak = np.array(Image.open(ROOT / f"public/assets/walker-props-v1/overlay_cloak_{sex[0]}-v1.png").convert("RGBA"))[..., 3] > 60
    alpha = np.array(image)[..., 3] > 60
    return max(int((alpha[g * 74:g * 74 + 30, d * 74:d * 74 + 74] & ~cloak[g * 74:g * 74 + 30, d * 74:d * 74 + 74]).sum())
               for g in range(2) for d in range(4))


def frames_of(template, hands):
    width, height = template["width"], template["height"]
    frames = []
    for gait in range(2):
        for direction in DIRECTIONS:
            frame = next(f for f in template["frames"] if f["direction"] == direction and f["gaitFrame"] == gait)
            frames.append({
                "direction": direction, "gaitFrame": gait,
                "foot": {"x": round(frame["foot"]["x"] * 296 / width - DIRECTIONS.index(direction) * 74, 2),
                         "y": round(frame["foot"]["y"] * 148 / height - gait * 74, 2)},
                "figureHeight": round(frame["source"]["height"] * 148 / height, 2),
                "hands": hands[(direction, gait)],
            })
    return frames


actors = actor_manifest()
template_file = {"cleric": "actor_cleric-v3.png"}
template_hands = {}
sheets = []
for legacy_id, (band, sex, tags) in LEGACY.items():
    meta = actors[legacy_id]
    image = sheet_image(ROOT / "public" / meta["url"])
    hands = hands_of(image)
    template_hands[legacy_id] = hands
    poke = cloak_poke(image, sex)
    sheets.append({"id": f"legacy_{legacy_id}", "url": meta["url"], "width": meta["width"], "height": meta["height"],
                   "sha256": meta["sha256"], "classBand": band, "sex": sex,
                   "occupationTags": tags, "legacy": True, "holdsTool": legacy_id in HOLDS_TOOL, "template": legacy_id, "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": None if band in CLERGY or poke > CLOAK_POKE_LIMIT else sex,
                   "cloakPoke": poke, "frames": frames_of(meta, hands)})

csv.field_size_limit(sys.maxsize)
rows = list(csv.DictReader(open(ROOT / "assets-inbox/wave5a/provenance-wave5a.csv", encoding="utf-8-sig")))
for row in rows:
    if row["type"] != "reskin":
        continue
    name = Path(row["file"]).name
    match = re.match(r"wk_([a-z]+)_([mf])_(\d+)-v1\.png", name)
    band, sex = match.group(1), "male" if match.group(2) == "m" else "female"
    template = re.search(r"actor_([a-z_]+)-v\d\.png", row["template"]).group(1)
    path = ROOT / "public/assets/walkers-v2" / name
    image = sheet_image(path)
    poke = cloak_poke(image, sex)
    sheets.append({"id": name[:-len("-v1.png")], "url": f"assets/walkers-v2/{name}", "width": 296, "height": 148,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "classBand": band,
                   "sex": sex, "occupationTags": BAND_OCCUPATIONS[band], "legacy": False, "holdsTool": False, "template": template,
                   "season": "all", "directionOrder": DIRECTIONS,
                   "cloak": None if band in CLERGY or poke > CLOAK_POKE_LIMIT else sex, "cloakPoke": poke,
                   "frames": frames_of(actors[template], template_hands[template])})

props = {}
for row in rows:
    if row["type"] != "prop":
        continue
    processing = json.loads(row["processing"])
    name = Path(row["file"]).name
    kind = processing["kind"]
    props.setdefault(kind, {})[processing["direction"]] = {
        "url": f"assets/walker-props-v1/{name}", "anchor": {"x": processing["anchor"]["x"], "y": processing["anchor"]["y"]},
        "role": processing["anchor"]["role"]}

target = ROOT / "src/render/walkerSheetManifest.generated.ts"
lines = ["// Generated by scripts/buildWalkerSheetManifest.py (rules in its header). Do not edit by hand.",
         "export const walkerSheetManifest = ["]
lines += [json.dumps(sheet, separators=(",", ":")) + "," for sheet in sheets]
lines += ["] as const;", "", f"export const walkerPropManifest = {json.dumps(props, separators=(',', ':'))} as const;", "",
          'export const walkerCloakManifest = {"male":{"url":"assets/walker-props-v1/overlay_cloak_m-v1.png"},'
          '"female":{"url":"assets/walker-props-v1/overlay_cloak_f-v1.png"}} as const;', ""]
target.write_text("\n".join(lines))
print(len(sheets), "sheets;", sum(1 for s in sheets if s["cloak"]), "cloaked;", {k: len(v) for k, v in props.items()})
for s in sheets: print(s["id"], s["classBand"], s["sex"], s["template"], s["cloak"], s["cloakPoke"])
