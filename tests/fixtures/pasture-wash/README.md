# RB-PASTURE-WASH fixture

This is a deliberately prepared rendering fixture, not a natural-play transcript. Starting from `tests/fixtures/distributor-entry-seed5.json.gz` at trunk `56aae1a6896a75842886516452eb3128f1578473`, three normal reducer commands painted pasture, connected an existing road, and placed a pastoral farm. Normal `advanceTick` deliveries and construction completed it after 6364 ticks (two bounded local runs, approximately 2.51 and 4.74 seconds). No inventory, completion, building or terrain was directly inserted.

Seed 5, final tick 1206364; completed `construction-site-000108` at (10,40), logical footprint 2×1, actual pasture tending 145 cells. The original baseline SHA256 is `74c6704eb011e00a4b34320a4de678831b7220080ad2c857ee0eebcdda18246a`. This compressed state SHA256 is `9eff242783727260965c4c88f71f7377c4b8a4bb92e92b8eb83d7b1efad89f66`.

The accompanying action log records the three commands in full. The external preparation record `/tmp/astra-pasture-fixture` also retains the saveCodec save, replay scripts, bounded-run timing, earlier negative fixture and exhaustive support audit; these belong in the final report ZIP.

Full-canvas support for the 192×128 image at pivot (96,120), scale 1/3 requires sixteen grass cells around an anchor. Immediate-neighbour water contradicts that rectangle, so this renderer uses nearest water at Chebyshev distance 2, keeping the complete image on land. This is a corrected renderer placement proposal, not an engine rule or a simulated water facility. With existing reservations this fixture yields one eligible pool. Winter has no pool because no winter picture was supplied.
