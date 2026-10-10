// Types of scripts/uiGeometryInputs.mjs (a plain module: tasks.sh runs it with node, tests import it with types).
import type { TestInputs } from "./checks/testInputs/testInputs.mjs";
export declare const INPUTS_FILE: string;
export declare const DEV_SERVER_CONFIG: string;
export declare function folderHash(dir: string): string;
export declare function auditInputs(options: { root: string; traceDir: string; declared?: readonly string[] }): {
  inputs: TestInputs & { lists: string[] }; declaredPaths: string[];
  roles: Record<string, { files: number; dirs: number; lists: number; missing: number; children: string[] } | null>;
};
export declare const AUDIT_RECORDS: string;
export declare function declaredInputs(options: { root: string; states: Record<string, string>; declaredPaths: readonly string[]; chromium?: string | null; system?: readonly string[] }): {
  states: Record<string, string>; lock: string | null; viteDeps: { lockfileHash: string | null; optimized: string } | null; chromium: string | null; playwright: string | null;
  node: string; nodeModules: { key: string; inode: string } | null; system: Record<string, string | null>;
};
