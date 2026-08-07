import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const outDir = process.env.EVID;
const root = "https://hyunlord.github.io/feudal-lord-simulator/";
const result = { command: "node capture-pages-assets.mjs", root, fetchedAt: new Date().toISOString(), rootResponse: null, assets: [] };
async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: "follow" });
  const ab = await response.arrayBuffer();
  const buffer = Buffer.from(ab);
  return { response, buffer };
}
const { response, buffer } = await fetchBuffer(root);
const html = buffer.toString("utf8");
result.rootResponse = {
  status: response.status,
  contentType: response.headers.get("content-type"),
  size: buffer.length,
  firstBytesHex: buffer.subarray(0, 16).toString("hex"),
  sha256: createHash("sha256").update(buffer).digest("hex"),
};
writeFileSync(`${outDir}/pages-root.html`, buffer);
const urls = new Set();
const attrPattern = /(?:src|href)=["'`]([^"'`]+)["'`]/g;
for (const match of html.matchAll(attrPattern)) {
  const raw = match[1];
  if (/^(data:|mailto:|#)/.test(raw)) continue;
  const url = new URL(raw, root).href;
  if (/\.(?:js|css|png|jpe?g|webp|gif|svg|ico)(?:[?#].*)?$/i.test(url)) urls.add(url);
}
for (const url of [...urls].sort()) {
  try {
    const { response: assetResponse, buffer: assetBuffer } = await fetchBuffer(url);
    result.assets.push({
      url,
      status: assetResponse.status,
      contentType: assetResponse.headers.get("content-type"),
      size: assetBuffer.length,
      firstBytesHex: assetBuffer.subarray(0, 16).toString("hex"),
      sha256: createHash("sha256").update(assetBuffer).digest("hex"),
    });
  } catch (error) {
    result.assets.push({ url, error: String(error?.message ?? error) });
  }
}
writeFileSync(`${outDir}/pages-assets.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
