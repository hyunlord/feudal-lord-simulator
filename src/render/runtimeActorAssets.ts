import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { runtimeActorManifest } from "./runtimeActorManifest.generated";
import type { WalkerPresentation, WalkerPresentationDirection } from "./walkerPresentation";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

type ActorMeta = typeof runtimeActorManifest[number];
type ActorId = ActorMeta["id"];
export type ActorFrame = ActorMeta["frames"][number];
type ActorStatus = "idle" | "loading" | "ready" | "missing";
type LoadedActor = {
  readonly meta: ActorMeta;
  readonly url: string;
  status: ActorStatus;
  image: HTMLImageElement | null;
  readonly frames: Map<ActorFrame, RasterizedWorldSprite>;
  rasterError: string | null;
};

export function actorFrameFor(presentation: WalkerPresentation): ActorFrame | null {
  return runtimeActorManifest.find(meta => meta.id === presentation.role)?.frames.find(frame =>
    frame.direction === presentation.direction && frame.gaitFrame === presentation.gaitFrame) ?? null;
}

export function actorFrameDestination(frame: ActorFrame, footX: number, footY: number, scale: number) {
  const factor = 32 * scale / frame.source.height;
  return { x: footX - (frame.foot.x - frame.source.x) * factor,
    y: footY - (frame.foot.y - frame.source.y) * factor,
    width: frame.source.width * factor, height: 32 * scale };
}

export function createRuntimeActorLoader(createImage: () => HTMLImageElement | null) {
  const assets: LoadedActor[] = runtimeActorManifest.map(meta => ({ meta,
    url: assetUrlForBase(meta.url, import.meta.env?.BASE_URL ?? "/"),
    status: "idle", image: null, frames: new Map(), rasterError: null,
  }));
  let pending: Promise<void> | null = null;
  return {
    preload(): Promise<void> {
      pending ??= Promise.all(assets.filter(asset => asset.meta.active).map(asset => new Promise<void>(resolve => {
        asset.status = "loading";
        try {
          const image = createImage();
          if (image === null) { asset.status = "missing"; resolve(); return; }
          image.onerror = () => { asset.status = "missing"; resolve(); };
          image.onload = () => {
            if (!registerRuntimeAsset(image, asset.url, asset.meta.width, asset.meta.height)) {
              asset.status = "missing";
              resolve();
              return;
            }
            asset.image = image;
            asset.status = "ready";
            try {
              for (const frame of asset.meta.frames) {
                const raster = rasterizeWorldSprite(image, frame.source, 96);
                if (raster !== null) asset.frames.set(frame, raster);
              }
            } catch (error) {
              asset.rasterError = error instanceof Error ? error.message : String(error);
            } finally { resolve(); }
          };
          image.src = asset.url;
        } catch (error) {
          asset.status = "missing";
          asset.rasterError = error instanceof Error ? error.message : String(error);
          resolve();
        }
      }))).then(() => undefined);
      return pending;
    },
    statuses() { return assets.map(({ meta, status, url, rasterError, frames }) => ({ id: meta.id, active: meta.active, url, status, rasterError, bufferedFrames: frames.size })); },
    image(id: ActorId) { return assets.find(asset => asset.meta.id === id)?.image ?? null; },
    raster(id: ActorId, frame: ActorFrame) { return assets.find(asset => asset.meta.id === id)?.frames.get(frame) ?? null; },
  };
}

const loader = createRuntimeActorLoader(() => typeof globalThis.Image === "function" ? new Image() : null);
export function preloadRuntimeActorAssets(): Promise<void> { return loader.preload(); }
export function runtimeActorAssetStatuses() { return loader.statuses(); }

export function drawRuntimeActor(context: CanvasRenderingContext2D, presentation: WalkerPresentation,
  footX: number, footY: number, scale: number, zoom: number, handcart: boolean): boolean {
  if (zoom <= 0.7) return false;
  const frame = actorFrameFor(presentation);
  const image = loader.image(presentation.role);
  if (frame === null || image === null) return false;
  const cartBehind = presentation.direction === "SE" || presentation.direction === "SW";
  if (handcart && cartBehind) drawRuntimeHandcart(context, presentation.direction, footX, footY, scale);
  const raster = loader.raster(presentation.role, frame);
  drawCroppedWorldSprite(context, raster?.image ?? image, raster?.source ?? frame.source,
    actorFrameDestination(frame, footX, footY, scale), false, true);
  if (handcart && !cartBehind) drawRuntimeHandcart(context, presentation.direction, footX, footY, scale);
  return true;
}

/** The handcart of a carter, its handles at the carter's hands (also drawn behind / in front of a V2 composed walker). */
export function drawRuntimeHandcart(context: CanvasRenderingContext2D, direction: WalkerPresentationDirection,
  footX: number, footY: number, scale: number): void {
  const meta = runtimeActorManifest.find(asset => asset.id === "handcart");
  const frame = meta?.frames.find(candidate => candidate.direction === direction);
  const image = loader.image("handcart");
  if (frame === undefined || image === null) return;
  const factor = 32 * scale / frame.source.width;
  const raster = loader.raster("handcart", frame);
  drawCroppedWorldSprite(context, raster?.image ?? image, raster?.source ?? frame.source, {
    x: footX - (frame.handles.x - frame.source.x) * factor,
    y: footY - 14 * scale - (frame.handles.y - frame.source.y) * factor,
    width: frame.source.width * factor, height: frame.source.height * factor,
  }, false, true);
}
