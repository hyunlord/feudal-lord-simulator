// Types of scripts/uiGeometryFingerprint.mjs (sent as it is to node on the DGX; tests import it with types).
import type { Fingerprint } from "./checks/uiGeometryMeasured.mjs";
export declare const STATE_SETS: Readonly<Record<string, string>>;
export declare const SYSTEM_FILES: readonly string[];
export declare const SHADOW_DIR: string;
export declare function folderHash(dir: string): string;
export declare function cachedFolderHash(dir: string, cacheFile: string): string;
export declare function environmentFingerprint(options?: { readonly home?: string; readonly nodeModulesKey?: string | null; readonly cache?: string }): Fingerprint;
export declare function writeShadowRecord(record: { readonly head: string; readonly time: string; readonly session: string }, options?: { readonly home?: string }): string;
