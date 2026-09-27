// Types of scripts/renderCommitProbe.mjs for tsx scripts (the browser probes are plain modules).
export declare function loadChromium(path?: string): Promise<{ launch: (options: object) => Promise<{ close: () => Promise<void> }> }>;
export declare function openScene(browser: unknown, options: object): Promise<{ context: { close: () => Promise<void> }; page: unknown }>;
export declare function sceneStates(): Promise<Record<string, unknown>>;
export declare const rafMedian: (page: unknown, frames?: number) => Promise<{ median: number; p95: number }>;
