from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generateBuildingCandidates.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("generateBuildingCandidates", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load generateBuildingCandidates.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class BuildingCandidateGeneratorContractTest(unittest.TestCase):
    def test_subjects_are_exactly_house_mill_and_granary_with_six_seeds(self) -> None:
        """Given the Phase 4A generator, its subject set and candidate count are fixed."""
        module = load_generator()

        self.assertEqual([spec.key for spec in module.SUBJECTS], ["house", "mill", "granary"])
        for spec in module.SUBJECTS:
            with self.subTest(subject=spec.key):
                self.assertEqual(len(spec.seeds), 6)
                self.assertEqual(len(set(spec.seeds)), 6)
                self.assertTrue(all(str(seed).startswith("6404") for seed in spec.seeds))
        granary = next(spec for spec in module.SUBJECTS if spec.key == "granary")
        house = next(spec for spec in module.SUBJECTS if spec.key == "house")
        self.assertIn("single-storey", house.subject_clause)
        self.assertIn("one-room", house.subject_clause)
        self.assertIn("wide 2x2", granary.subject_clause)
        self.assertIn("rounded barrel roof", granary.subject_clause)

    def test_workflow_uses_sdxl_base_without_lora_and_exact_sampler_settings(self) -> None:
        """Given any subject candidate, the Comfy workflow stays reproducible and LoRA-free."""
        module = load_generator()
        workflow = module.workflow_prompt(module.SUBJECTS[0], module.SUBJECTS[0].seeds[0], "phase4_buildings/house/house_01")

        self.assertEqual(workflow["1"]["class_type"], "CheckpointLoaderSimple")
        self.assertEqual(workflow["1"]["inputs"]["ckpt_name"], "sd_xl_base_1.0.safetensors")
        self.assertNotIn("LoraLoader", [node["class_type"] for node in workflow.values()])
        self.assertEqual(workflow["2"]["inputs"]["clip"], ["1", 1])
        self.assertEqual(workflow["3"]["inputs"]["clip"], ["1", 1])
        self.assertEqual(workflow["4"]["inputs"], {"width": 1024, "height": 1024, "batch_size": 1})
        sampler = workflow["5"]["inputs"]
        self.assertEqual(sampler["model"], ["1", 0])
        self.assertEqual(sampler["steps"], 30)
        self.assertEqual(sampler["cfg"], 6.0)
        self.assertEqual(sampler["sampler_name"], "dpmpp_2m")
        self.assertEqual(sampler["scheduler"], "karras")

    def test_guided_workflow_inpaints_only_the_building_mask_and_restores_cyan(self) -> None:
        """Given a silhouette guide, SDXL paints inside it and composites the exact cyan exterior back."""
        module = load_generator()
        house = module.SUBJECTS[0]

        workflow = module.guided_workflow_prompt(
            house,
            house.seeds[0],
            "phase4_buildings/house/probe",
            "phase4a_house_guide.png",
        )

        self.assertEqual(workflow["4"]["class_type"], "LoadImage")
        self.assertEqual(workflow["4"]["inputs"]["image"], "phase4a_house_guide.png")
        self.assertEqual(workflow["5"], {
            "class_type": "ImageColorToMask",
            "inputs": {"image": ["4", 0], "color": 65535},
        })
        self.assertEqual(workflow["6"], {"class_type": "InvertMask", "inputs": {"mask": ["5", 0]}})
        self.assertEqual(workflow["7"]["class_type"], "VAEEncodeForInpaint")
        self.assertEqual(workflow["7"]["inputs"]["mask"], ["6", 0])
        self.assertEqual(workflow["8"]["inputs"]["latent_image"], ["7", 0])
        self.assertEqual(workflow["10"]["class_type"], "ImageCompositeMasked")
        self.assertEqual(workflow["10"]["inputs"]["mask"], ["5", 0])
        self.assertEqual(workflow["11"]["inputs"]["images"], ["10", 0])

    def test_guides_are_exact_cyan_outside_one_subject_specific_silhouette(self) -> None:
        """Given each subject, its deterministic guide has one bounded non-cyan silhouette."""
        module = load_generator()

        for spec in module.SUBJECTS:
            with self.subTest(subject=spec.key):
                guide = module.build_guide(spec)
                self.assertEqual(guide.size, (1024, 1024))
                self.assertEqual(guide.getpixel((0, 0)), (0, 255, 255))
                self.assertEqual(guide.getpixel((1023, 1023)), (0, 255, 255))
                non_cyan = sum(pixel != (0, 255, 255) for pixel in guide.get_flattened_data())
                self.assertGreater(non_cyan, 80_000)
                self.assertLess(non_cyan, 520_000)

    def test_positive_prompt_shares_base_and_varies_only_subject_clause(self) -> None:
        """Given all subjects, prompt variation is limited to the explicit subject clause."""
        module = load_generator()
        prompts = [
            str(module.workflow_prompt(spec, spec.seeds[0], f"phase4_buildings/{spec.key}/probe")["2"]["inputs"]["text"])
            for spec in module.SUBJECTS
        ]

        for prompt in prompts:
            self.assertIn("exact 2:1 isometric camera looking down from upper-left", prompt)
            self.assertIn("upper-left light", prompt)
            self.assertIn("painterly realistic medieval European", prompt)
            self.assertIn("Caesar III/Anno", prompt)
            self.assertIn("visible material textures", prompt)
            self.assertIn("uniform #00FFFF chroma field", prompt)
            self.assertIn("no gradient or floor plane", prompt)
            self.assertTrue(prompt.startswith(module.BASE_PROMPT))
        self.assertEqual(
            {prompt.removeprefix(module.BASE_PROMPT + ", ") for prompt in prompts},
            {spec.subject_clause for spec in module.SUBJECTS},
        )

    def test_negative_prompt_contains_common_shadow_and_style_prohibitions(self) -> None:
        """Given any workflow, unwanted ground, shadows, Roman, fantasy, and text are banned."""
        module = load_generator()
        workflow = module.workflow_prompt(module.SUBJECTS[1], module.SUBJECTS[1].seeds[0], "phase4_buildings/mill/probe")
        negative = str(workflow["3"]["inputs"]["text"]).lower()

        for required in ("ground", "contact shadow", "cast shadow", "roman", "fantasy", "text"):
            with self.subTest(required=required):
                self.assertIn(required, negative)
        self.assertIn("multi-storey", negative)
        self.assertIn("hip roof", negative)

    def test_target_filter_limits_generation_and_manifest_paths_are_portable(self) -> None:
        """Given a target filter, only that subject is queued and the manifest omits local IDs."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGB", (1024, 1024), (0, 255, 255)).save(source_image)
            queued_prefixes: list[str] = []

            def fake_queue(prompt: dict[str, dict[str, object]]) -> str:
                save_node = next(node for node in prompt.values() if node["class_type"] == "SaveImage")
                prefix = str(save_node["inputs"]["filename_prefix"])
                queued_prefixes.append(prefix)
                return "secret-prompt-id"

            module.queue_prompt = fake_queue
            module.wait_for_outputs = lambda _prompt_id: [source_image]

            module.generate(output_root=tmp / "candidates", targets=frozenset({"mill"}))

            self.assertEqual([prefix.split("/")[1] for prefix in queued_prefixes], ["mill"] * 6)
            manifest_text = (tmp / "candidates" / "manifest.json").read_text(encoding="utf-8")
            self.assertNotIn("prompt_id", manifest_text)
            self.assertNotIn("secret-prompt-id", manifest_text)
            self.assertNotIn(str(tmp), manifest_text)
            manifest = json.loads(manifest_text)
            self.assertEqual([asset["key"] for asset in manifest["assets"]], ["mill"])
            self.assertEqual(len(manifest["assets"][0]["candidates"]), 6)
            first_candidate = manifest["assets"][0]["candidates"][0]
            self.assertEqual(first_candidate["sourcePath"], "mill/mill_01.png")
            self.assertEqual(first_candidate["releasePath"], "mill_01.png")
            self.assertFalse(Path(first_candidate["sourcePath"]).is_absolute())
            self.assertFalse(Path(first_candidate["releasePath"]).is_absolute())

    def test_comfy_output_path_rejects_absolute_escape_and_non_png_results(self) -> None:
        """Given untrusted Comfy paths, path traversal and non-PNG output fail closed."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            module.COMFY_OUTPUT = Path(raw_tmp) / "output"
            expected = (module.COMFY_OUTPUT / "phase4_buildings" / "candidate.png").resolve()
            self.assertEqual(module.contained_output_path("phase4_buildings", "candidate.png"), expected)
            for subfolder, filename in (
                ("../../outside", "candidate.png"),
                ("", "/tmp/outside.png"),
                ("phase4_buildings", "candidate.txt"),
            ):
                with self.subTest(subfolder=subfolder, filename=filename):
                    with self.assertRaisesRegex(RuntimeError, "Comfy output path"):
                        module.contained_output_path(subfolder, filename)


if __name__ == "__main__":
    unittest.main()
