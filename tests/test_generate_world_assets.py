from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generateWorldAssets.py"


class GeneratorLoadError(RuntimeError):
    pass


def load_generator():
    spec = importlib.util.spec_from_file_location("generateWorldAssets", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise GeneratorLoadError("Could not load generateWorldAssets.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class WorldAssetGeneratorContractTest(unittest.TestCase):
    def test_catalog_has_exact_59_jobs_and_locked_geometry(self) -> None:
        module = load_generator()

        buildings = [job for job in module.JOBS if job.category.value == "building"]
        foliage = [job for job in module.JOBS if job.category.value == "foliage"]
        terrain = [job for job in module.JOBS if job.category.value == "terrain"]
        self.assertEqual(len(module.JOBS), 59)
        self.assertEqual(len(buildings), 48)
        self.assertEqual(len(foliage), 6)
        self.assertEqual(len(terrain), 5)
        self.assertEqual(
            sorted({job.key for job in buildings}),
            ["house_l1", "house_l2", "house_l3", "logging_camp", "sawmill", "storehouse", "well", "wheat_farm"],
        )
        for key in {job.key for job in buildings}:
            seeds = [job.seed for job in buildings if job.key == key]
            self.assertEqual(len(seeds), 6)
            self.assertEqual(len(set(seeds)), 6)
        expected_clauses = {
            "house_l1": "a slightly larger timber-framed cottage, two windows, taller thatch roof, small chimney",
            "house_l2": "a two-storey timber-framed townhouse, plaster infill, shingle roof, upper-floor windows",
            "house_l3": "a large stone manor house, slate roof, a short square tower at one end, arched doorway",
            "well": "a low circular stone wellhead with a small timber roof on two posts, rope and bucket",
            "storehouse": "a rectangular open-fronted timber warehouse, plank walls, shallow shingle roof, stacked crates visible inside",
            "wheat_farm": "a farmyard, not a building — a small timber hut at one corner of a ploughed field, furrows running across the plot",
            "logging_camp": "an open-sided timber shelter with a stack of cut logs beside it, sawhorse, wood chips on the ground",
            "sawmill": "a low timber workshop with a large horizontal saw frame under a lean-to roof, plank stacks outside",
        }
        for key, clause in expected_clauses.items():
            matching = [job for job in buildings if job.key == key]
            self.assertEqual({job.geometry for job in matching}, {clause})
        for job in buildings:
            self.assertNotRegex(job.geometry.lower(), r"\b(asset|icon|sprite|game function)\b")

    def test_canvas_settings_models_and_reference_family_are_fixed(self) -> None:
        module = load_generator()

        self.assertEqual(module.CANVAS_SIZE, (1024, 1024))
        self.assertEqual(module.CHECKPOINT, "sd_xl_base_1.0.safetensors")
        self.assertEqual(module.IPADAPTER_PRESET, "PLUS (high strength)")
        self.assertEqual(module.IPADAPTER_MODEL, "ip-adapter-plus_sdxl_vit-h.safetensors")
        self.assertEqual(module.CLIP_VISION_MODEL, "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors")
        self.assertEqual(
            module.REFERENCE_PATHS,
            (
                Path("public/assets/buildings/candidates_v2/house_03.png"),
                Path("public/assets/buildings/candidates_v2/mill_02.png"),
                Path("public/assets/buildings/candidates_v2/granary_08.png"),
            ),
        )

    def test_workflow_routes_the_reference_atlas_through_ipadapter(self) -> None:
        module = load_generator()
        job = module.JOBS[0]

        references = ("phase4c_ref_house.png", "phase4c_ref_mill.png", "phase4c_ref_granary.png")
        workflow = module.workflow_prompt(job, references, "phase4c_house_l1_guide.png")

        classes = [node["class_type"] for node in workflow.values()]
        self.assertIn("IPAdapterUnifiedLoader", classes)
        self.assertIn("IPAdapterAdvanced", classes)
        self.assertIn("LoadImage", classes)
        self.assertEqual(classes.count("ImageBatch"), 2)
        self.assertIn("VAEEncodeForInpaint", classes)
        self.assertIn("ImageCompositeMasked", classes)
        loader = next(node for node in workflow.values() if node["class_type"] == "IPAdapterUnifiedLoader")
        adapter = next(node for node in workflow.values() if node["class_type"] == "IPAdapterAdvanced")
        sampler = next(node for node in workflow.values() if node["class_type"] == "KSampler")
        latent = next(node for node in workflow.values() if node["class_type"] == "EmptyLatentImage")
        self.assertEqual(loader["inputs"]["preset"], "PLUS (high strength)")
        self.assertEqual(adapter["inputs"]["weight"], 0.05)
        self.assertEqual(adapter["inputs"]["end_at"], 0.3)
        self.assertEqual(adapter["inputs"]["weight_type"], "style transfer precise")
        self.assertEqual(adapter["inputs"]["combine_embeds"], "average")
        self.assertEqual(adapter["inputs"]["embeds_scaling"], "K+V w/ C penalty")
        foliage_workflow = module.workflow_prompt(
            next(candidate for candidate in module.JOBS if candidate.category.value == "foliage"),
            references,
            "phase4c_foliage_guide.png",
        )
        foliage_adapter = next(node for node in foliage_workflow.values() if node["class_type"] == "IPAdapterAdvanced")
        self.assertEqual(foliage_adapter["inputs"]["weight"], 0.02)
        terrain_workflow = module.workflow_prompt(
            next(candidate for candidate in module.JOBS if candidate.category.value == "terrain"),
            references,
            None,
        )
        terrain_adapter = next(node for node in terrain_workflow.values() if node["class_type"] == "IPAdapterAdvanced")
        self.assertEqual(terrain_adapter["inputs"]["weight"], 0.01)
        self.assertEqual(latent["inputs"], {"width": 1024, "height": 1024, "batch_size": 1})
        self.assertEqual(sampler["inputs"]["steps"], 30)
        self.assertEqual(sampler["inputs"]["sampler_name"], "dpmpp_2m")
        self.assertEqual(sampler["inputs"]["scheduler"], "karras")
        self.assertEqual(sampler["inputs"]["denoise"], 0.72)

    def test_prompts_forbid_contact_sheet_content_bleed(self) -> None:
        module = load_generator()

        workflow = module.workflow_prompt(
            next(candidate for candidate in module.JOBS if candidate.category.value == "foliage"),
            ("phase4c_ref_house.png", "phase4c_ref_mill.png", "phase4c_ref_granary.png"),
            "phase4c_foliage_guide.png",
        )
        positive = str(next(node for node in workflow.values() if node["class_type"] == "CLIPTextEncode")["inputs"]["text"])
        negatives = [str(node["inputs"]["text"]) for node in workflow.values() if node["class_type"] == "CLIPTextEncode"]
        self.assertIn("exactly one subject", positive)
        self.assertNotIn("plaster", positive)
        self.assertNotIn("slate", positive)
        self.assertIn("foliage and timber colours only", positive)
        self.assertTrue(any("sprite sheet" in negative and "multiple objects" in negative for negative in negatives))
        self.assertTrue(any("diorama" in negative and "terrain island" in negative for negative in negatives))

    def test_subject_guides_lock_one_bounded_non_cyan_silhouette(self) -> None:
        module = load_generator()

        for job in (
            next(candidate for candidate in module.JOBS if candidate.key == "house_l3"),
            next(candidate for candidate in module.JOBS if candidate.key == "wheat_farm"),
            next(candidate for candidate in module.JOBS if candidate.key == "shrub_b"),
        ):
            with self.subTest(key=job.key):
                guide = module.build_subject_guide(job)
                self.assertEqual(guide.size, (1024, 1024))
                self.assertEqual(guide.getpixel((0, 0)), (0, 255, 255))
                non_cyan = sum(pixel != (0, 255, 255) for pixel in guide.get_flattened_data())
                self.assertGreater(non_cyan, 20_000)
                self.assertLess(non_cyan, 520_000)

    def test_production_guides_keep_shallow_open_workspaces(self) -> None:
        module = load_generator()

        for key in ("storehouse", "logging_camp", "sawmill"):
            with self.subTest(key=key):
                job = next(candidate for candidate in module.JOBS if candidate.key == key)
                guide = module.build_subject_guide(job)
                self.assertEqual(guide.getpixel((512, 200)), module.CYAN_RGB)
                self.assertEqual(guide.getpixel((512, 720)), (67, 54, 42))
                workflow = module.workflow_prompt(job, ("house.png", "mill.png", "barn.png"), "guide.png")
                sampler = next(node for node in workflow.values() if node["class_type"] == "KSampler")
                self.assertEqual(sampler["inputs"]["denoise"], 0.72)

    def test_storehouse_workflow_restores_open_bay_and_crates_after_inpaint(self) -> None:
        module = load_generator()
        job = next(candidate for candidate in module.JOBS if candidate.key == "storehouse")
        workflow = module.workflow_prompt(job, ("house.png", "mill.png", "barn.png"), "guide.png")
        preserved_colours = {
            node["inputs"]["color"]
            for node in workflow.values()
            if node["class_type"] == "ImageColorToMask"
        }

        self.assertEqual(preserved_colours, {65535, 4404778, 8675386})

    def test_target_filter_and_timed_manifest_are_portable(self) -> None:
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            root = Path(raw_tmp)
            source = root / "source.png"
            Image.new("RGB", (1024, 1024), (0, 255, 255)).save(source)
            atlas = root / "atlas.png"
            Image.new("RGB", (1024, 1024), (45, 38, 31)).save(atlas)
            queued: list[str] = []

            def fake_queue(prompt):
                save = next(node for node in prompt.values() if node["class_type"] == "SaveImage")
                queued.append(str(save["inputs"]["filename_prefix"]))
                return "private-prompt-id"

            module.queue_prompt = fake_queue
            module.wait_for_outputs = lambda _prompt_id: [source]
            module.upload_reference_images = lambda _repo_root: ("house.png", "mill.png", "granary.png")
            module.upload_subject_guide = lambda _job: "guide.png"
            module.generate(root / "raw", root, frozenset({"terrain:grass"}))

            self.assertEqual(len(queued), 1)
            manifest_text = (root / "raw" / "manifest.json").read_text(encoding="utf-8")
            self.assertNotIn(str(root), manifest_text)
            self.assertNotIn("private-prompt-id", manifest_text)
            manifest = json.loads(manifest_text)
            self.assertEqual(manifest["summary"]["queuedJobs"], 1)
            self.assertEqual(manifest["summary"]["completedJobs"], 1)
            self.assertIn("startedAtUtc", manifest["timing"])
            self.assertIn("finishedAtUtc", manifest["timing"])
            self.assertGreaterEqual(manifest["timing"]["elapsedSeconds"], 0)
            self.assertEqual(manifest["jobs"][0]["sourcePath"], "terrain/grass.png")

    def test_output_path_rejects_escape_absolute_and_non_png(self) -> None:
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            module.COMFY_OUTPUT = Path(raw_tmp) / "output"
            expected = (module.COMFY_OUTPUT / "phase4c" / "candidate.png").resolve()
            self.assertEqual(module.contained_output_path("phase4c", "candidate.png"), expected)
            for subfolder, filename in (("../../escape", "x.png"), ("", "/tmp/x.png"), ("phase4c", "x.txt")):
                with self.subTest(subfolder=subfolder, filename=filename):
                    with self.assertRaisesRegex(RuntimeError, "Comfy output path"):
                        module.contained_output_path(subfolder, filename)


if __name__ == "__main__":
    unittest.main()
