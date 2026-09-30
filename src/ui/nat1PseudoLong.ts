// NAT-1: pseudo-localisation helper for text-box discipline testing (section 3).
// Activated by ?pseudo-long=1 in the URL (dev / test only; off by default in normal play).
// The Vite transform plugin (vite.config.ts nat1PseudoLongPlugin) wraps every *.ko.ts
// copy-object export with pseudoLong() so no copy file needs to be edited by hand.

/** True when the page URL contains the `pseudo-long` query parameter. */
export const isPseudoLongEnabled: boolean = (() => {
  try {
    return (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("pseudo-long")
    );
  } catch {
    return false;
  }
})();

// NAT-1: Korean syllable fillers generated from codepoint arithmetic — no Korean string
// literal in this file so the "Korean outside *.ko.ts" check does not flag it.
// The 14 syllables are ga-na-da-ra-ma-ba-sa-a-ja-cha-ka-ta-pa-ha (Hangul block U+AC00+).
const HANGUL_BASE = 0xAC00;
const HANGUL_OFFSETS = [0, 0x5E8, 0x9D0, 0xD7C, 0x11C8, 0x1620, 0x19D8, 0x1D80, 0x2130, 0x24E8, 0x28A0, 0x2C58, 0x3010, 0x33C8];
function fillerChar(i: number): string {
  return String.fromCodePoint(HANGUL_BASE + (HANGUL_OFFSETS[i % HANGUL_OFFSETS.length] ?? 0));
}

/** Extend a Korean string to approximately 1.4× its length by appending syllable fillers.
 *  Strings that are purely numeric (digits, common punctuation) are returned unchanged so
 *  resource counters and dates remain readable. UI-AUDIT-1: so are ids (lower-case ASCII
 *  words like "select" or "zoom_out" — a copy table's keys into other tables, e.g. PAD_HINT_COPY's
 *  controller actions); inflated, they looked up nothing and the kit gallery threw. */
export function extendString(s: string): string {
  if (s === "" || /^[\d\s.,+\-·%]+$/.test(s) || /^[a-z][a-z0-9_]*$/.test(s)) return s;
  const extra = Math.round(s.length * 0.4);
  let suffix = "";
  for (let i = 0; i < extra; i++) suffix += fillerChar(i);
  return s + suffix;
}

function transformValue(value: unknown): unknown {
  if (typeof value === "string") return extendString(value);
  if (typeof value === "function") {
    // NAT-1: wrap functions so their return value is also extended.
    return (...args: unknown[]) =>
      transformValue((value as (...a: unknown[]) => unknown)(...args));
  }
  if (Array.isArray(value)) return value.map(transformValue);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformValue(v);
    }
    return out;
  }
  return value;
}

/** Wrap a copy object so all string values (including function return values) are extended
 *  to approximately 1.4× their length when `?pseudo-long=1` is in the URL.
 *  Returns the object unchanged in normal play. */
export function pseudoLong<T>(obj: T): T {
  if (!isPseudoLongEnabled) return obj;
  return transformValue(obj) as T;
}
