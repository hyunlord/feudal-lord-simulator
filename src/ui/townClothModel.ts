import { townCloth } from "../engine/cloth";
import type { GameState } from "../engine/engine.types";
import { ledgerView } from "../ledger/ledgerView";
import { TOWN_CLOTH_COPY } from "./townClothCopy.ko";

// C5 (CL-10 API townCloth): the town's cloth chain in words. Shown in the ledger drawer's stock tab (under
// the ale section) and as clothLines on the season card. A town with neither sheep nor goods held returns null.
export type TownClothView = Readonly<{
  sheep: string;
  spinningHouses: string;
  buildings: string;
  /** The season card's line: the closed season's cloth money (ulnage + fulling_toll), null when there was none. */
  closedSeason: string | null;
}>;

export function townClothView(state: GameState): TownClothView | null {
  const cloth = townCloth(state);
  const totalGoods = (Object.values(cloth.goods) as number[]).reduce((sum, n) => sum + n, 0);
  if (cloth.sheep === 0 && totalGoods === 0) return null;

  const recent = ledgerView(state, "cash", "recent");
  const amountFor = (cat: string) =>
    Math.round(recent.byCategory.find(row => row.category === cat)?.amount ?? 0);
  const ulnage = amountFor("ulnage");
  const fullingToll = amountFor("fulling_toll");

  const bn = TOWN_CLOTH_COPY.buildingNames;
  const buildingParts = [
    ...(cloth.buildings.pastoral_farm > 0 ? [TOWN_CLOTH_COPY.buildingCount(bn.pastoral_farm, cloth.buildings.pastoral_farm)] : []),
    ...(cloth.buildings.weaver_house > 0 ? [TOWN_CLOTH_COPY.buildingCount(bn.weaver_house, cloth.buildings.weaver_house)] : []),
    ...(cloth.buildings.fulling_mill > 0 ? [TOWN_CLOTH_COPY.buildingCount(bn.fulling_mill, cloth.buildings.fulling_mill)] : []),
    ...(cloth.buildings.dyehouse > 0 ? [TOWN_CLOTH_COPY.buildingCount(bn.dyehouse, cloth.buildings.dyehouse)] : []),
    ...(cloth.buildings.tenter_yard > 0 ? [TOWN_CLOTH_COPY.buildingCount(bn.tenter_yard, cloth.buildings.tenter_yard)] : []),
  ];

  return {
    sheep: TOWN_CLOTH_COPY.sheep(cloth.sheep, cloth.tendedCells),
    spinningHouses: TOWN_CLOTH_COPY.spinningHouses(cloth.spinningHouses),
    buildings: TOWN_CLOTH_COPY.buildingsLine(buildingParts),
    closedSeason: (ulnage > 0 || fullingToll > 0) ? TOWN_CLOTH_COPY.closedSeason(ulnage, fullingToll) : null,
  };
}
