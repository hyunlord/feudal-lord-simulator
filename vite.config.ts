import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

function gameVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  try {
    return `${version}+${execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim()}`;
  } catch (_error) {
    return `${version}+unknown`;
  }
}

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === "true" ? "/feudal-lord-simulator/" : "/",
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()) },
});
