from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "buildPhase4bEvidence.py"


def load_module():
    spec = importlib.util.spec_from_file_location("buildPhase4bEvidence", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not import evidence builder")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class Phase4bEvidenceTest(unittest.TestCase):
    def test_default_picks_match_the_reviewed_release_set(self) -> None:
        module = load_module()
        self.assertEqual(
            module.DEFAULT_PICKS,
            {"house": "house_03", "mill": "mill_02", "granary": "granary_08"},
        )

    def test_no_outline_variant_removes_only_soft_outline_pixels(self) -> None:
        module = load_module()
        image = Image.new("RGBA", (2, 1))
        image.putdata(((58, 46, 31, 179), (120, 90, 60, 255)))
        result = module.remove_soft_outline(image)
        self.assertEqual(result.getpixel((0, 0)), (58, 46, 31, 0))
        self.assertEqual(result.getpixel((1, 0)), (120, 90, 60, 255))


if __name__ == "__main__":
    unittest.main()
