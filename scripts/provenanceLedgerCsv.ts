/** Minimal RFC4180 CSV parse/stringify for docs/provenance/assets.csv. */

export const CSV_COLUMNS = [
  "assetId",
  "version",
  "runtimePath",
  "runtimeSha256",
  "sourcePath",
  "sourceSha256",
  "tool",
  "model",
  "generatedAt",
  "prompt",
  "referenceInputs",
  "seed",
  "candidates",
  "manualEdits",
  "artBible",
  "historicalProfile",
  "owner",
  "usedIn",
  "status",
  "notes",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CsvRow = Record<CsvColumn, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function stringifyCsv(rows: readonly CsvRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(col => csvField(row[col] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseCsvRows(text: string): CsvRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const header = table[0];
  if (header === undefined) return [];
  for (const col of CSV_COLUMNS) {
    if (!header.includes(col)) throw new Error(`assets.csv is missing required column "${col}"`);
  }
  const rows: CsvRow[] = [];
  for (const record of table.slice(1)) {
    const row = {} as CsvRow;
    for (const col of CSV_COLUMNS) {
      const idx = header.indexOf(col);
      row[col] = idx >= 0 ? (record[idx] ?? "") : "";
    }
    rows.push(row);
  }
  return rows;
}

export function rowKey(row: Pick<CsvRow, "assetId" | "version">): string {
  return `${row.assetId}\u0000${row.version}`;
}
