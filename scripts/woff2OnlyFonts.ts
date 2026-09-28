/**
 * BUDGET-1b (judgement 2026-09-28): the build ships the Noto fonts as woff2 only — the game targets Electron and
 * current browsers, which all read woff2. @fontsource's CSS lists each unicode-range file twice
 * (`src: url(….woff2) format('woff2'), url(….woff) format('woff')`); this plugin drops the woff fallback from that CSS
 * before Vite resolves its urls, so no .woff file is emitted or referenced (dev and build alike). It runs `pre`, ahead
 * of Vite's CSS plugin, which is what turns every url() into an emitted asset.
 */
import type { Plugin } from "vite";

const FONTSOURCE_CSS = /[\\/]@fontsource[\\/][^\\/]+[\\/][^\\/]+\.css(?:\?.*)?$/;
const WOFF_FALLBACK = /,\s*url\([^)]*\.woff\)\s*format\(\s*['"]woff['"]\s*\)/g;

/** The CSS with each `, url(….woff) format('woff')` fallback removed. */
export function stripWoffFallback(css: string): string {
  return css.replace(WOFF_FALLBACK, "");
}

export function woff2OnlyFontsPlugin(): Plugin {
  return {
    name: "fls-woff2-only-fonts",
    enforce: "pre",
    transform(code, id) {
      if (!FONTSOURCE_CSS.test(id)) return null;
      const stripped = stripWoffFallback(code);
      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}
