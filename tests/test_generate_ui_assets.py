from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generateUiAssets.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("generateUiAssets", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load generateUiAssets.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class TargetFilterContractTest(unittest.TestCase):
    def test_release_selection_points_to_approved_guided_candidates(self) -> None:
        module = load_generator()

        self.assertEqual(module.SELECTED["scroll_frame"], 22)
        self.assertEqual(module.SELECTED["wood_console"], 10)

    def test_comfy_output_path_stays_inside_the_configured_png_root(self) -> None:
        """Given a normal Comfy result, its resolved PNG remains under COMFY_OUTPUT."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            module.COMFY_OUTPUT = Path(raw_tmp) / "output"
            expected = (module.COMFY_OUTPUT / "phase2_ui" / "candidate.png").resolve()

            self.assertEqual(
                module.contained_output_path("phase2_ui", "candidate.png"),
                expected,
            )

    def test_comfy_output_path_rejects_escape_and_non_png_results(self) -> None:
        """Given an untrusted API path, traversal, absolute paths, and non-PNG files fail closed."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            module.COMFY_OUTPUT = Path(raw_tmp) / "output"
            for subfolder, filename in (
                ("../../outside", "candidate.png"),
                ("", "/tmp/outside.png"),
                ("phase2_ui", "candidate.txt"),
            ):
                with self.subTest(subfolder=subfolder, filename=filename):
                    with self.assertRaisesRegex(RuntimeError, "Comfy output path"):
                        module.contained_output_path(subfolder, filename)

    def test_generate_queues_only_targeted_assets_when_filter_is_supplied(self) -> None:
        """Given an asset filter, when generating, then only those assets are queued."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(source_image)
            queued_assets: list[str] = []
            contacted_assets: list[str] = []

            def fake_queue(prompt: dict[str, dict[str, object]]) -> str:
                save_inputs = prompt["9"]["inputs"]
                prefix = str(save_inputs["filename_prefix"])
                queued_assets.append(prefix.split("/")[1])
                return f"prompt-{len(queued_assets)}"

            def fake_wait(prompt_id: str) -> list[Path]:
                return [source_image]

            def fake_contact_sheet(spec, paths: list[Path]) -> None:
                contacted_assets.append(spec.key)

            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = fake_queue
            module.wait_for_outputs = fake_wait
            module.make_contact_sheet = fake_contact_sheet

            module.generate(frozenset({"scroll_frame", "wood_console"}))

            self.assertEqual(
                queued_assets,
                [
                    "scroll_frame",
                    "scroll_frame",
                    "scroll_frame",
                    "wood_console",
                    "wood_console",
                    "wood_console",
                ],
            )
            self.assertEqual(contacted_assets, ["scroll_frame", "wood_console"])

    def test_prepare_selected_writes_only_targeted_assets_when_filter_is_supplied(self) -> None:
        """Given an asset filter, when preparing selected, then only those files are written."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            module.STAGE_DIR = tmp / "stage"
            module.BEFORE_DIR = tmp / "before"
            for spec in module.ASSETS:
                candidate_dir = module.STAGE_DIR / spec.key
                candidate_dir.mkdir(parents=True)
                Image.new("RGBA", (32, 32), (180, 120, 70, 255)).save(candidate_dir / "candidate_1_seed_1.png")

            module.prepare_selected(
                {"scroll_frame": 1, "wood_console": 1},
                frozenset({"scroll_frame", "wood_console"}),
            )

            self.assertEqual(
                sorted(path.name for path in module.BEFORE_DIR.glob("*.png")),
                ["scroll_frame.png", "wood_console.png"],
            )


    def test_generate_without_filter_preserves_all_asset_default(self) -> None:
        """Given no asset filter, when generating, then every configured asset is queued."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(source_image)
            queued_assets: list[str] = []

            def fake_queue(prompt: dict[str, dict[str, object]]) -> str:
                prefix = str(prompt["9"]["inputs"]["filename_prefix"])
                queued_assets.append(prefix.split("/")[1])
                return f"prompt-{len(queued_assets)}"

            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = fake_queue
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths: None

            module.generate()

            self.assertEqual(sorted(set(queued_assets)), sorted(spec.key for spec in module.ASSETS))
            self.assertEqual(len(queued_assets), len(module.ASSETS) * 3)

    def test_generate_manifest_omits_prompt_ids_and_absolute_candidate_paths(self) -> None:
        """Given generated candidates, when writing a manifest, then it contains portable non-secret paths only."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(source_image)

            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = lambda _prompt: "secret-prompt-id"
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths: None

            module.generate(frozenset({"scroll_frame"}))

            manifest_text = (module.STAGE_DIR / "manifest.json").read_text(encoding="utf-8")
            self.assertNotIn("prompt_id", manifest_text)
            self.assertNotIn("secret-prompt-id", manifest_text)
            manifest = __import__("json").loads(manifest_text)
            candidate_path = manifest["assets"][0]["candidates"][0]["path"]
            self.assertFalse(Path(candidate_path).is_absolute())
            self.assertTrue(candidate_path.startswith("scroll_frame/"))


    def test_refinement_targets_scroll_and_wood_only_with_current_indices(self) -> None:
        """Given a refinement target filter, when generating refinements, then only selected assets are queued as current indices."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(source_image)
            queued_prefixes: list[str] = []

            def fake_queue(prompt: dict[str, dict[str, object]]) -> str:
                prefix = str(prompt["9"]["inputs"]["filename_prefix"])
                queued_prefixes.append(prefix)
                return f"prompt-{len(queued_prefixes)}"

            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = fake_queue
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths: None

            module.generate_refinements(frozenset({"scroll_frame", "wood_console"}))

            self.assertEqual(len(queued_prefixes), 6)
            self.assertEqual([prefix.split("/")[1] for prefix in queued_prefixes], ["scroll_frame"] * 3 + ["wood_console"] * 3)
            for asset in ("scroll_frame", "wood_console"):
                produced = sorted((module.STAGE_DIR / asset).glob("candidate_*_seed_*.png"))
                self.assertEqual([path.name.split("_")[1] for path in produced], ["7", "8", "9"])

    def test_refinement_manifest_omits_prompt_ids_and_absolute_candidate_paths(self) -> None:
        """Given refinement candidates, when writing a manifest, then prompt ids and machine paths are absent."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(source_image)

            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = lambda _prompt: "secret-refinement-prompt"
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths: None

            module.generate_refinements(frozenset({"wood_console"}))

            manifest_text = (module.STAGE_DIR / "refinement_manifest.json").read_text(encoding="utf-8")
            self.assertNotIn("prompt_id", manifest_text)
            self.assertNotIn("secret-refinement-prompt", manifest_text)
            self.assertNotIn(str(tmp), manifest_text)
            manifest = __import__("json").loads(manifest_text)
            candidate_path = manifest["assets"][0]["candidates"][0]["path"]
            self.assertFalse(Path(candidate_path).is_absolute())
            self.assertTrue(candidate_path.startswith("wood_console/"))

    def test_wood_refinement_bypasses_common_prompt_gold_language(self) -> None:
        """Given the Phase 2.5 wood refinement, when building the workflow, then common gold language is excluded."""
        module = load_generator()
        wood = next(spec for spec in module.ASSETS if spec.key == "wood_console")
        refinement = module.REFINEMENTS["wood_console"]

        workflow = module.workflow_prompt(
            wood,
            refinement["seeds"][0],
            "phase2_ui/wood_console/probe",
            str(refinement["prompt"]),
            str(refinement["negative"]),
            include_common=refinement["include_common"],
        )

        positive = str(workflow["3"]["inputs"]["text"]).lower()
        negative = str(workflow["4"]["inputs"]["text"]).lower()
        self.assertNotIn("gold", positive)
        self.assertIn("exactly three", positive)
        self.assertIn("12 to 1", positive)
        self.assertIn("two wells", negative)
        self.assertIn("horizontal bands", negative)
        self.assertIn("gold", negative)


    def test_prepare_selected_preserves_generated_wood_pixels_at_release_size(self) -> None:
        """Given a release-sized wood candidate, preparation must not procedurally redraw it."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            module.STAGE_DIR = tmp / "stage"
            module.BEFORE_DIR = tmp / "before"
            candidate_dir = module.STAGE_DIR / "wood_console"
            candidate_dir.mkdir(parents=True)
            source = Image.new("RGBA", (1920, 160), (138, 111, 78, 255))
            for x in range(source.width):
                source.putpixel((x, 80), (x % 251, (x * 3) % 251, (x * 7) % 251, 255))
            source.save(candidate_dir / "candidate_1_seed_1.png")

            module.prepare_selected({"wood_console": 1}, frozenset({"wood_console"}))

            prepared = Image.open(module.BEFORE_DIR / "wood_console.png").convert("RGBA")
            self.assertEqual(prepared.size, (1920, 160))
            self.assertEqual(prepared.tobytes(), source.tobytes())

    def test_prepare_selected_only_keys_generated_scroll_cyan_to_alpha(self) -> None:
        """Given a guided scroll candidate, preparation preserves its art and keys cyan only."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            module.STAGE_DIR = tmp / "stage"
            module.BEFORE_DIR = tmp / "before"
            candidate_dir = module.STAGE_DIR / "scroll_frame"
            candidate_dir.mkdir(parents=True)
            source = module.build_scroll_frame_guide().convert("RGBA")
            source.save(candidate_dir / "candidate_1_seed_1.png")

            module.prepare_selected({"scroll_frame": 1}, frozenset({"scroll_frame"}))

            prepared = Image.open(module.BEFORE_DIR / "scroll_frame.png").convert("RGBA")
            self.assertEqual(prepared.size, (512, 512))
            self.assertEqual(prepared.getpixel((256, 256))[3], 0)
            self.assertEqual(prepared.getpixel((256, 8))[3], 0)
            self.assertGreater(prepared.getpixel((256, 68))[3], 0)
            self.assertEqual(prepared.getpixel((256, 68))[:3], source.getpixel((256, 68))[:3])


    def test_wood_guide_has_exactly_three_equal_dark_wells(self) -> None:
        module = load_generator(); image = module.build_wood_console_guide(); pixels = image.load()
        dark_runs = []
        inside = False
        start = 0
        for x in range(image.width):
            dark = pixels[x, 80] == module.DARK_WELL_RGB
            if dark and not inside:
                inside = True
                start = x
            if inside and (not dark or x == image.width - 1):
                end = x if not dark else x + 1
                if end - start > 200:
                    dark_runs.append((start, end))
                inside = False
        self.assertEqual(image.size, (1920, 160)); self.assertEqual(len(dark_runs), 3)

    def test_scroll_guide_has_cyan_center_and_four_percent_perimeter(self) -> None:
        module = load_generator(); image = module.build_scroll_frame_guide(); pixels = image.load(); edge = 21
        self.assertEqual(image.size, (512, 512)); self.assertEqual(pixels[256, 256], module.CYAN_RGB)
        for y in range(image.height):
            for x in range(image.width):
                if x < edge or y < edge or x >= image.width - edge or y >= image.height - edge:
                    self.assertEqual(pixels[x, y], module.CYAN_RGB)
        central = [pixels[x, y] for y in range(128, 384) for x in range(128, 384)]
        self.assertGreater(sum(pixel == module.CYAN_RGB for pixel in central) / len(central), 0.7)

    def test_guided_workflow_uses_masks_and_expected_denoise(self) -> None:
        module = load_generator(); wood = next(spec for spec in module.ASSETS if spec.key == "wood_console"); scroll = next(spec for spec in module.ASSETS if spec.key == "scroll_frame")
        wood_workflow = module.guided_workflow_prompt(wood, 52024421, 0.28, "phase2_ui/wood_console/probe", "wood.png")
        scroll_workflow = module.guided_workflow_prompt(scroll, 52018411, 0.12, "phase2_ui/scroll_frame/probe", "scroll.png")
        self.assertEqual(wood_workflow["7"]["class_type"], "VAEEncode"); self.assertEqual(scroll_workflow["8"]["class_type"], "VAEEncodeForInpaint")
        self.assertEqual(scroll_workflow["7"]["class_type"], "InvertMask"); self.assertEqual(wood_workflow["13"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(scroll_workflow["13"]["class_type"], "ImageCompositeMasked"); self.assertEqual(wood_workflow["9"]["inputs"]["denoise"], 0.28); self.assertEqual(scroll_workflow["9"]["inputs"]["denoise"], 0.12)
        self.assertEqual(wood_workflow["2"]["inputs"]["strength_model"], 0.45)
        self.assertEqual(scroll_workflow["2"]["inputs"]["strength_model"], 0.25)
        self.assertFalse(wood_workflow["11"]["inputs"]["copy_hue"])
        self.assertFalse(wood_workflow["11"]["inputs"]["copy_sat"])
        self.assertTrue(scroll_workflow["11"]["inputs"]["copy_hue"])
        self.assertTrue(scroll_workflow["11"]["inputs"]["copy_sat"])
        self.assertEqual(scroll_workflow["15"]["class_type"], "ImageColorToMask")
        self.assertEqual(scroll_workflow["16"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(scroll_workflow["17"]["class_type"], "ImageColorToMask")
        self.assertEqual(scroll_workflow["18"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(scroll_workflow["14"]["inputs"]["images"], ["31", 0])
        self.assertNotIn("15", wood_workflow)

    def test_guided_scroll_restores_illuminated_accent_masks_after_light_and_dark(self) -> None:
        """Given generated scroll pixels, guide accent masks are restored before saving."""
        module = load_generator()
        scroll = next(spec for spec in module.ASSETS if spec.key == "scroll_frame")

        workflow = module.guided_workflow_prompt(scroll, 52018411, 0.12, "phase2_ui/scroll_frame/probe", "scroll.png")

        self.assertEqual(workflow["26"]["class_type"], "ImageColorToMask")
        self.assertEqual(workflow["26"]["inputs"]["color"], module.rgb_to_mask_int(module.SCROLL_GOLD_RGB))
        self.assertEqual(workflow["27"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(workflow["27"]["inputs"]["destination"], ["18", 0])
        self.assertEqual(workflow["28"]["class_type"], "ImageColorToMask")
        self.assertEqual(workflow["28"]["inputs"]["color"], module.rgb_to_mask_int(module.SCROLL_ULTRAMARINE_RGB))
        self.assertEqual(workflow["29"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(workflow["29"]["inputs"]["destination"], ["27", 0])
        self.assertEqual(workflow["30"]["class_type"], "ImageColorToMask")
        self.assertEqual(workflow["30"]["inputs"]["color"], module.rgb_to_mask_int(module.SCROLL_VERMILION_RGB))
        self.assertEqual(workflow["31"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(workflow["31"]["inputs"]["destination"], ["29", 0])
        self.assertEqual(workflow["14"]["inputs"]["images"], ["31", 0])

    def test_guided_workflow_routes_building_references_through_ipadapter(self) -> None:
        """Given accepted building art, the workflow wires it as the style reference batch."""
        module = load_generator()
        scroll = next(spec for spec in module.ASSETS if spec.key == "scroll_frame")

        workflow = module.guided_workflow_prompt(
            scroll,
            52018411,
            0.12,
            "phase2_ui/scroll_frame/probe",
            "scroll.png",
            ("phase4c_ref_house.png", "phase4c_ref_mill.png", "phase4c_ref_granary.png"),
        )

        classes = [node["class_type"] for node in workflow.values()]
        self.assertIn("IPAdapterUnifiedLoader", classes)
        self.assertIn("IPAdapterAdvanced", classes)
        self.assertEqual(classes.count("ImageBatch"), 2)
        self.assertEqual(workflow["21"]["inputs"]["image"], "phase4c_ref_house.png")
        self.assertEqual(workflow["22"]["inputs"]["image"], "phase4c_ref_mill.png")
        self.assertEqual(workflow["23"]["inputs"]["image"], "phase4c_ref_granary.png")
        adapter = next(node for node in workflow.values() if node["class_type"] == "IPAdapterAdvanced")
        sampler = workflow["9"]
        self.assertEqual(adapter["inputs"]["image"], ["25", 0])
        self.assertEqual(adapter["inputs"]["weight_type"], "style transfer precise")
        self.assertEqual(adapter["inputs"]["combine_embeds"], "average")
        self.assertEqual(sampler["inputs"]["model"], ["20", 0])
        self.assertEqual(workflow["5"]["inputs"]["image"], "scroll.png")
        self.assertEqual(workflow["6"]["inputs"]["image"], ["5", 0])

    def test_guided_scroll_prompt_restores_illuminated_accent_language(self) -> None:
        """Given Phase 4F scroll guidance, the prompt restores accents without banning them."""
        module = load_generator()
        scroll = next(spec for spec in module.ASSETS if spec.key == "scroll_frame")

        workflow = module.guided_workflow_prompt(scroll, 52018411, 0.12, "phase2_ui/scroll_frame/probe", "scroll.png")

        positive = str(workflow["3"]["inputs"]["text"]).lower()
        negative = str(workflow["4"]["inputs"]["text"]).lower()
        for required in ("restrained gold", "ultramarine", "vermilion", "illuminated", "medallion", "border"):
            self.assertIn(required, positive)
        for allowed_accent in ("gold", "blue", "ultramarine", "vermilion"):
            self.assertNotIn(allowed_accent, negative)
        self.assertIn("cyan center", positive)
        self.assertIn("cyan outside", positive)

    def test_scroll_guide_contains_restrained_gold_blue_and_red_accents(self) -> None:
        """Given the guided scroll frame, accent swatches make the reference explicit."""
        module = load_generator()

        image = module.build_scroll_frame_guide()
        colors = image.getcolors(maxcolors=image.width * image.height)
        self.assertIsNotNone(colors)
        assert colors is not None
        opaque_colors = {color for _count, color in colors if color != module.CYAN_RGB}

        self.assertIn(module.SCROLL_GOLD_RGB, opaque_colors)
        self.assertIn(module.SCROLL_ULTRAMARINE_RGB, opaque_colors)
        self.assertIn(module.SCROLL_VERMILION_RGB, opaque_colors)

    def test_guided_manifest_documents_building_style_reference_mode(self) -> None:
        """Given UI assets with exact masks, manifest metadata records the building references."""
        module = load_generator()

        guide = module.build_scroll_frame_guide()
        metadata = module.guide_metadata(
            "scroll_frame",
            guide,
            52018411,
            0.12,
            "phase2_5_scroll_frame_guide.png",
            "scroll_frame/candidate_22_seed_52018411.png",
            ("phase4c_ref_house.png", "phase4c_ref_mill.png", "phase4c_ref_granary.png"),
        )

        self.assertEqual(metadata["referenceMode"], module.BUILDING_STYLE_REFERENCE_MODE)
        self.assertEqual(
            metadata["buildingReferencePaths"],
            [path.as_posix() for path in module.BUILDING_REFERENCE_PATHS],
        )

    def test_generate_guided_uploads_building_references_once(self) -> None:
        """Given guided generation, accepted building references are uploaded before queueing."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            repo_root = tmp / "repo"
            for relative in module.BUILDING_REFERENCE_PATHS:
                path = repo_root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                Image.new("RGBA", (16, 16), (180, 120, 70, 255)).save(path)
            source_image = tmp / "source.png"
            Image.new("RGB", (16, 16), (180, 120, 70)).save(source_image)
            observed_reference_batches: list[tuple[str, str, str]] = []

            module.REPO_ROOT = repo_root
            module.STAGE_DIR = tmp / "stage"
            module.CONTACT_DIR = tmp / "contact"
            module.COMFY_INPUT_DIR = tmp / "input"
            module.queue_prompt = lambda prompt: observed_reference_batches.append((
                str(prompt["21"]["inputs"]["image"]),
                str(prompt["22"]["inputs"]["image"]),
                str(prompt["23"]["inputs"]["image"]),
            )) or "guided-with-building-refs"
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths, sheet_name="contact_sheet.png": None

            module.generate_guided(frozenset({"scroll_frame"}))

            self.assertEqual(
                observed_reference_batches,
                [module.BUILDING_REFERENCE_NAMES] * 3,
            )
            self.assertEqual(
                sorted(path.name for path in module.COMFY_INPUT_DIR.glob("phase4c_ref_*.png")),
                sorted(module.BUILDING_REFERENCE_NAMES),
            )

    def test_wood_guide_preserves_three_recesses_with_grain_and_top_highlight(self) -> None:
        """Given the guided wood console, material detail does not add recesses."""
        module = load_generator()

        image = module.build_wood_console_guide()
        pixels = image.load()
        dark_runs = []
        inside = False
        start = 0
        for x in range(image.width):
            dark = pixels[x, 80] == module.DARK_WELL_RGB
            if dark and not inside:
                inside = True
                start = x
            if inside and (not dark or x == image.width - 1):
                end = x if not dark else x + 1
                if end - start > 200:
                    dark_runs.append((start, end))
                inside = False
        top_edge_values = [pixels[x, 20] for x in range(80, 1840, 40)]
        plank_values = [pixels[x, 18] for x in range(80, 1840, 40)]

        self.assertEqual(len(dark_runs), 3)
        self.assertGreater(len(set(plank_values)), 3)
        self.assertGreater(sum(sum(pixel) for pixel in top_edge_values) / len(top_edge_values), sum(module.WOOD_BASE_RGB))

    def test_guided_generation_target_filter_and_manifest_hygiene(self) -> None:
        module = load_generator()
        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp); source_image = tmp / "source.png"; Image.new("RGB", (16, 16), (180, 120, 70)).save(source_image); queued_assets: list[str] = []
            module.STAGE_DIR = tmp / "stage"; module.CONTACT_DIR = tmp / "contact"; module.COMFY_INPUT_DIR = tmp / "input"
            module.queue_prompt = lambda prompt: queued_assets.append(str(prompt["14"]["inputs"]["filename_prefix"]).split("/")[1]) or "guided-secret"
            module.wait_for_outputs = lambda _prompt_id: [source_image]
            module.make_contact_sheet = lambda _spec, _paths, sheet_name="contact_sheet.png": None
            module.generate_guided(frozenset({"wood_console"}))
            self.assertEqual(queued_assets, ["wood_console", "wood_console", "wood_console"])
            text = (module.STAGE_DIR / "guided_manifest.json").read_text(encoding="utf-8")
            self.assertNotIn("prompt_id", text); self.assertNotIn("guided-secret", text); self.assertNotIn(str(tmp), text)
            manifest = __import__("json").loads(text); candidate = manifest["assets"][0]["candidates"][0]
            self.assertEqual(candidate["guide"], "phase2_5_wood_console_guide.png"); self.assertTrue(candidate["candidate"].startswith("wood_console/")); self.assertFalse(Path(candidate["candidate"]).is_absolute())

    def test_guided_scroll_uses_current_indices_and_current_only_sheet(self) -> None:
        module = load_generator()
        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source = tmp / "source.png"
            Image.new("RGB", (512, 512), module.CYAN_RGB).save(source)
            observed_sheets: list[tuple[list[str], str]] = []
            module.STAGE_DIR = tmp / "stage"; module.CONTACT_DIR = tmp / "contact"; module.COMFY_INPUT_DIR = tmp / "input"
            module.queue_prompt = lambda _prompt: "guided-scroll"
            module.wait_for_outputs = lambda _prompt_id: [source]
            module.make_contact_sheet = lambda _spec, paths, sheet_name="contact_sheet.png": observed_sheets.append(([path.name for path in paths], sheet_name))

            module.generate_guided(frozenset({"scroll_frame"}))

            produced = sorted((module.STAGE_DIR / "scroll_frame").glob("candidate_*.png"))
            self.assertEqual([path.name.split("_")[1] for path in produced], ["22", "23", "24"])
            self.assertEqual(
                [path.name.split("_")[3].removesuffix(".png") for path in produced],
                ["52018411", "52018412", "52018413"],
            )
            self.assertEqual(observed_sheets, [([path.name for path in produced], "guided_22_24_contact_sheet.png")])

    def test_base_generation_contact_sheet_excludes_stale_candidates(self) -> None:
        module = load_generator()
        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source = tmp / "source.png"
            Image.new("RGB", (16, 16), (180, 120, 70)).save(source)
            asset_dir = tmp / "stage" / "scroll_frame"
            asset_dir.mkdir(parents=True)
            Image.new("RGB", (16, 16), (1, 2, 3)).save(asset_dir / "candidate_99_seed_99.png")
            observed: list[str] = []
            module.STAGE_DIR = tmp / "stage"; module.CONTACT_DIR = tmp / "contact"
            module.queue_prompt = lambda _prompt: "current"
            module.wait_for_outputs = lambda _prompt_id: [source]
            module.make_contact_sheet = lambda _spec, paths: observed.extend(path.name for path in paths)

            module.generate(frozenset({"scroll_frame"}))

            self.assertEqual(observed, [
                "candidate_1_seed_52010411.png",
                "candidate_2_seed_52010412.png",
                "candidate_3_seed_52010413.png",
            ])


if __name__ == "__main__":
    unittest.main()
