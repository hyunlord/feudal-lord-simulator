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
  - Wave 5c (INSTALL-5c) adds the child and elder reskins (bands `child` / `elder`), measured on their own alpha.
  - Wave 4e (INSTALL-4e) adds seven reskins of the same format (women's labour and servant sheets, the poor), the
    yarn bundle and ale jug props (anchor: the ledger's `socketsOrAnchor`) and the merchant's winter cloak.
Winter cloak: the Wave 5a cloak was painted over the civilian templates; a sheet takes it when at most
CLOAK_POKE_LIMIT head pixels (rows 0..29 of a cell) stay outside the cloak's alpha (a brimmed hat or coif poking out
beside the hood), and never for the clergy. The Wave 4e merchant cloak was painted over the merchant template only
(torso rows from master y31, the hat left out on purpose, so the head poke test does not apply): every sheet on the
merchant template takes it, and no other sheet does.

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


CLOAK_FILES = {"male": "overlay_cloak_m-v1.png", "female": "overlay_cloak_f-v1.png", "merchant": "overlay_cloak_merchant_m-v1.png"}


def cloak_of(template, sex):
    return "merchant" if template == "merchant" else sex


def cloak_poke(image, sex):
    cloak = np.array(Image.open(ROOT / f"public/assets/walker-props-v1/{CLOAK_FILES[sex]}").convert("RGBA"))[..., 3] > 60
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
    cloak = cloak_of(legacy_id, sex)
    poke = cloak_poke(image, cloak)
    sheets.append({"id": f"legacy_{legacy_id}", "url": meta["url"], "width": meta["width"], "height": meta["height"],
                   "sha256": meta["sha256"], "classBand": band, "sex": sex,
                   "occupationTags": tags, "legacy": True, "holdsTool": legacy_id in HOLDS_TOOL, "template": legacy_id, "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": None if band in CLERGY or (cloak != "merchant" and poke > CLOAK_POKE_LIMIT) else cloak,
                   "cloakPoke": poke, "frames": frames_of(meta, hands)})

csv.field_size_limit(sys.maxsize)
rows = list(csv.DictReader(open(ROOT / "assets-inbox/wave5a/provenance-wave5a.csv", encoding="utf-8-sig")))
wave4e = list(csv.DictReader(open(ROOT / "assets-inbox/wave4e/provenance-wave4e.csv", encoding="utf-8-sig")))
# (file name, template) of every reskin: Wave 5a rows name the template, Wave 4e rows carry it in the generation record.
reskins = [(Path(row["file"]).name, re.search(r"actor_([a-z_]+)-v\d\.png", row["template"]).group(1)) for row in rows if row["type"] == "reskin"]
reskins += [(Path(row["file"]).name, re.search(r"actor_([a-z_]+)-v\d\.png", json.loads(row["generationRecords"])[0]["template"]).group(1))
            for row in wave4e if row["role"] == "walker_sheet"]
for name, template in reskins:
    match = re.match(r"wk_([a-z]+)_([mf])_(\d+)-v1\.png", name)
    band, sex = match.group(1), "male" if match.group(2) == "m" else "female"
    path = ROOT / "public/assets/walkers-v2" / name
    image = sheet_image(path)
    cloak = cloak_of(template, sex)
    poke = cloak_poke(image, cloak)
    sheets.append({"id": name[:-len("-v1.png")], "url": f"assets/walkers-v2/{name}", "width": 296, "height": 148,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "classBand": band,
                   "sex": sex, "occupationTags": BAND_OCCUPATIONS[band], "legacy": False, "holdsTool": False, "template": template,
                   "season": "all", "directionOrder": DIRECTIONS,
                   "cloak": None if band in CLERGY or (cloak != "merchant" and poke > CLOAK_POKE_LIMIT) else cloak, "cloakPoke": poke,
                   "frames": frames_of(actors[template], template_hands[template])})

# INSTALL-5c: the Wave 5c child and elder reskins (296x148, the INSTALL-4e derived templates' alpha exactly, so their
# own silhouettes are measured): foot = midpoint of the lowest opaque row (alpha >= 128), figure height = foot row -
# first opaque row + 1 (assets-inbox/derived-templates/measurements.json definitions); hands on the rows at 39-61 % of
# the figure from its head (where the adult rows 28..42 sit on its 64 px figure). No winter cloak: the Wave 5a / 4e
# cloaks were painted over adult bodies and do not fit a child or a stooped elder.
def own_frames(image):
    alpha = np.array(image)[..., 3]
    frames = []
    hands_by = {}
    for gait in range(2):
        for index, direction in enumerate(DIRECTIONS):
            cell = alpha[gait * 74:(gait + 1) * 74, index * 74:(index + 1) * 74]
            rows_ = np.nonzero((cell >= 128).any(axis=1))[0]
            top, bottom = int(rows_.min()), int(rows_.max())
            xs = np.nonzero(cell[bottom] >= 128)[0]
            height = bottom - top + 1
            band_top, band_bottom = top + round(0.39 * height), top + round(0.61 * height)
            hands = {}
            opaque = cell > 100
            for side in ("left", "right"):
                spans = [(y, int(np.nonzero(opaque[y])[0].min()) if side == "left" else int(np.nonzero(opaque[y])[0].max()))
                         for y in range(band_top, band_bottom + 1) if opaque[y].any()]
                outer = min(x for _, x in spans) if side == "left" else max(x for _, x in spans)
                run = [y for y, x in spans if x == outer]
                hands[side] = {"x": outer + 2 if side == "left" else outer - 2, "y": run[len(run) // 2]}
            frames.append({"direction": direction, "gaitFrame": gait,
                           "foot": {"x": round((int(xs.min()) + int(xs.max())) / 2, 2), "y": float(bottom)},
                           "figureHeight": float(height), "hands": hands})
    return frames


wave5c = list(csv.DictReader(open(ROOT / "assets-inbox/wave5c/candidates-20260925/records/assets.csv", encoding="utf-8-sig")))
for row in wave5c:
    name = Path(row["runtimePath"]).name
    match = re.match(r"wk_(child|elder)_([mf])_(\d+)-v1\.png", name)
    if match is None:
        continue
    band, sex = match.group(1), "male" if match.group(2) == "m" else "female"
    path = ROOT / "public/assets/walkers-v2" / name
    image = sheet_image(path)
    sheets.append({"id": name[:-len("-v1.png")], "url": f"assets/walkers-v2/{name}", "width": 296, "height": 148,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "classBand": band, "sex": sex, "occupationTags": [],
                   "legacy": False, "holdsTool": False, "template": f"{band}_{match.group(2)}", "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": None, "cloakPoke": None, "frames": own_frames(image)})

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
for row in wave4e:
    name = Path(row["file"]).name
    if not name.startswith("held_"):
        continue
    record = json.loads(row["generationRecords"])
    record = record[0] if isinstance(record, list) else record
    anchor = json.loads(row["socketsOrAnchor"])
    props.setdefault(record["kind"], {})[record["direction"]] = {
        "url": f"assets/walker-props-v1/{name}", "anchor": {"x": anchor["x"], "y": anchor["y"]},
        "role": "handle grip" if record["kind"] == "ale_jug" else "top cord-loop grip"}

# F0-V: the Wave 6 work tools (128x32 sheets, one 32 px cell per direction NE SE SW NW), gripped at the pivots of
# their registration record; the builder holds the shovel through the foundation and the hammer from the frame on.
registration = json.loads((ROOT / "assets-inbox/wave6/candidates-20260925/records/worktools-registration.json").read_text())
for tool in registration["tools"]:
    kind = Path(tool["id"]).name.removesuffix("-v1")
    if kind not in ("work_hammer", "work_shovel"):
        continue
    for index, direction in enumerate(registration["directionOrder"]):
        props.setdefault(kind, {})[direction] = {"url": f"assets/visibility-v1/work/{kind}-v1.png",
            "anchor": {"x": tool["pivots"][index][0], "y": tool["pivots"][index][1]}, "role": "grip", "cell": index, "sheetWidth": 128}

target = ROOT / "src/render/walkerSheetManifest.generated.ts"
lines = ["// Generated by scripts/buildWalkerSheetManifest.py (rules in its header). Do not edit by hand.",
         "export const walkerSheetManifest = ["]
lines += [json.dumps(sheet, separators=(",", ":")) + "," for sheet in sheets]
lines += ["] as const;", "", f"export const walkerPropManifest = {json.dumps(props, separators=(',', ':'))} as const;", "",
          "export const walkerCloakManifest = " + json.dumps({key: {"url": f"assets/walker-props-v1/{file}"} for key, file in CLOAK_FILES.items()},
                                                            separators=(",", ":")) + " as const;", ""]
target.write_text("\n".join(lines))
print(len(sheets), "sheets;", sum(1 for s in sheets if s["cloak"]), "cloaked;", {k: len(v) for k, v in props.items()})
for s in sheets: print(s["id"], s["classBand"], s["sex"], s["template"], s["cloak"], s["cloakPoke"])
