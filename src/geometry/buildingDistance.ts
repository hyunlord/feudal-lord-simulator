import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";

function axisGap(leftStart: number, leftSize: number, rightStart: number, rightSize: number): number {
  const leftEnd = leftStart + leftSize - 1;
  const rightEnd = rightStart + rightSize - 1;
  if (leftEnd < rightStart) return rightStart - leftEnd;
  if (rightEnd < leftStart) return leftStart - rightEnd;
  return 0;
}

export function buildingFootprintDistance(left: Building, right: Building): number {
  const leftConfig = BUILDING_CONFIG_BY_KIND[left.kind];
  const rightConfig = BUILDING_CONFIG_BY_KIND[right.kind];
  return axisGap(left.tx, leftConfig.width, right.tx, rightConfig.width)
    + axisGap(left.ty, leftConfig.height, right.ty, rightConfig.height);
}
