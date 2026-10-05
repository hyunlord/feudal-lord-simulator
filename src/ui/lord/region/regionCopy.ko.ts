// LM-R2 (region area): the lord screen's region map — the home estate and the neighbours' estates on one map, a flag on
// each (held directly, given to a steward, or a neighbour's), the map's own zoom, the chosen estate's line.
// The piece and holder words repeat src/content/historyCopy.ko.ts's module-private PIECE_KO / HOLDER_KO (the ledger's
// words); switch to the exported tables when the content request (docs/requests/engine-lmr2-seen-and-reads.md) lands.
import type { EstateKind, RightPieceKind } from "../../../engine/estates.types";
import type { RegionFlag, RegionZoom } from "./regionModel";

export const REGION_COPY = {
  heading: "지역 지도",
  intro: "본 영지와 이웃 영지가 한 지도에 있습니다. 깃발은 누가 어떻게 다스리는지를 보여 줍니다. 영지를 눌러 고르세요.",
  noEstates: "지도에 둘 영지가 없습니다",
  map: "지역 지도: 영지를 눌러 고릅니다",
  /** The map picture did not load: the estates stay on a plain map. */
  noPicture: "지도 그림을 불러오지 못해 빈 지도에 영지만 표시합니다.",
  zoom: "지도 확대",
  zooms: { fit: "전체 보기", half: "확대", full: "크게 확대" } satisfies Record<RegionZoom, string>,
  flags: { direct: "직할", delegated: "위임", neighbour: "이웃" } satisfies Record<RegionFlag, string>,
  flagLines: {
    direct: "영주가 직접 다스립니다",
    delegated: "관리인에게 맡겼습니다",
    neighbour: "이웃 가문의 땅입니다",
  } satisfies Record<RegionFlag, string>,
  flagRow: (word: string, line: string) => `${word} — ${line}`,
  legend: "깃발",
  home: "본 영지",
  kinds: { manor: "장원", market_town: "시장 도시", mill_estate: "방앗간 영지", fishery: "어장 영지" } satisfies Record<EstateKind, string>,
  pieces: { land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세",
    tolls: "통행세", fishery: "어업권", advowson: "성직자 추천권", hunting: "사냥권" } satisfies Record<RightPieceKind, string>,
  holders: { lord: "영주", overlord: "상위 영주", crown: "국왕", merchants: "상인들", townsfolk: "주민들", bishop: "주교" } as Readonly<Record<string, string>>,
  /** A holder the copy has no word for (an outside id). */
  otherHolder: "다른 보유자",
  lordHouse: (house: string) => `${house} 가문`,
  estateName: (house: string) => `${house} 영지`,
  label: (name: string, flag: string) => `${name} · ${flag}`,
  site: (label: string, kind: string, line: string) => `${label}: ${kind}. ${line}`,
  armsLabel: (house: string) => `${house} 문장`,
  chosen: "고른 영지",
  rows: { kind: "종류", flag: "관리", possessor: "점유", title: "권원", steward: "관리인", value: "연간 가치", lordPieces: "영주 몫" },
  none: "없음",
  pick: "지도에서 영지를 고르면 여기에 그 영지가 나옵니다.",
  open: "영지 화면에서 보기",
  openLabel: (name: string) => `${name}: 영지 화면에서 보기`,
} as const;
