// Types of scripts/checks/inboxLedger.mjs for tsx scripts and tests (the merge checks are plain modules).
export type InboxLedgerResult = {
  present: boolean; rows: number; added: number; images: number | null;
  dangling: { file: string; target: string }[]; badMarks: { file: string; target: string; why: string }[];
  unmarked: { file: string; same: string[] }[]; unledgered: string[]; fileless: string[];
};
export declare const LEDGER: string;
export declare function parseCsv(text: string): string[][];
export declare function checkInboxLedger(options: { base?: string; head: string; cwd?: string }): InboxLedgerResult;
export declare function inboxImages(rev: string, cwd?: string): string[];
export declare function ledgerOk(result: InboxLedgerResult): boolean;
export declare function formatLedgerResult(result: InboxLedgerResult): string;
