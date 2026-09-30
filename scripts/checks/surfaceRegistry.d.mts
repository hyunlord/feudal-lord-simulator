// Types of scripts/checks/surfaceRegistry.mjs (a plain module: check:merge imports it with node, tests with types).
export type SurfaceCandidate = { readonly kind: "dialog" | "class" | "frame" | "css"; readonly path: string; readonly line: number; readonly names: readonly string[]; readonly selector?: string };
export type SurfaceReader = { readonly list: () => readonly string[]; readonly read: (path: string) => string };
export declare const REGISTRY_PATH: string;
export declare function stripComments(text: string, options?: { readonly css?: boolean }): string;
export declare function registeredClasses(registryText: string): Set<string>;
export declare function tsxCandidates(path: string, source: string): SurfaceCandidate[];
export declare function subjectClassSets(selector: string): string[][];
export declare function cssCandidates(path: string, source: string): SurfaceCandidate[];
export declare function unregisteredSurfaces(reader: SurfaceReader): { readonly candidates: number; readonly registered: number; readonly missing: readonly SurfaceCandidate[] };
export declare function treeReader(root: string): SurfaceReader;
export declare function formatSurfaceRegistryResult(result: { readonly skipped?: boolean; readonly candidates?: number; readonly missing: readonly SurfaceCandidate[] }): string;
