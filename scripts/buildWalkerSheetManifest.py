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

# INSTALL-11: the Wave 11 construction workers (carpenter, mason), own 296 x 148 sheets. Band "kit": no occupation
# band draws them; a builder at a timber site wears the carpenter, at a stone / public / defense site the mason.
for name in ("wk_carpenter-v1.png", "wk_mason-v1.png"):
    path = ROOT / "public/assets/wave11/workers" / name
    image = sheet_image(path)
    sheets.append({"id": name[:-len("-v1.png")], "url": f"assets/wave11/workers/{name}", "width": 296, "height": 148,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "classBand": "kit", "sex": "male", "occupationTags": ["builder"],
                   "legacy": False, "holdsTool": False, "template": "kit_m", "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": None, "cloakPoke": None, "frames": own_frames(image)})

# INSTALL-3: the Wave 3 ale chain's workers, reskins of the civilian templates at their runtime size (the alewife on the
# woman's 312 x 156, the maltster on the man's 294 x 147: Astra kept each cell's head and both feet byte for byte,
# records/worker-overlap.csv), so they take the template's feet and figure heights, and hands measured on their own
# alpha. Band "ale": no occupation band draws them; the alewife walks a brewing house's malt errand, the maltster the
# kiln's (walkerComposer `walkerAppearance`). No winter cloak (not tested against these costumes).
for name, template, sex in (("wk_alewife.png", "civilian_woman", "female"), ("wk_maltster.png", "civilian_man", "male")):
    path = ROOT / "public/assets/wave3/workers" / name
    image = Image.open(path)
    sheets.append({"id": name[:-len(".png")], "url": f"assets/wave3/workers/{name}", "width": image.width, "height": image.height,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "classBand": "ale", "sex": sex, "occupationTags": [],
                   "legacy": False, "holdsTool": False, "template": template, "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": None, "cloakPoke": None, "frames": frames_of(actors[template], hands_of(sheet_image(path)))})

# INSTALL-3 (UI-9): the Wave 3 cloth chain's workers (shepherd, fuller, wool merchant), reskins of the civilian/merchant
# templates at their runtime size (wk_shepherd and wk_fuller on the man's 294 x 147, wk_wool_merchant on the merchant's
# 285 x 142: Astra kept each cell's head and both feet byte for byte, records/worker-overlap.csv), so they take the
# template's feet and figure heights, and hands measured on their own alpha. Band "cloth": no occupation band draws them;
# the shepherd walks from pastoral_farm, the fuller from fulling_mill, the wool merchant from dyehouse / tenter_yard
# (walkerComposer `walkerAppearance` via clothWorkerSheet). No winter cloak (not tested against these costumes).
_cloth_worker_csv_path = ROOT / "assets-inbox/wave3/candidates-20260926/records/worker-overlap.csv"
_cloth_template_by_id: dict = {}
for _ov in csv.DictReader(open(_cloth_worker_csv_path, encoding="utf-8")):
    _wid = _ov["assetId"].removesuffix("-v1")
    if _wid in ("wk_shepherd", "wk_fuller", "wk_wool_merchant") and _wid not in _cloth_template_by_id:
        _m = re.match(r"actor_([a-z_]+)-v\d\.png", _ov["template"])
        _cloth_template_by_id[_wid] = _m.group(1)
for _worker_id, _template in (("wk_shepherd", _cloth_template_by_id["wk_shepherd"]),
                               ("wk_fuller", _cloth_template_by_id["wk_fuller"]),
                               ("wk_wool_merchant", _cloth_template_by_id["wk_wool_merchant"])):
    _name = f"{_worker_id}.png"
    _sex = "female" if _template == "civilian_woman" else "male"
    _path = ROOT / "public/assets/wave3/workers" / _name
    _image = Image.open(_path)
    # Apply the same cloak logic as the reskins: merchant-template sheets take the merchant cloak; civilian
    # sheets take the sex cloak only if head poke is within the limit. cloak_poke uses 74 px cells and the
    # 296 x 148 cloak overlay — use sheet_image (which resizes to 296 x 148) so the shapes match.
    _image_for_cloak = sheet_image(_path)
    _cloak_kind = cloak_of(_template, _sex)
    _poke = cloak_poke(_image_for_cloak, _cloak_kind)
    _cloak = None if _cloak_kind != "merchant" and _poke > CLOAK_POKE_LIMIT else _cloak_kind
    sheets.append({"id": _worker_id, "url": f"assets/wave3/workers/{_name}", "width": _image.width, "height": _image.height,
                   "sha256": hashlib.sha256(_path.read_bytes()).hexdigest(), "classBand": "cloth", "sex": _sex, "occupationTags": [],
                   "legacy": False, "holdsTool": False, "template": _template, "season": "all",
                   "directionOrder": DIRECTIONS, "cloak": _cloak, "cloakPoke": _poke, "frames": frames_of(actors[_template], hands_of(sheet_image(_path)))})

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
    if kind not in ("work_hammer", "work_shovel", "work_sickle"):
        continue
    for index, direction in enumerate(registration["directionOrder"]):
        props.setdefault(kind, {})[direction] = {"url": f"assets/visibility-v1/work/{kind}-v1.png",
            "anchor": {"x": tool["pivots"][index][0], "y": tool["pivots"][index][1]}, "role": "grip", "cell": index, "sheetWidth": 128}

# INSTALL-7: the Wave 7 work props (one 32 x 32 image per direction), gripped at their pivot and placed at the walker
# point of Astra's attachment record (74 x 72 frame: shoulder for the seed bag, hand for the basket, bucket and plough,
# waist for the purse) instead of the right hand.
for row in csv.DictReader(open(ROOT / "assets-inbox/wave7/candidates-v1/records/assets.csv", encoding="utf-8-sig")):
    name = Path(row["file"]).name
    if not name.startswith("work_"):
        continue
    kind, direction = name[: -len("-v1.png")].rsplit("_", 1)
    record = json.loads(row["pivot_or_attachment"])
    attach = record["attachmentPoint"]
    props.setdefault(kind, {})[direction.upper()] = {"url": f"assets/wave7/work/{name}",
        "anchor": {"x": record["pivot"][0], "y": record["pivot"][1]}, "role": attach["kind"],
        "walkerPoint": {"x": attach["walkerPoint"][0], "y": attach["walkerPoint"][1]}}

# INSTALL-11: the kit workers' tools (one 32 x 32 image per direction, gripped at its centre in the right hand).
for kind in ("work_saw", "work_adze", "work_trowel"):
    for direction in ("ne", "se", "sw", "nw"):
        props.setdefault(kind, {})[direction.upper()] = {"url": f"assets/wave11/work/{kind}_{direction}-v1.png",
            "anchor": {"x": 16, "y": 16}, "role": "grip"}

# RB-WALKER-PILOT2: final-raster registration is independent of the legacy templates.
# The checked-in input owns all 32 body frames and 16 direction-specific prop grips.
pilot = json.loads((ROOT / "src/render/walkerPilot2.registration.json").read_text())
for artifact in pilot["provenance"]:
    path = ROOT / artifact["runtime"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != artifact["runtimeSha256"]:
        raise RuntimeError(f"Pilot runtime SHA mismatch: {path}")
pilot_provenance = {record["runtime"].removeprefix("public/"): {
    "inboxFile": record["source"], "sourceSha256": record["sourceSha256"],
    "runtimeSha256": record["runtimeSha256"]} for record in pilot["provenance"]}
pilot_entries = [{"id": sheet["id"], "kind": "walker-body", "allowMirror": False,
    "image": {key: sheet[key] for key in ("url", "width", "height")},
    "provenance": pilot_provenance[sheet["url"]],
    "registration": {key: value for key, value in sheet.items() if key not in ("id", "url", "width", "height", "sha256")}}
    for sheet in pilot["sheets"]]
pilot_rules = [{"id": f"walker-body-{sheet['id']}", "kind": "walker-body", "slot": "walker-body",
    "priority": 0, "conditions": [{"op": "eq", "field": "bodyId", "value": sheet["id"]}],
    "variants": [{"assetId": sheet["id"], "weight": 1}], "fallback": "none"} for sheet in pilot["sheets"]]
for kind, directions in pilot["props"].items():
    for direction, prop in directions.items():
        asset_id = f"{kind}_{direction}"
        pilot_entries.append({"id": asset_id, "kind": "walker-held-prop", "allowMirror": False,
            "image": {"url": prop["url"], "width": 32, "height": 32}, "provenance": pilot_provenance[prop["url"]],
            "propId": kind, "direction": direction, "scale": prop.get("scale", 0.65),
            **{key: value for key, value in prop.items() if key not in ("url", "sha256")}})
        pilot_rules.append({"id": f"walker-prop-{asset_id}", "kind": "walker-held-prop", "slot": "walker-held-prop",
            "priority": 0, "conditions": [{"op": "eq", "field": "propId", "value": kind},
                {"op": "eq", "field": "facing", "value": direction}],
            "variants": [{"assetId": asset_id, "weight": 1}], "fallback": "none"})
catalog_path = ROOT / "src/render/art/catalog.json"
catalog = json.loads(catalog_path.read_text())
catalog = [bundle for bundle in catalog if bundle["bundleId"] != "walker-pilot2"]
catalog.append({"schemaVersion": 1, "bundleId": "walker-pilot2", "packId": pilot["packId"],
    "entries": pilot_entries, "rules": pilot_rules})
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")

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
