import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { keyartDerivativesPlugin } from "./scripts/keyartDerivatives";
import { woff2OnlyFontsPlugin } from "./scripts/woff2OnlyFonts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** NAT-1: Vite transform that wraps every *.ko.ts copy-object export with pseudoLong() so
 *  all Korean strings extend to ~1.4× their length when ?pseudo-long=1 is in the URL.
 *  No copy file is touched; only the compiled output is affected. */
function nat1PseudoLongPlugin() {
  return {
    name: "nat1-pseudo-long",
    enforce: "pre" as const,
    transform(code: string, id: string): { code: string; map: null } | null {
      const cleanId = id.replace(/\?.*$/, "");
      if (!cleanId.endsWith(".ko.ts")) return null;
      if (cleanId.includes("nat1PseudoLong")) return null;
      if (code.includes("__pl(")) return null; // already wrapped
      const nat1Abs = resolve(__dirname, "src/ui/nat1PseudoLong");
      const fileDir = dirname(cleanId);
      let rel = relative(fileDir, nat1Abs).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      const importLine = `import { pseudoLong as __pl } from '${rel}';\n`;
      let result = importLine + code;
      // Wrap: `export const NAME = {` → `export const NAME = __pl({`
      result = result.replace(/(export const [A-Za-z_]\w* = )(\{)/g, "$1__pl($2");
      // Close: `} as const;` or `} as const satisfies Type;` → append `)` before `;`
      // The [^\n;]* captures optional TypeScript `satisfies` clauses on the same line.
      result = result.replace(/(\} as const(?:\s+satisfies\s+[^\n;]+)?);/g, "$1);");
      return { code: result, map: null };
    },
  };
}

function gameVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  try {
    return `${version}+${execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim()}`;
  } catch (_error) {
    return `${version}+unknown`;
  }
}

export default defineConfig({
  plugins: [react(), keyartDerivativesPlugin(), woff2OnlyFontsPlugin(), nat1PseudoLongPlugin()],
  base: process.env.GITHUB_PAGES === "true" ? "/feudal-lord-simulator/" : "/",
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()) },
});
