// RR25 (measured): the loader-thread half of traceReads.mjs. Every module URL the ESM loader resolves or loads is
// appended to $FLS_TRACE_DIR/<pid>.modules (one path per line), so modules the main thread never reads are recorded too.
// A relative import that resolves to nothing (a caught dynamic import, say) goes to <pid>.missing: the path it looked for.
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let out = null; const seen = new Set();
const note = (url, kind = "modules") => {
  if (out === null || typeof url !== "string" || !url.startsWith("file:")) return;
  let path; try { path = fileURLToPath(url.split("?")[0]); } catch { return; }
  if (seen.has(`${kind}:${path}`)) return; seen.add(`${kind}:${path}`);
  try { appendFileSync(`${out}.${kind}`, `${path}\n`); } catch { /* lost: the main record stands */ }
};

export async function initialize(data) { out = `${data.out}/${data.pid}`; }
export async function resolve(specifier, context, next) {
  try { const result = await next(specifier, context); note(result.url); return result; }
  catch (error) {
    if (/^\.{1,2}\//.test(specifier) && typeof context.parentURL === "string") { try { note(new URL(specifier, context.parentURL).href, "missing"); } catch { /* not a URL */ } }
    throw error;
  }
}
export async function load(url, context, next) { note(url); return next(url, context); }
