# Accepted art integration

1. Preserve the captured baseline and inspect accepted house, tree, and ground sources.
2. Fit source alpha bounds to existing runtime canvases without changing aspect, anchors, footprints, or scale. Preserve full colour and native alpha; do not invent generation seeds.
3. Replace opening assets and terrain, record source/output hashes, bounds, transforms, and untouched assets. Keep byte backups outside runtime directories.
4. Verify dimensions, transparency, manifest hashes, and source provenance; parent runs live browser and gameplay QA.

Terrain: downsample accepted top-down texture, blend a narrow periodic edge band to retain the existing seamless texture contract. No new dependencies. Houses L3 and unsupported civic assets remain unchanged where footprint/direction is not an exact mapping.

Completed: baseline preserved; 23 mappings installed; source/output provenance and exact geometry recorded; 44 focused tests, typecheck, and explicit accepted-art verification passed. Parent owns final browser/screenshots and gameplay QA.
