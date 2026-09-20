export const runtimeAssetDerivatives: readonly RuntimeAssetDerivative[] = [];
export type RuntimeAssetDerivative = Readonly<{
  url: string; originalWidth: number; originalHeight: number;
  width: number; height: number; originalSha256: string; sha256: string;
}>;
