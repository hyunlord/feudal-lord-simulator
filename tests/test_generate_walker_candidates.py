from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generateWalkerCandidates.py"


class GeneratorLoadError(RuntimeError):
    pass


def load_generator():
    spec = importlib.util.spec_from_file_location("generateWalkerCandidates", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise GeneratorLoadError("Could not load generateWalkerCandidates.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class WalkerCandidateGeneratorContractTest(unittest.TestCase):
    def test_dry_run_enumerates_one_full_colour_candidate_per_role_direction(self) -> None:
        """Given Phase 13 walkers, dry-run lists 16 backward-independent jobs without contacting ComfyUI."""
        module = load_generator()
        calls: list[str] = []

        def fail_api(path: str, body=None):
            calls.append(path)
            raise AssertionError("dry run must not contact ComfyUI")

        module.api_json = fail_api
        document = module.dry_run_manifest()
        jobs = document["jobs"]

        self.assertEqual(document["summary"]["roles"], 4)
        self.assertEqual(document["summary"]["directions"], 4)
        self.assertEqual(document["summary"]["queuedJobs"], 16)
        self.assertEqual(document["summary"]["comfyuiRequests"], 0)
        self.assertEqual(calls, [])
        planned_roles = ("builder", "farmer", "logger", "carter")
        planned_directions = ("NE", "SE", "SW", "NW")
        self.assertEqual(
            [(job["role"], job["direction"]) for job in jobs],
            [(role, direction) for role in planned_roles for direction in planned_directions],
        )
        self.assertTrue(all(job["candidate"] == 1 for job in jobs))
        self.assertEqual(len({job["seed"] for job in jobs}), 16)
        self.assertIn("builder/NE/builder_NE_01.png", [job["sourcePath"] for job in jobs])
        self.assertIn("logger/NW/logger_NW_01.png", [job["sourcePath"] for job in jobs])
        self.assertNotIn("distributor", {job["role"] for job in jobs})
        self.assertNotIn("idle", {job["role"] for job in jobs})
        self.assertTrue(all(job["preparedPath"].endswith(".png") for job in jobs))

    def test_workflow_prompt_contains_role_identity_and_explicit_facing_clause(self) -> None:
        """Given each planned role and direction, prompts command distinct jobs instead of mirrored reuse."""
        module = load_generator()

        for role, role_marker in {
            "builder": "timber planks",
            "farmer": "wheat sheaf",
            "logger": "wood axe",
            "carter": "wooden hand cart",
        }.items():
            for direction, required in {
                "NE": ("facing north-east", "up-right"),
                "SE": ("facing south-east", "down-right"),
                "SW": ("facing south-west", "down-left"),
                "NW": ("facing north-west", "up-left"),
            }.items():
                with self.subTest(role=role, direction=direction):
                    job = next(job for job in module.JOBS if job.role == role and job.direction == direction)
                    workflow = module.workflow_prompt(job)
                    positive = str(workflow["2"]["inputs"]["text"]).lower()
                    negative = str(workflow["3"]["inputs"]["text"]).lower()
                    self.assertIn("full-colour hand-painted", positive)
                    self.assertIn("small medieval worker sprite", positive)
                    self.assertIn(role_marker, positive)
                    self.assertIn(required[0], positive)
                    self.assertIn(required[1], positive)
                    self.assertIn("not a mirrored copy", positive)
                    self.assertIn("limited palette", negative)
                    self.assertIn("mirror", negative)
                    self.assertNotIn("pixelated", positive)

    def test_generation_target_validation_accepts_only_planned_roles(self) -> None:
        """Given a targeted generation request, legacy display roles are rejected."""
        module = load_generator()

        selected = module.selected_jobs(frozenset({"farmer:SE", "logger:NW"}))

        self.assertEqual([(job.role, job.direction) for job in selected], [("farmer", "SE"), ("logger", "NW")])
        with self.assertRaisesRegex(module.GeneratorContractError, "Unknown walker target"):
            module.selected_jobs(frozenset({"distributor:SE"}))
        with self.assertRaisesRegex(module.GeneratorContractError, "Unknown walker target"):
            module.selected_jobs(frozenset({"idle:NW"}))

    def test_prepare_candidate_keys_cyan_background_and_fits_32x48_sprite(self) -> None:
        """Given a raw cyan-backed PNG, prepare emits a transparent 32x48 full-colour sprite."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_root = tmp / "raw"
            prepared_root = tmp / "prepared"
            raw_path = source_root / "carter" / "NE" / "carter_NE_01.png"
            raw_path.parent.mkdir(parents=True)
            image = Image.new("RGB", (512, 512), module.CYAN_RGB)
            draw = ImageDraw.Draw(image)
            draw.rectangle((210, 130, 300, 395), fill=(155, 92, 43))
            draw.rectangle((270, 280, 375, 360), fill=(88, 60, 32))
            image.save(raw_path)

            manifest = module.prepare(source_root=source_root, output_root=prepared_root)
            prepared_path = prepared_root / "carter" / "NE" / "carter_NE_01.png"

            self.assertTrue(prepared_path.is_file())
            with Image.open(prepared_path) as prepared:
                self.assertEqual(prepared.size, (32, 48))
                self.assertEqual(prepared.mode, "RGBA")
                self.assertEqual(prepared.getpixel((0, 0))[3], 0)
                alpha_values = [pixel[3] for pixel in prepared.get_flattened_data()]
                self.assertGreater(sum(alpha > 0 for alpha in alpha_values), 50)
                self.assertLess(sum(alpha > 0 for alpha in alpha_values), 32 * 48)
            self.assertEqual(manifest["summary"]["preparedJobs"], 1)
            self.assertEqual(manifest["sprites"][0]["size"], [32, 48])
            self.assertEqual(manifest["sprites"][0]["backgroundPolicy"], "alpha-or-cyan-key")
            self.assertFalse(Path(manifest["sprites"][0]["sourcePath"]).is_absolute())
            self.assertFalse(Path(manifest["sprites"][0]["preparedPath"]).is_absolute())

    def test_generate_writes_portable_manifest_without_prompt_ids(self) -> None:
        """Given mocked Comfy output, generation persists only portable candidate records."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            tmp = Path(raw_tmp)
            source_image = tmp / "source.png"
            Image.new("RGB", (1024, 1024), module.CYAN_RGB).save(source_image)
            queued_prefixes: list[str] = []

            def fake_queue(prompt):
                save_node = next(node for node in prompt.values() if node["class_type"] == "SaveImage")
                queued_prefixes.append(str(save_node["inputs"]["filename_prefix"]))
                return "secret-prompt-id"

            module.queue_prompt = fake_queue
            module.wait_for_outputs = lambda _prompt_id: [source_image]

            module.generate(output_root=tmp / "raw", targets=frozenset({"builder:SW"}))
            manifest_text = (tmp / "raw" / "manifest.json").read_text(encoding="utf-8")
            manifest = json.loads(manifest_text)

            self.assertEqual(queued_prefixes, ["phase13_walkers/builder/SW/builder_SW_01"])
            self.assertNotIn("prompt_id", manifest_text)
            self.assertNotIn("secret-prompt-id", manifest_text)
            self.assertNotIn(str(tmp), manifest_text)
            self.assertEqual(manifest["summary"]["queuedJobs"], 1)
            self.assertEqual(manifest["jobs"][0]["sourcePath"], "builder/SW/builder_SW_01.png")

    def test_comfy_output_path_rejects_escape_and_non_png_results(self) -> None:
        """Given untrusted Comfy paths, traversal and non-PNG outputs fail closed."""
        module = load_generator()

        with TemporaryDirectory() as raw_tmp:
            module.COMFY_OUTPUT = Path(raw_tmp) / "output"
            expected = (module.COMFY_OUTPUT / "phase13_walkers" / "candidate.png").resolve()
            self.assertEqual(module.contained_output_path("phase13_walkers", "candidate.png"), expected)
            for subfolder, filename in (
                ("../../outside", "candidate.png"),
                ("", "/tmp/outside.png"),
                ("phase13_walkers", "candidate.jpg"),
            ):
                with self.subTest(subfolder=subfolder, filename=filename):
                    with self.assertRaisesRegex(module.GeneratorContractError, "Comfy output path"):
                        module.contained_output_path(subfolder, filename)


if __name__ == "__main__":
    unittest.main()
