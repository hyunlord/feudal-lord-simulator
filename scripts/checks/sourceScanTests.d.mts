export const FOLDER_WALKS: Readonly<Record<string, readonly string[]>>;
export const SOURCE_SCAN_TESTS: readonly string[];
export const SOURCE_SCAN_GUARD: string;
export function underFolders(file: string, folders: readonly string[]): boolean;
