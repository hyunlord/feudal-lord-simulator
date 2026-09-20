import { runtimeAssetDerivatives } from "../src/render/runtimeAssetDerivatives.generated";

/** Original art assertions refer to the archive; runtime integrity is checked separately. */
export function authoredAssetPath(url: string): string {
  return runtimeAssetDerivatives.some(asset => asset.url === url)
    ? `docs/asset-evidence/runtime-sources/${url.slice("assets/".length)}`
    : `public/${url}`;
}
