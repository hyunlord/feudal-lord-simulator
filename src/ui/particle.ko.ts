// LS1-6 (the user's ruling 2026-10-13, "교회이"): the Korean particle after a word, chosen by its last syllable — the one
// place the screen picks 이/가, 을/를, 은/는, 과/와 and 으로/로 (the copy files that kept their own pick before keep it until
// they are next touched). A word that does not end in a Hangul syllable takes the form after a vowel.

export type ParticlePair = "이/가" | "을/를" | "은/는" | "과/와" | "으로/로";

const HANGUL_FIRST = 0xac00;
const HANGUL_COUNT = 11172;
/** The final consonant (받침) index of the word's last syllable: 0 none, 8 ㄹ; -1 when it is not a Hangul syllable. */
function finalOf(word: string): number {
  const code = word.charCodeAt(word.length - 1) - HANGUL_FIRST;
  return word.length === 0 || code < 0 || code >= HANGUL_COUNT ? -1 : code % 28;
}

/** The particle alone: "교회" → "가", "목책" → "이"; 으로/로 takes 로 after ㄹ as after a vowel ("마을" → "로"). */
export function particle(word: string, pair: ParticlePair): string {
  const [withFinal, without] = pair.split("/") as [string, string];
  const final = finalOf(word);
  if (pair === "으로/로") return final > 0 && final !== 8 ? withFinal : without;
  return final > 0 ? withFinal : without;
}

/** The word with its particle: "교회가", "목책이". */
export const withParticle = (word: string, pair: ParticlePair): string => `${word}${particle(word, pair)}`;
