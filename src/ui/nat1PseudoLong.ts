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

// Korean syllable filler appended to extend strings to ~1.4 × their original length.
const FILLERS = "가나다라마바사아자차카타파하";

/** Extend a Korean string to approximately 1.4× its length by appending syllable fillers.
 *  Strings that are purely numeric (digits, common punctuation) are returned unchanged so
 *  resource counters and dates remain readable. */
function extendString(s: string): string {
  if (s === "" || /^[\d\s.,+\-·%]+$/.test(s)) return s;
  const extra = Math.round(s.length * 0.4);
  let suffix = "";
  for (let i = 0; i < extra; i++) suffix += FILLERS[i % FILLERS.length];
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
