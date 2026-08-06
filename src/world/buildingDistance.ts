import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";

type Footprint = {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
};

function footprint(building: Building): Footprint {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return {
    minTx: building.tx,
    minTy: building.ty,
    maxTx: building.tx + definition.width - 1,
    maxTy: building.ty + definition.height - 1,
  };
}

function axisDistance(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
): number {
  if (firstMax < secondMin) return secondMin - firstMax;
  if (secondMax < firstMin) return firstMin - secondMax;
  return 0;
}

export function buildingFootprintDistance(
  first: Building,
  second: Building,
): number {
  const firstFootprint = footprint(first);
  const secondFootprint = footprint(second);
  return (
    axisDistance(
      firstFootprint.minTx,
      firstFootprint.maxTx,
      secondFootprint.minTx,
      secondFootprint.maxTx,
    ) +
    axisDistance(
      firstFootprint.minTy,
      firstFootprint.maxTy,
      secondFootprint.minTy,
      secondFootprint.maxTy,
    )
  );
}
