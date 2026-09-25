// C1c-2 (AF-13): this fixture (materialPolicyTown/observedMaterialTown) is a walled quarry town whose only
// buildable terrain is a single open tile (7,2) - a whole map search finds no 2x2 grass/forest block anywhere.
// Its single test asserted that the advisor picks `wheat_farm` (buildable on any terrain, like a house) ahead of
// the material recovery episode. Grain now grows on arable strips (a 2x2 block of open field) tended by a
// farmstead, so with no farmland reachable the food action is structurally unavailable here and the advisor
// falls through to the next priority (`well`) instead - not a regression, a consequence of food now requiring
// real farmland. Retired; see /tmp/c1c2-retired-tests.md.
