from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "buildPhase4cEvidence.py"


class EvidenceModuleLoadError(RuntimeError):
    pass


def load_module():
    spec = importlib.util.spec_from_file_location("buildPhase4cEvidence", SCRIPT)
    if spec is None or spec.loader is None:
        raise EvidenceModuleLoadError("Could not import Phase 4C evidence builder")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class Phase4cEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_module()
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.asset_root = self.root / "assets"
        self.output_root = self.root / "evidence"
        self._write_assets()
        self.terrain = self.root / "default_zoom_terrain.png"
        Image.new("RGB", (1400, 760), (19, 83, 47)).save(self.terrain)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_assets(self) -> None:
        for category, names in self.module.ASSET_GROUPS.items():
            directory = self.asset_root / category
            directory.mkdir(parents=True, exist_ok=True)
            for index, name in enumerate(names):
                size = self.module.ASSET_SIZES[name]
                image = Image.new("RGBA", size, (0, 0, 0, 0))
                inset = 3 + index % 3
                colour = (60 + index * 7, 95 + index * 5, 130 + index * 3, 255)
                start = 0 if category == "terrain" else inset
                right = size[0] if category == "terrain" else size[0] - inset
                for y in range(start, size[1]):
                    for x in range(start, right):
                        image.putpixel((x, y), colour)
                image.save(directory / f"{name}.png")

    def test_contract_locks_outputs_groups_and_final_sizes(self) -> None:
        self.assertEqual(
            self.module.OUTPUT_NAMES,
            {
                "family": "asset_family_sheet.png",
                "village": "village_composite.png",
                "ledger": "phase4c_placement_ledger.json",
            },
        )
        self.assertEqual(
            self.module.ASSET_GROUPS["buildings"],
            (
                "house_l0",
                "house_l1",
                "house_l2",
                "house_l3",
                "mill",
                "barn",
                "well",
                "storehouse",
                "wheat_farm",
                "logging_camp",
                "sawmill",
            ),
        )
        self.assertEqual(len(self.module.ASSET_GROUPS["foliage"]), 6)
        self.assertEqual(len(self.module.ASSET_GROUPS["terrain"]), 5)
        self.assertEqual(self.module.ASSET_SIZES["house_l3"], (160, 192))
        self.assertEqual(self.module.ASSET_SIZES["tree_conifer_a"], (64, 96))
        self.assertEqual(self.module.ASSET_SIZES["grass"], (256, 256))

    def test_family_sheet_renders_sprites_at_source_size_and_tiles_terrain(self) -> None:
        ledger = self.module.build_evidence(self.asset_root, self.terrain, self.output_root)

        family = {entry["key"]: entry for entry in ledger["family"]}
        self.assertEqual(family["house_l3"]["sourceSize"], [160, 192])
        self.assertEqual(family["house_l3"]["renderedSize"], [160, 192])
        self.assertEqual(family["grass"]["sourceSize"], [256, 256])
        self.assertEqual(family["grass"]["renderedSize"], [512, 512])
        self.assertEqual(family["grass"]["tileGrid"], [2, 2])
        self.assertTrue((self.output_root / "asset_family_sheet.png").is_file())
        x, y, width, height = family["grass"]["bounds"]
        with Image.open(self.output_root / "asset_family_sheet.png") as sheet:
            self.assertEqual(sheet.getpixel((x + width - 1, y + height - 1)), (60, 95, 130))

    def test_village_uses_real_terrain_and_auditable_packed_anchors(self) -> None:
        ledger = self.module.build_evidence(self.asset_root, self.terrain, self.output_root)

        village = ledger["village"]
        placements = {entry["key"]: entry for entry in village["placements"]}
        required = set(self.module.REQUIRED_VILLAGE_OCCUPANTS)
        self.assertTrue(required.issubset(placements))
        house_x = [placements[f"house_l{level}"]["anchor"][0] for level in range(4)]
        self.assertEqual(house_x, sorted(house_x))
        for entry in placements.values():
            x, y, width, height = entry["canvasBounds"]
            anchor_x, anchor_y = entry["anchor"]
            self.assertEqual(anchor_x, x + width // 2)
            self.assertEqual(anchor_y, y + height)
        for pair in village["adjacency"]:
            self.assertGreaterEqual(pair["opaqueGap"], 0)
            self.assertLessEqual(pair["opaqueGap"], self.module.ADJACENCY_GAP)
        with Image.open(self.output_root / "village_composite.png") as composite:
            self.assertEqual(composite.getpixel((0, 0)), (19, 83, 47))
        self.assertEqual(village["terrainSource"]["name"], self.terrain.name)
        self.assertEqual(len(village["terrainSource"]["sha256"]), 64)

    def test_builder_writes_exact_outputs_and_ledger_matches_return_value(self) -> None:
        ledger = self.module.build_evidence(self.asset_root, self.terrain, self.output_root)

        self.assertEqual(
            {path.name for path in self.output_root.iterdir()},
            set(self.module.OUTPUT_NAMES.values()),
        )
        saved = json.loads((self.output_root / "phase4c_placement_ledger.json").read_text())
        self.assertEqual(saved, ledger)

    def test_missing_real_terrain_is_rejected(self) -> None:
        with self.assertRaises(FileNotFoundError):
            self.module.build_evidence(
                self.asset_root,
                self.root / "missing-default-zoom.png",
                self.output_root,
            )


if __name__ == "__main__":
    unittest.main()
