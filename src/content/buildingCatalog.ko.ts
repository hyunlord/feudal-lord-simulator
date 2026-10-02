import type { BuildingKind } from "./buildingConfig";

/**
 * BLD-REG: the words of each building (`buildingCatalog.ts`), one line each: its name, the build card's line, the
 * tool's purpose, the inspector's purpose, the onboarding marker ("여기에 … 지으세요") and the chronicle's name (the
 * ledger's sentences say 집 where the menu says 오두막; COPY-1e (CA-020, CA-021): 벌목소 · 석공소 in both).
 */
export type BuildingCopy = {
  readonly name: string;
  /** The build card's one line (UX-1). */
  readonly card: string;
  /** The tool's purpose (the build menu model, the placement card). */
  readonly purpose: string;
  /** The building inspector's purpose line. */
  readonly inspector: string;
  /** The onboarding world marker. */
  readonly worldTarget: string;
  /** The name in the chronicle's sentences. */
  readonly history: string;
};

export const BUILDING_COPY = {
  house: { name: "오두막", card: "주민이 삽니다", purpose: "주민을 받아 인구 목표를 늘립니다", inspector: "주민이 생활하고 성장하는 집",
    worldTarget: "여기에 오두막을 지으세요", history: "집" },
  well: { name: "우물", card: "반경 6칸 집에 물", purpose: "주변 집에 물을 공급합니다", inspector: "주변 가구에 물을 공급",
    worldTarget: "여기에 우물을 지으세요", history: "우물" },
  storehouse: { name: "창고", card: "목재·통나무 보관", purpose: "목재와 통나무를 보관합니다", inspector: "목재와 통나무를 보관",
    worldTarget: "여기에 창고를 지으세요", history: "창고" },
  granary: { name: "곡창", card: "밀·빵을 보관합니다", purpose: "밀과 빵을 보관합니다", inspector: "밀과 빵을 보관하고 배급",
    worldTarget: "여기에 곡창을 지으세요", history: "곡창" },
  chapel: { name: "예배당", card: "신앙 · 목책 조건", purpose: "목책마을 선포 조건을 준비합니다", inspector: "마을의 시대 선포 조건을 채우는 예배당",
    worldTarget: "여기에 예배당을 지으세요", history: "예배당" },
  wheat_farm: { name: "밀밭", card: "밀을 기릅니다", purpose: "밀을 길러 방앗간에 보냅니다", inspector: "일꾼이 밀을 재배",
    worldTarget: "여기에 밀밭을 지으세요", history: "밀밭" },
  farmstead: { name: "헛간", card: "경작지를 갈고 거둡니다", purpose: "경작지 띠를 갈고 거두어 밀이나 보리를 곳간에 모읍니다. 경작지 구역 안이나 옆에 짓습니다",
    inspector: "일꾼이 경작지를 갈고 거둔 밀이나 보리를 보관", worldTarget: "여기에 헛간을 지으세요", history: "헛간" },
  mill: { name: "방앗간", card: "밀을 빵으로", purpose: "밀을 빻아 빵까지 만듭니다(이 게임에서는 제분과 제빵을 한 시설에서 합니다)", inspector: "밀을 빵으로 가공",
    worldTarget: "여기에 방앗간을 지으세요", history: "방앗간" },
  logging_camp: { name: "벌목소", card: "숲에서 통나무", purpose: "숲 가장자리에서 통나무를 냅니다", inspector: "숲에서 통나무를 생산",
    worldTarget: "여기에 벌목소를 지으세요", history: "벌목소" },
  sawmill: { name: "제재소", card: "통나무를 목재로", purpose: "통나무를 목재로 켭니다", inspector: "통나무를 목재로 가공",
    worldTarget: "여기에 제재소를 지으세요", history: "제재소" },
  quarry: { name: "채석장", card: "바위에서 원석", purpose: "바위 가장자리에서 원석을 캐냅니다", inspector: "바위에서 원석을 채굴",
    worldTarget: "여기에 채석장을 지으세요", history: "채석장" },
  masonry: { name: "석공소", card: "원석을 석재로", purpose: "원석을 석재로 다듬습니다", inspector: "원석을 석재로 가공",
    worldTarget: "여기에 석공소를 지으세요", history: "석공소" },
  market: { name: "시장", card: "남는 물자를 팝니다", purpose: "남는 물자를 팔아 재정 수입을 얻습니다", inspector: "남는 물자를 팔아 재정 수입",
    worldTarget: "여기에 시장을 지으세요", history: "시장" },
  church: { name: "교회", card: "주변 집에 신앙", purpose: "주변 집에 신앙 서비스를 제공합니다", inspector: "주변 가구에 교회 서비스를 제공",
    worldTarget: "여기에 교회를 지으세요", history: "교회" },
  keep: { name: "성채", card: "석조 도시의 성채", purpose: "석조 도시의 중심 성채를 세웁니다", inspector: "석조 도시의 중심 성채",
    worldTarget: "여기에 성채를 지으세요", history: "성채" },
  malt_kiln: { name: "엿기름 가마", card: "보리를 엿기름으로", purpose: "보리를 싹 틔워 말려 엿기름을 만듭니다. 집집의 아낙이 에일로 빚습니다",
    inspector: "보리를 엿기름으로 말립니다", worldTarget: "여기에 엿기름 가마를 지으세요", history: "엿기름 가마" },
  pastoral_farm: { name: "목축 농장", card: "목초지의 양을 칩니다", purpose: "가까운 목초지의 양을 치고 초여름에 털을 깎아 양털을 창고로 보냅니다",
    inspector: "목초지의 양을 치고 털을 깎습니다", worldTarget: "여기에 목축 농장을 지으세요", history: "목축 농장" },
  weaver_house: { name: "직조공 집", card: "털실을 모직으로 짭니다", purpose: "베틀로 털실 네 타래를 생모직 한 필로 짭니다",
    inspector: "털실을 생모직으로 짭니다", worldTarget: "여기에 직조공 집을 지으세요", history: "직조공 집" },
  fulling_mill: { name: "축융 방앗간", card: "모직을 두드려 다집니다", purpose: "물레방아 망치로 생모직을 두드려 다집니다. 흐르는 물가에만 짓습니다",
    inspector: "생모직을 축융합니다", worldTarget: "여기에 축융 방앗간을 지으세요", history: "축융 방앗간" },
  dyehouse: { name: "염색집", card: "모직을 물들입니다", purpose: "상인이 들여온 대청·꼭두서니·목서초로 모직을 물들입니다. 물가에만 짓습니다",
    inspector: "축융 모직을 물들입니다", worldTarget: "여기에 염색집을 지으세요", history: "염색집" },
  tenter_yard: { name: "텐터 틀", card: "모직을 펴 말립니다", purpose: "염색 모직을 틀에 걸어 펴 말리고 다듬어 완성 모직으로 만듭니다",
    inspector: "염색 모직을 펴 말립니다", worldTarget: "여기에 텐터 틀을 세우세요", history: "텐터 틀" },
  // FIX-11 (11): the manor house.
  manor_house: { name: "영주관", card: "영주 가문의 저택", purpose: "영주 가문이 거처하는 저택입니다",
    inspector: "영주 가문의 저택", worldTarget: "여기에 영주관을 지으세요", history: "영주관" },
} as const satisfies { readonly [K in BuildingKind]: BuildingCopy };

// FIX-11 (14): Korean names for the three dye colours the dyehouse assigns to each bolt.
export const DYE_COLOUR_COPY = {
  woad: "대청",
  madder: "꼭두서니",
  weld: "목서초",
} as const;

export const buildingCopy = (kind: BuildingKind): BuildingCopy => (BUILDING_COPY as { readonly [K in BuildingKind]: BuildingCopy })[kind];

/** A kind named by a string (a ledger record's parameter): its chronicle name, or the id itself when it is no building. */
export const buildingHistoryName = (kind: string): string => Object.hasOwn(BUILDING_COPY, kind) ? buildingCopy(kind as BuildingKind).history : kind;
