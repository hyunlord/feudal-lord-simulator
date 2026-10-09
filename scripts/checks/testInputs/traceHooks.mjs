// RR25 (measured): the loader-thread half of traceReads.mjs. Every module URL the ESM loader resolves or loads is
// appended to $FLS_TRACE_DIR/<pid>.modules (one path per line), so modules the main thread never reads are recorded too.
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let file = null; const seen = new Set();
const note = url => {
  if (file === null || typeof url !== "string" || !url.startsWith("file:")) return;
  let path; try { path = fileURLToPath(url.split("?")[0]); } catch { return; }
  if (seen.has(path)) return; seen.add(path);
  try { appendFileSync(file, `${path}\n`); } catch { /* lost: the main record stands */ }
};

export async function initialize(data) { file = `${data.out}/${data.pid}.modules`; }
export async function resolve(specifier, context, next) { const result = await next(specifier, context); note(result.url); return result; }
export async function load(url, context, next) { note(url); return next(url, context); }
