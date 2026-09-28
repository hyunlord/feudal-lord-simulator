import type { BuildTrait, EyeTrait, FaceTrait, HairTrait, NoseTrait, TraitKey } from "../../content/personTraits";

// UI-7 copy: a person's traits (PERSON-1a LN-1) as the biography's "닮은 점" names them — the child's own value of the
// trait they share with a parent ("아버지의 매부리코, 어머니의 붉은 머리").
const HAIR: Readonly<Record<HairTrait, string>> = {
  black: "검은 머리", dark_brown: "짙은 갈색 머리", brown: "갈색 머리", chestnut: "밤색 머리", auburn: "적갈색 머리", red: "붉은 머리", blond: "금발",
  flaxen: "아마빛 머리",
};
const EYE: Readonly<Record<EyeTrait, string>> = { blue: "푸른 눈", grey: "잿빛 눈", green: "초록 눈", hazel: "담갈색 눈", brown: "갈색 눈", dark_brown: "짙은 갈색 눈" };
const FACE: Readonly<Record<FaceTrait, string>> = { long: "긴 얼굴", round: "둥근 얼굴", square: "각진 턱", pointed: "뾰족한 턱" };
const NOSE: Readonly<Record<NoseTrait, string>> = { straight: "곧은 코", hooked: "매부리코", snub: "들창코", bulbous: "뭉툭한 코" };
const BUILD: Readonly<Record<BuildTrait, string>> = { thin: "호리호리한 몸", average: "보통 체격", heavy: "다부진 몸" };
/** Skin steps 0 (the palest) … 7 (weathered olive). */
const SKIN = ["아주 흰 살결", "흰 살결", "흰 살결", "밝은 살결", "불그레한 살결", "볕에 그은 살결", "올리브빛 살결", "짙은 살결"] as const;
const WORDS: Readonly<Record<Exclude<TraitKey, "skin">, Readonly<Record<string, string>>>> = { hair: HAIR, eye: EYE, faceShape: FACE, nose: NOSE, buildBias: BUILD };
const PARENTS = { father: "아버지", mother: "어머니" } as const;

export type ResemblancePart = Readonly<{ parent: keyof typeof PARENTS; trait: TraitKey; value: string | number }>;

export const PERSON_TRAIT_COPY = {
  trait: (trait: TraitKey, value: string | number): string =>
    trait === "skin" ? SKIN[Math.max(0, Math.min(SKIN.length - 1, Number(value)))]! : WORDS[trait][String(value)] ?? String(value),
  /** The biography's line: at most one trait from each parent, the father's first. */
  resemblance: (parts: readonly ResemblancePart[]) => `닮은 점: ${parts.map(part => `${PARENTS[part.parent]}의 ${PERSON_TRAIT_COPY.trait(part.trait, part.value)}`).join(", ")}`,
} as const;
