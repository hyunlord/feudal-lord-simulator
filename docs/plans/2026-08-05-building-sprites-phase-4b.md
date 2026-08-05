# Phase 4B Building Sprite Implementation Plan

1. Lock prompt clauses, eight-seed batches, numeric scale bands, ramp reports, and outline behavior with failing tests.
2. Update the existing generator's subject clauses and deterministic structural guides without adding dependencies.
3. Update processing and verification to reject final opaque widths outside 64–90px or 115–141px and to emit per-ramp counts/proportions.
4. Generate 24 raw 1024px candidates on DGX, process them, and retain the complete candidate set plus rejection evidence.
5. Select the strongest candidate per subject and create contact-sheet, old/new, and live-terrain context evidence.
6. Run Python tests, all TypeScript tests, typecheck, build, harness, palette/asset verification, and renderer/determinism hash guards.
7. Review the visual and code evidence, commit with Lore trailers, push `main`, and verify the remote SHA.
