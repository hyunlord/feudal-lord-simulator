# Settlement and marker candidate QA

12 settlement PNGs, 6 marker PNGs, 11 full generated masters. Built-in imagegen only; no external generation API, no dependencies installed, no repository files changed.

All 18 production files are RGBA with genuine alpha=0 pixels. SHA256 rechecked. New artwork cropped to alpha bounds and reduced once using Lanczos; source masters remain unmodified. Three settlement and three flag reference assets are byte-identical native-size copies.

Visually inspected all twelve settlements on parchment at production scale and 65px art width; 12 subjects remain distinguishable. Warm lime, oak, terracotta and top-left lighting are coherent. Post mill inspected at full resolution: box buck, central post, cross trestle, four sails and tailpole; no waterwheel or tower mill. Blank ribbon and hostile flag also inspected after reduction.

New sites use 192x160 canvases. Reused sites retain original 96x96; consume alphaBounds plus recommendedArtWidthPx for consistent apparent scale. Site pivots use alpha-bound bottom center. Flag pivots use pole-bottom alpha footprint. Generated images were guided by inspected project references in the prompt context, not supplied as edit targets.

Remaining limits: these are candidates, not installed assets. Runtime map overlap, selection, zoom, labels and performance need integration checks. Full-generation tiny window details are not asserted as architectural surveys. Boundary brush is an explicitly authorized code-native dashed brown polyline; it is not an AI-painted master.
