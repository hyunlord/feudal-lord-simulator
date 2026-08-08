export const KO_UI = {
  appName: "봉건 영주 시뮬레이터",
  informationRail: "영지 안내",
  courtConsole: "영주 명령대",
  openingGuidance: "시작 안내",
  simulationCanvas: "영지 지도",
  placementSeals: "건설 도장",
  roadTool: "길 도구",
  eraConsole: "시대 선포",
  map: { title: "영지 지형 방패", caption: "왕실 영지" },
  ledger: {
    ariaLabel: "영지 장부", heading: "왕실 장부", timber: "목재", coin: "금화",
    population: "인구", idle: "대기", wheat: "밀", bread: "빵", logs: "통나무",
    tick: "시간", seal: "도장",
  },
  settlementStatus: "정착지 상태",
  onboardingTasks: "현재 과업",
  populationObjective: "인구 목표",
  overlays: {
    ariaLabel: "경제 보기", heading: "보기", shortcut: "단축키",
    water: { label: "물", compact: "물", legend: "우물 범위와 마른 집" },
    labour: { label: "일손", compact: "일손", legend: "일손이 부족한 작업장" },
    distribution: { label: "배급", compact: "범위", legend: "곡창의 길 배급 범위" },
    roadComponent: { label: "연결된 길", compact: "길", legend: "선택 건물의 길망" },
  },
  speeds: {
    ariaLabel: "시간 속도", paused: "일시 정지", normal: "1배속",
    threefold: "3배속", fivefold: "5배속",
  },
  ceremony: {
    palisade: "목책마을 시대 선포식", dismissPalisade: "목책마을 선포식 닫기",
    stoneTown: "석조 도시 선포식", dismissStoneTown: "석조 도시 선포식 닫기",
  },
} as const;
