"""UI-AUDIT-1: measure each frame's content-safe inset from its PNG (the numbers behind SAFE in scripts/frameTokens.ts).

A 9-slice inset is the size of the corner that does not stretch, not the depth of the painted edge. This reads the art:
- A pixel is "painted" (frame, not reading field) when it is transparent (alpha < 200) or differs from the interior's
  median colour by more than 24 in any channel. A frame whose centre is a transparent window (the snapshot maps) is read
  the other way round: an opaque pixel is frame.
- Along each side's plain middle (between the corner slices; the middle third for a painting) a depth row counts as
  painted when at least half its pixels are. The side's depth is the end of the painted run from the edge, gaps of up
  to 3 px allowed (a double rule with a parchment line between is one edge).
- A corner ornament matters only where it reaches past the side depths plus the 8 CSS px gap (`--frame-gap`, in source
  px at the kind's draw scale): then the cheaper side is raised so the content box clears it (a tie raises the pair of
  sides across the art's longer axis).
Run: python3 scripts/measureFrameSafe.py        (prints `kind: t r b l` in source px, and the corners that raised a side)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GAP_CSS = 8
TOLERANCE = 24
MAX_GAP = 3

# kind: (art under public/assets, 9-slice t r b l or None for a painting, CSS px per source px)
KINDS: dict[str, tuple[str, tuple[int, int, int, int] | None, float]] = {
    "light": ("ui-p0/frame_panel_light.png", (32, 32, 32, 32), 0.5),
    "slot": ("ui-p0/frame_panel_light.png", (32, 32, 32, 32), 10 / 32),
    "dark": ("ui-p0/frame_panel_dark.png", (24, 24, 24, 24), 0.5),
    "objective": ("ui-p0/frame_objective_normal.png", (32, 32, 32, 32), 0.5),
    "objective-complete": ("ui-p0/frame_objective_complete.png", (32, 32, 32, 32), 0.5),
    "objective-warn": ("ui-p0/frame_objective_warn.png", (32, 32, 32, 32), 0.5),
    "advisor": ("ui-p0/frame_advisor_normal.png", (24, 24, 24, 24), 0.5),
    "advisor-warn": ("ui-p0/frame_advisor_warn.png", (24, 24, 24, 24), 0.5),
    "modal": ("ui-p0/frame_modal.png", (32, 32, 32, 32), 0.5),
    "tooltip": ("ui-p0/frame_tooltip.png", (12, 12, 12, 12), 0.5),
    "toast": ("ui-p0/toast_small.png", (24, 24, 24, 24), 0.5),
    "strip-top": ("ui-p0/frame_hud_strip_top.png", (24, 24, 24, 24), 0.5),
    "strip-bottom": ("ui-p0/frame_hud_strip_bottom.png", (24, 24, 24, 24), 0.5),
    "banner": ("ui-p0/banner_unlock.png", (48, 48, 48, 48), 0.5),
    "button-primary": ("ui-p0/button_primary_base.png", (12, 12, 12, 12), 0.5),
    "button-secondary": ("ui-p0/button_secondary_base.png", (12, 12, 12, 12), 0.5),
    "button-icon": ("ui-p0/button_icon_square_base.png", (10, 10, 10, 10), 0.5),
    "button-tab": ("ui-p0/tab_build_base.png", (12, 12, 12, 12), 0.5),
    "button-chip": ("ui-p0/chip_condition_base.png", (8, 8, 8, 8), 0.5),
    "ledger": ("wave19/cards/frame_record_ledger.png", (30, 40, 40, 32), 0.7),
    "record-decision": ("wave19/cards/frame_record_decision.png", (90, 32, 55, 50), 0.7),
    "record-era": ("wave19/cards/frame_record_era.png", (38, 30, 30, 30), 0.7),
    "record-event": ("wave19/cards/frame_record_event.png", (64, 64, 44, 28), 0.7),
    "record-ledger": ("wave19/cards/frame_record_ledger.png", (30, 40, 40, 32), 0.7),
    "record-milestone": ("wave19/cards/frame_record_milestone.png", (30, 30, 30, 30), 0.7),
    "record-person": ("wave19/cards/frame_record_person.png", (96, 28, 32, 90), 0.7),
    "decision": ("wave19/timeline/frame_decision_compare.png", (24, 24, 24, 24), 0.96),
    "rights": ("wave14/ui-frames/frame_rights_register-v1.png", (24, 24, 24, 24), 1),
    "tree-banner": ("wave25/tree/tree_lineage_banner.png", (10, 24, 10, 24), 1),
    "tree-generation": ("wave25/tree/tree_generation_label.png", (8, 10, 8, 10), 1),
    "tree-node": ("wave25/tree/tree_node_frame.png", (12, 12, 12, 12), 0.6),
    "tree-node-selected": ("wave25/tree/tree_node_frame_selected.png", (12, 12, 12, 12), 0.6),
    "tree-node-deceased": ("wave25/tree/tree_node_frame_deceased.png", (20, 20, 20, 20), 0.6),
    "person-card": ("wave14/ui-frames/frame_person_card-v1.png", None, 1.5),
    "biography": ("wave19/pages/frame_biography.png", None, 1),
    "faction-page": ("wave19/pages/frame_faction_page.png", None, 1),
    "pause-badge": ("wave8/time/pause_badge.png", None, 1),
}


def painted_mask(rgba: np.ndarray) -> np.ndarray:
    height, width, _ = rgba.shape
    core = rgba[height // 3:2 * height // 3, width // 3:2 * width // 3]
    if core[..., 3].mean() < 128:
        return rgba[..., 3] >= 128
    median = np.median(core[..., :3].reshape(-1, 3), axis=0)
    return (rgba[..., 3] < 200) | (np.abs(rgba[..., :3] - median).max(axis=2) > TOLERANCE)


def run_depth(profile: np.ndarray) -> int:
    depth, gap = 0, 0
    for index, fraction in enumerate(profile):
        if fraction >= 0.5:
            depth, gap = index + 1, 0
        else:
            gap += 1
            if gap > MAX_GAP:
                break
    return depth


def measure(path: str, nine: tuple[int, int, int, int] | None, scale: float) -> tuple[list[int], list[str]]:
    rgba = np.asarray(Image.open(ROOT / "public/assets" / path).convert("RGBA")).astype(int)
    height, width, _ = rgba.shape
    painted = painted_mask(rgba)
    top, right, bottom, left = nine if nine is not None else (height // 3, width // 3, height // 3, width // 3)
    x0, x1 = (left, width - right) if width - right - left >= 8 else (width // 3, 2 * width // 3)
    y0, y1 = (top, height - bottom) if height - bottom - top >= 8 else (height // 3, 2 * height // 3)
    half_h, half_w = height // 2, width // 2
    depth = [run_depth(painted[:half_h, x0:x1].mean(axis=1)), run_depth(painted[y0:y1, ::-1][:, :half_w].mean(axis=0)),
             run_depth(painted[::-1][:half_h, x0:x1].mean(axis=1)), run_depth(painted[y0:y1, :half_w].mean(axis=0))]
    notes: list[str] = []
    if nine is None:
        return depth, notes
    gap = GAP_CSS / scale
    corners = {"tl": (slice(0, top), slice(0, left), 0, 3), "tr": (slice(0, top), slice(width - right, width), 0, 1),
               "bl": (slice(height - bottom, height), slice(0, left), 2, 3), "br": (slice(height - bottom, height), slice(width - right, width), 2, 1)}
    for name, (rows, cols, vertical, horizontal) in corners.items():
        ys, xs = np.nonzero(painted[rows, cols]); ys = ys + rows.start; xs = xs + cols.start
        inside = ((ys >= depth[0] + gap) & (ys < height - depth[2] - gap) & (xs >= depth[3] + gap) & (xs < width - depth[1] - gap))
        if inside.sum() <= 3:
            continue
        reach_y = int(ys[inside].max() + 1 if vertical == 0 else height - ys[inside].min())
        reach_x = int(xs[inside].max() + 1 if horizontal == 3 else width - xs[inside].min())
        raise_y, raise_x = reach_y - gap - depth[vertical], reach_x - gap - depth[horizontal]
        pick_vertical = raise_y < raise_x or (raise_y == raise_x and height >= width)
        side = vertical if pick_vertical else horizontal
        depth[side] = max(depth[side], int(np.ceil((reach_y if pick_vertical else reach_x) - gap)))
        notes.append(f"{name} ornament to x{reach_x} y{reach_y} raised {('t' if vertical == 0 else 'b') if pick_vertical else ('l' if horizontal == 3 else 'r')}")
    return depth, notes


def main() -> None:
    wanted = sys.argv[1:]
    for kind, (path, nine, scale) in KINDS.items():
        if wanted and kind not in wanted:
            continue
        depth, notes = measure(path, nine, scale)
        print(f"{kind}: {' '.join(str(value) for value in depth)}" + (f"   ({'; '.join(notes)})" if notes else ""))


if __name__ == "__main__":
    main()
