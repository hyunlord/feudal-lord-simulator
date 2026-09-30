# Rain lane offline QA

- 22 PNG: 12 single falling streaks, 6 four-frame splash sheets, 2 cloud shadows, 2 wetness masks.
- Native image tool called separately 22 times, one output per requested asset. Full prompts/source paths/hashes in manifest.json.
- All 12 streaks are at most 10 px tall. Canvas 16×24 is padding, not the visible rain mark. Shortest/longest and thickness/opacity families remain distinct. Native fine glows reduced into their prescribed tiny envelope; neutral grey RGB normalization removes dark fringe.
- All 6 splash sheets contain 4 unique frame hashes; shared contact baseline; low contact → crown → spread → residual. Soil splashes muted muddy tint, stone cooler, roof lower sideways shapes. No opaque ground/roof plate.
- Clouds are isolated irregular world shadows, alpha at most35/255, mechanically feathered9px after resizing. Never screen-tile.
- Wet soil/grass masks use source luminance as very low-contrast neutral dark alpha, maximum28/255. Opposite-edge RGBA difference exactly0 for both masks. Material difference intentionally subtle, not a feature stamp.
- Contact sheet viewed at actual and enlarged scale. These are small quiet effects, not large bright rain/filter marks. Single faint4px rain can disappear at0.6; density and local ground interactions carry rain readability.
- Offline image QA only. Runtime world-depth occlusion, emission bounds, contact spawning and animation timing require renderer implementation and are not claimed tested.
