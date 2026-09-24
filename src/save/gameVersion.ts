declare const __GAME_VERSION__: string | undefined;

// Vite injects "<package version>+<commit>" at build time; node tests and scripts fall back.
export const GAME_VERSION: string = typeof __GAME_VERSION__ === "string" ? __GAME_VERSION__ : "dev";
