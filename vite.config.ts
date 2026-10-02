import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { keyartDerivativesPlugin } from "./scripts/keyartDerivatives";
import { woff2OnlyFontsPlugin } from "./scripts/woff2OnlyFonts";
import { flsTelemetryPlugin } from "./scripts/telemetry/vitePlugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** NAT-1: Vite transform that wraps every *.ko.ts copy-object export with pseudoLong() so
 *  all Korean strings extend to ~1.4× their length when ?pseudo-long=1 is in the URL.
 *  No copy file is touched; only the compiled output is affected. */
function nat1PseudoLongPlugin() {
  return {
    name: "nat1-pseudo-long",
    enforce: "pre" as const,
    // The dev server only (the gate captures, ?pseudo-long=1): the shipped build keeps its copy modules as written.
    apply: "serve" as const,
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
      // Stateful line-by-line transform: wrap every `export const NAME = { ... }` with
      // __pl(). Uses brace depth tracking so we only close the block we opened — this
      // avoids false-closing `export type`, helper consts, or other non-export constructs.
      const OPEN_RE = /^(export const [A-Za-z_]\w* = )(\{)/;
      const CLOSE_RE = /^(\}(?:\s+as\s+const(?:\s+satisfies\s+[^\n;]+)?)?);/;
      const lines = (importLine + code).split("\n");
      const out: string[] = [];
      let depth = 0; // >0 while we're inside a __pl( wrapper; 0 = not in one
      for (const line of lines) {
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;
        if (depth === 0) {
          if (OPEN_RE.test(line)) {
            depth = opens - closes; // net depth after this opening line
            out.push(line.replace(OPEN_RE, "$1__pl($2"));
          } else {
            out.push(line);
          }
        } else {
          depth += opens - closes;
          if (depth <= 0) {
            // This is the line that closes the export const block.
            out.push(line.replace(CLOSE_RE, "$1);"));
            depth = 0;
          } else {
            out.push(line);
          }
        }
      }
      return { code: out.join("\n"), map: null };
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
  // flsTelemetryPlugin: the dev server only — always-on performance telemetry into ~/.fls-telemetry (scripts/telemetry/).
  plugins: [react(), keyartDerivativesPlugin(), woff2OnlyFontsPlugin(), nat1PseudoLongPlugin(), flsTelemetryPlugin()],
  base: process.env.GITHUB_PAGES === "true" ? "/feudal-lord-simulator/" : "/",
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()) },
  // The dependency scan reads the game's own page only. By default it reads every *.html under the root, and the saved
  // web pages in docs/design/brand/research/ import scripts that are not here: the scan failed, pre-bundling was skipped,
  // and the server re-optimised and reset connections mid-run (the DGX ui-geometry audit died on ECONNRESET).
  optimizeDeps: { entries: ["index.html"] },
});
