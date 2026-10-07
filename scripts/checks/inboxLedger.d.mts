// Types of scripts/checks/inboxLedger.mjs for tsx scripts and tests (the merge checks are plain modules).
export type InboxLedgerResult = {
  present: boolean; rows: number; added: number; images: number | null;
  dangling: { file: string; target: string }[]; badMarks: { file: string; target: string; why: string }[];
  unmarked: { file: string; same: string[] }[]; unledgered: string[]; fileless: string[];
  plainJpegs: string[]; largePlain: { file: string; bytes: number }[];
  form: LedgerForm & { strict: boolean };
};
export type LedgerForm = { notCrlf: number[]; unsorted: { line: number; file: string; after: string }[] };
export declare const LEDGER: string;
export declare const LARGE_PLAIN_BYTES: number;
export declare function parseCsv(text: string): string[][];
export declare function checkInboxLedger(options: { base?: string; head: string; cwd?: string }): InboxLedgerResult;
export declare function ledgerRecords(text: string): { line: number; text: string; end: "\r\n" | "\n" | "" }[];
export declare function ledgerForm(text: string): LedgerForm;
export declare function fixLedgerForm(text: string): string;
export declare function inboxImages(rev: string, cwd?: string): string[];
export declare function ledgerOk(result: InboxLedgerResult): boolean;
export declare function formatLedgerResult(result: InboxLedgerResult): string;
