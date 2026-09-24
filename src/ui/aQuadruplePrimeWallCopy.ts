export const A_QUADRUPLE_PRIME_WALL_COPY = {
  drawTool: '목책 긋기',
  drawHint: '지도를 드래그해 목책 둘레를 직접 그립니다',
  drawCost: '둘레에 따라 목재',
  alreadyProclaimed: '목책 시대가 이미 선포되었습니다',
  requirementMissing: '선포 조건 미충족',
  requirementProgress: (label: string, current: number, target: number) => `${label} ${current}/${target}`,
  recommendationFailed: '추천 경로를 만들지 못했습니다 · 직접 그어 주세요',
  draftScope: (steps: number) => `그린 길이 ${steps}칸 · 목재 약 ${steps * 15} · 닫힌 둘레가 필요합니다`,
  drawOrMove: '지도에서 목책선을 그리거나 꼭짓점을 끌어 옮기세요.',
  recommend: '추천',
  eraseSegment: '선택 구간 지우기',
  cancelDraft: '초안 취소',
  closeDraft: '닫힌 목책을 그어 주세요',
  confirm: '목책 시대 선포 확정',
  proclamationNotice: '선포하면 공사가 시작되며 되돌릴 수 없습니다.',
  startHint: '먼저 목책을 그리거나 추천 초안을 편집하세요.',
  selectedRun: (index: number, steps: number) => `선택 구간 ${index + 1} · ${steps}칸`,
  provisionalRoute: (count: number) => `임시 자재 경로 검사 · 경로 없는 구간 ${count} (둘레를 닫으면 다시 검사)`,
  connectingRoads: (count: number) => `연결에 필요한 길 약 ${count}칸`,
  noConnectingRoad: '연결 가능한 길 후보를 찾지 못함',
  shortFailure: {
    building_clearance: '건물과 한 칸 여유 부족',
    water_crossing: '물·지형 불가',
    out_of_bounds: '지도 경계',
    self_intersection: '목책선 교차',
  },
  recommendationUnavailable: '추천 불가',
  gateGlyph: '문',
  routeReachableGlyph: '✓',
  routeUnreachableGlyph: '×',
  routeUnavailableGlyph: '?',
} as const;

const PALISADE_FAILURE_LABELS = {
  no_footprints: '완성된 건물이 없어 둘레를 잡을 수 없습니다',
  collinear_footprints: '건물이 한 줄로 몰려 둘레를 잡을 수 없습니다',
  open_polygon: '목책선이 닫히지 않았습니다',
  self_intersection: '목책선이 서로 교차합니다',
  out_of_bounds: '목책선이 지도 밖으로 나갑니다',
  water_crossing: '목책선이 물을 가로지릅니다',
  building_clearance: '건물과 성벽 사이에 최소 한 칸의 여유가 필요합니다',
  insufficient_enclosure: '생활권을 모두 둘러야 합니다',
  empty_perimeter: '둘레가 비어 있습니다',
  rejected_candidate: '목책 제안을 확인할 수 없습니다',
} as const;

export function palisadeFailureLabel(reason: keyof typeof PALISADE_FAILURE_LABELS): string {
  return PALISADE_FAILURE_LABELS[reason];
}
