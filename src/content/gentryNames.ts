/**
 * FIX-5 (roadmap rule "실존 인물·가문 복원 안 함", decision FN11): the gentry and clergy of the game are invented. The
 * surnames are Anglo-Norman in form (`de` + an invented place, `Fitz` + a given name) and are not any real lineage;
 * the earldoms and sees are invented places. The kings and the world's events stay as history had them.
 * Proper nouns in the period's spelling; their Korean readings are `GENTRY_NAMES_KO` below.
 */
export const GENTRY_SURNAMES = [
  // The lords of the town (the lordship's houses, in succession order).
  "de Haverel", "de Coldmere", "de Brancel", "de Vauterre", "de Grimesand", "de Wystanley", "de Hollenby", "de Querney",
  "de Tamerel", "de Fauconval", "de Sauvenay", "de Ravenholt", "de Blaucourt", "de Montgarnier", "de Brisemont", "de Hautvale",
  "de Merrowen", "Fitzaldric", "Fitzwendel", "Fitzosric",
  // The neighbouring lords.
  "de Corbelle", "de Lisonde", "de Ambreth", "de Thornell", "de Heronel", "de Ivrecourt", "de Kestevale", "de Gildermoor",
  // The earls' houses.
  "de Rochefell", "de Valbrise", "de Mervaux", "de Castelbrun", "de Orvelle", "de Hallamore", "de Evercombe", "de Stanmere",
  // The bishops.
  "de Aldermere", "de Brokeshaw", "de Candeville", "de Dunsmere", "de Esquerel", "de Fraidmont",
] as const;

export const LORD_HOUSE_SURNAMES = GENTRY_SURNAMES.slice(0, 20);
export const NEIGHBOUR_SURNAMES = GENTRY_SURNAMES.slice(20, 28);
export const EARL_SURNAMES = GENTRY_SURNAMES.slice(28, 36);
export const BISHOP_SURNAMES = GENTRY_SURNAMES.slice(36, 42);

/** Invented earldoms (the overlord's title) and sees (the bishop's). */
export const EARLDOM_TITLES = ["Harrowmere", "Wessingford", "Thornhollow", "Aldwyne", "Brackmoor", "Estmarch", "Kelverton", "Saltwold"] as const;
export const SEE_NAMES = ["Aldminster", "Kelborough", "Wyncaster", "Estbury", "Holmchester", "Brenwick"] as const;

export const GENTRY_NAMES_KO: Readonly<Record<string, string>> = {
  "de Haverel": "드 해버럴", "de Coldmere": "드 콜드미어", "de Brancel": "드 브랑셀", "de Vauterre": "드 보테르", "de Grimesand": "드 그라임샌드",
  "de Wystanley": "드 위스턴리", "de Hollenby": "드 홀렌비", "de Querney": "드 쿼니", "de Tamerel": "드 태머럴", "de Fauconval": "드 포콩발",
  "de Sauvenay": "드 소브네", "de Ravenholt": "드 레이븐홀트", "de Blaucourt": "드 블로쿠르", "de Montgarnier": "드 몽가르니에", "de Brisemont": "드 브리즈몽",
  "de Hautvale": "드 오트베일", "de Merrowen": "드 메로언", Fitzaldric: "피츠올드릭", Fitzwendel: "피츠웬들", Fitzosric: "피츠오스릭",
  "de Corbelle": "드 코르벨", "de Lisonde": "드 리종드", "de Ambreth": "드 앰브레스", "de Thornell": "드 손넬", "de Heronel": "드 헤로넬",
  "de Ivrecourt": "드 이브르쿠르", "de Kestevale": "드 케스트베일", "de Gildermoor": "드 길더무어", "de Rochefell": "드 로슈펠", "de Valbrise": "드 발브리즈",
  "de Mervaux": "드 메르보", "de Castelbrun": "드 카스텔브룅", "de Orvelle": "드 오르벨", "de Hallamore": "드 할라모어", "de Evercombe": "드 에버쿰",
  "de Stanmere": "드 스탠미어", "de Aldermere": "드 올더미어", "de Brokeshaw": "드 브록쇼", "de Candeville": "드 캉드빌", "de Dunsmere": "드 던스미어",
  "de Esquerel": "드 에스케렐", "de Fraidmont": "드 프레몽",
  Harrowmere: "해로미어", Wessingford: "웨싱퍼드", Thornhollow: "손홀로", Aldwyne: "올드와인", Brackmoor: "브랙무어", Estmarch: "에스트마치",
  Kelverton: "켈버턴", Saltwold: "솔트월드", Aldminster: "올드민스터", Kelborough: "켈버러", Wyncaster: "윈캐스터", Estbury: "에스트버리",
  Holmchester: "홈체스터", Brenwick: "브렌윅",
};

/**
 * FIX-5 (save v22): the names saves before FIX-5 carry, and what each becomes — by use (a lord's house, a neighbour,
 * an earl's title and house, a see, a bishop) and by the same position in its old list, so a town keeps its seed's pick.
 */
const byIndex = (old: readonly string[], now: readonly string[]): Readonly<Record<string, string>> =>
  Object.fromEntries(old.map((name, index) => [name, now[index]!]));
export const RETIRED_NAMES = {
  lordHouses: byIndex(["Mortimer", "Beauchamp", "Clifford", "Neville", "Percy", "Grey", "Talbot", "Stafford", "Courtenay", "Hastings",
    "Mowbray", "Ferrers", "Basset", "Zouche", "Lovel", "Scrope", "Willoughby", "Berkeley", "Despenser", "Montagu"], LORD_HOUSE_SURNAMES),
  neighbours: byIndex(["Basset", "Zouche", "Lovel", "Scrope", "Willoughby", "Berkeley", "Talbot", "Grey"], NEIGHBOUR_SURNAMES),
  earldoms: byIndex(["Arundel", "Warwick", "Hereford", "Pembroke", "Oxford", "Devon"], EARLDOM_TITLES),
  earls: byIndex(["FitzAlan", "Beauchamp", "de Bohun", "de Valence", "de Vere", "Courtenay"], EARL_SURNAMES),
  sees: byIndex(["Lincoln", "Winchester", "Exeter", "Salisbury", "Worcester", "Norwich"], SEE_NAMES),
  bishops: byIndex(["de Gravesend", "de Stratford", "de Grandisson", "de Wyvil", "de Cobham", "de Ayremynne"], BISHOP_SURNAMES),
} as const;
