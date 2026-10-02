"""BLD-06 (art audit 2026-10-02): register the repainted state layers of the Wave 26 / 30 / 32 paintings onto their own
painting. The runtime already draws a layer through its painting's crop into its painting's rect (wave26HouseArt.ts,
wave32GranaryArt.ts), but some received layers were cut from a state picture that the image model drew a little larger,
smaller or shifted, so their timber, eaves and plinth land 1-6 canvas px off the painting's and draw twice. For each
weathered / fresh / boarded layer (a repaint: snow and the granary's fill layers add pixels and carry no structure to
measure) this measures the similarity transform (uniform scale about the canvas origin, then an offset, canvas px) that
best lays the layer's own edges on the painting's (normalised correlation of luminance edges inside both silhouettes:
scale 0.94-1.08 by 0.01 x offsets -10..10 px, then refined to 0.0025 / 0.25 px). A transform is applied only when it is
clearly better (ACCEPT below); then the runtime file becomes the state picture as received (the painting under the
layer: the layer was extracted as its difference from the painting, so the painting is the picture where the layer is
empty) moved by that transform and clipped to the painting's silhouette. Once moved it differs from the painting almost
everywhere, so it covers the whole painting (a weathered layer under a registered boarded one no longer shows through).
Same canvas, same rect: nothing changes in code. Every other layer keeps the received bytes. Writes the runtime files, their docs/provenance/assets.csv rows
(runtimeSha256, manualEdits) and docs/provenance/state-layer-registration.csv (every measured layer and the decision).
Idempotent: it always starts from the received bytes (each row's sourcePath). The installers call it after copying.
Run: python3 scripts/registerStateLayers.py
"""
import csv
import hashlib
import io
import shutil
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
RECORD = ROOT / "docs/provenance/state-layer-registration.csv"
FOLDERS = ("public/assets/wave26/house/", "public/assets/wave30/house_pair/", "public/assets/wave32/granary/")
REPAINTS = ("weathered", "fresh", "boarded")
ADDITIVE = ("snow", "empty", "half", "full")
NOTE = "BLD-06 registered onto its painting by scripts/registerStateLayers.py"
csv.field_size_limit(sys.maxsize)


def accept(identity: float, best: float, scale: float, dx: float, dy: float, cover: float) -> bool:
    """Clearly misregistered and clearly fixed: +0.08 correlation to at least 0.45, a layer of real extent (a quarter of
    the painting), and a bounded transform (larger fits on sparse marks were false matches when checked by eye)."""
    return best - identity >= 0.08 and best >= 0.45 and cover >= 0.25 and max(abs(dx), abs(dy)) <= 7 and 0.94 <= scale <= 1.08


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.float64) / 255


def edges(picture: np.ndarray) -> np.ndarray:
    luminance = picture[..., 0] * 0.299 + picture[..., 1] * 0.587 + picture[..., 2] * 0.114
    return ndimage.gaussian_filter(np.hypot(ndimage.sobel(luminance, 0), ndimage.sobel(luminance, 1)), 0.8)


def moved(channel: np.ndarray, scale: float, dx: float, dy: float, order: int = 1) -> np.ndarray:
    """The channel drawn at s * p + (dx, dy)."""
    return ndimage.affine_transform(channel, [1 / scale, 1 / scale], offset=[-dy / scale, -dx / scale], order=order, mode="constant", cval=0)


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean(); b = b - b.mean()
    norm = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / norm) if norm > 0 else -1.0


def measure(paths: tuple) -> tuple:
    """(identity, best, scale, dx, dy, cover) for the layer at `paths[1]` on the painting at `paths[0]`."""
    body, layer = rgba(paths[0]), rgba(paths[1])
    target = edges(body) * (body[..., 3] > 0.5)
    own = edges(layer) * (layer[..., 3] > 0.3)
    mask = (layer[..., 3] > 0.3).astype(np.float64)
    inside = ndimage.binary_erosion(body[..., 3] > 0.5, iterations=1)
    height, width = target.shape

    def score_of(e: np.ndarray, m: np.ndarray) -> float:
        where = (m > 0.5) & inside
        return correlation(e[where], target[where]) if where.sum() >= 80 else -1.0

    def score(scale: float, dx: float, dy: float) -> float:
        return score_of(moved(own, scale, dx, dy), moved(mask, scale, dx, dy, 0))

    identity = score(1.0, 0.0, 0.0)
    best = (identity, 1.0, 0.0, 0.0)
    for scale in np.round(np.arange(0.94, 1.08 + 1e-9, 0.01), 4):
        e0, m0 = moved(own, scale, 0, 0), moved(mask, scale, 0, 0, 0)
        for dx in range(-10, 11):
            for dy in range(-10, 11):
                e, m = np.zeros_like(e0), np.zeros_like(m0)
                to = (slice(max(dy, 0), height + min(dy, 0)), slice(max(dx, 0), width + min(dx, 0)))
                fro = (slice(max(-dy, 0), height + min(-dy, 0)), slice(max(-dx, 0), width + min(-dx, 0)))
                e[to], m[to] = e0[fro], m0[fro]
                value = score_of(e, m)
                if value > best[0]:
                    best = (value, float(scale), float(dx), float(dy))
    value, scale, dx, dy = best
    for step_scale, step in ((0.005, 0.5), (0.0025, 0.25)):
        improved = True
        while improved:
            improved = False
            for ds in (-step_scale, 0, step_scale):
                for ex in (-step, 0, step):
                    for ey in (-step, 0, step):
                        candidate = score(scale + ds, dx + ex, dy + ey)
                        if candidate > value + 1e-6:
                            value, scale, dx, dy, improved = candidate, scale + ds, dx + ex, dy + ey, True
    cover = float((layer[..., 3] > 0.3).sum() / max(1, (body[..., 3] > 0.5).sum()))
    return identity, value, round(scale, 4), round(dx, 2), round(dy, 2), cover


def registered(body_path: Path, layer_path: Path, scale: float, dx: float, dy: float) -> bytes:
    """The state picture (the layer over its painting) moved by the transform, clipped to the painting's silhouette."""
    body, layer = rgba(body_path), rgba(layer_path)
    a = layer[..., 3:4]
    picture = layer[..., :3] * a + body[..., :3] * (1 - a)
    weight = body[..., 3]
    alpha = moved(weight, scale, dx, dy)
    colour = [moved(picture[..., c] * weight, scale, dx, dy) for c in range(3)]
    rgb = np.stack([np.where(alpha > 1e-4, c / np.maximum(alpha, 1e-4), 0) for c in colour], -1)
    out = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha * body[..., 3], 0, 1)])
    out = np.round(out * 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    buffer = io.BytesIO()
    Image.fromarray(out, "RGBA").save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def main() -> None:
    raw = LEDGER.read_text(encoding="utf-8")
    header = next(csv.reader(io.StringIO(raw)))
    rows = list(csv.DictReader(io.StringIO(raw)))
    by_runtime = {row["runtimePath"]: row for row in rows}
    jobs = []
    for row in rows:
        path = row["runtimePath"]
        if not path.startswith(FOLDERS):
            continue
        stem = Path(path).stem
        body, _, state = stem.rpartition("_")
        if state not in REPAINTS + ADDITIVE or f"{Path(path).parent}/{body}.png" not in by_runtime:
            continue
        source = ROOT / row["sourcePath"]
        assert sha(source.read_bytes()) == row["sourceSha256"], path
        body_row = by_runtime[f"{Path(path).parent}/{body}.png"]
        assert sha((ROOT / body_row["runtimePath"]).read_bytes()) == body_row["sourceSha256"], f"{body}: the painting is as received"
        jobs.append((row, ROOT / body_row["runtimePath"], source, state))
    measured = [job for job in jobs if job[3] in REPAINTS]
    with Pool() as pool:
        results = dict(zip((id(job[0]) for job in measured), pool.map(measure, [(job[1], job[2]) for job in measured])))
    record = []
    for row, body, source, state in jobs:
        runtime = ROOT / row["runtimePath"]
        edits = row["manualEdits"].split(f"; {NOTE}")[0]
        result = results.get(id(row))
        if result is not None and accept(*result):
            identity, best, scale, dx, dy, _ = result
            data = registered(body, source, scale, dx, dy)
            runtime.write_bytes(data)
            row["manualEdits"] = f"{edits}; {NOTE}: scale {scale}, offset ({dx}, {dy}) canvas px, empty pixels from the painting (correlation {identity:.3f} -> {best:.3f})"
        else:
            shutil.copyfile(source, runtime)
            row["manualEdits"] = edits
        row["runtimeSha256"] = sha(runtime.read_bytes())
        decision = "additive (not measured)" if result is None else "registered" if accept(*result) else "kept as received"
        record.append({"runtimePath": row["runtimePath"], "state": state, "decision": decision,
                       **({} if result is None else {"identity": f"{result[0]:.3f}", "best": f"{result[1]:.3f}", "scale": result[2],
                                                     "dx": result[3], "dy": result[4], "cover": f"{result[5]:.2f}"}),
                       "sourceSha256": row["sourceSha256"], "runtimeSha256": row["runtimeSha256"]})
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    fields = ["runtimePath", "state", "decision", "identity", "best", "scale", "dx", "dy", "cover", "sourceSha256", "runtimeSha256"]
    with open(RECORD, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader(); writer.writerows(sorted(record, key=lambda item: item["runtimePath"]))
    print(len(record), "layers;", sum(item["decision"] == "registered" for item in record), "registered")


if __name__ == "__main__":
    main()
