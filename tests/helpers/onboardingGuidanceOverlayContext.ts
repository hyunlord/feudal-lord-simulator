type TestRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

type TestTransform = {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
};

type PlaqueContextOptions = {
  readonly canvasClientWidth: number;
  readonly canvasClientHeight: number;
  readonly canvasPixelWidth?: number;
  readonly canvasPixelHeight?: number;
  readonly measuredTextWidth?: number;
  readonly transform?: TestTransform;
  readonly canvasBounds?: TestRect;
  readonly railBounds?: TestRect;
};

export type PlaqueDraw = {
  readonly rectX: number;
  readonly rectWidth: number;
  readonly textX: number;
};

export function createOnboardingGuidancePlaqueContext(
  options: PlaqueContextOptions,
): { readonly calls: string[]; readonly context: CanvasRenderingContext2D } {
  const calls: string[] = [];
  const measuredTextWidth = options.measuredTextWidth ?? 108;
  const canvasBounds = options.canvasBounds ?? {
    left: 0,
    top: 0,
    right: options.canvasClientWidth,
    bottom: options.canvasClientHeight,
  };
  const rail = options.railBounds === undefined ? null : {
    getBoundingClientRect: () => options.railBounds,
  };
  const canvas = {
    clientWidth: options.canvasClientWidth,
    clientHeight: options.canvasClientHeight,
    width: options.canvasPixelWidth ?? options.canvasClientWidth,
    height: options.canvasPixelHeight ?? options.canvasClientHeight,
    parentElement: { querySelector: (selector: string) => selector === ".right-info-rail" ? rail : null },
    getBoundingClientRect: () => canvasBounds,
  };
  const context = {
    canvas,
    fillStyle: "",
    font: "",
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    measureText: () => ({ width: measuredTextWidth }),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x},${y},${width},${height}`),
    strokeRect: () => undefined,
    fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text},${x},${y}`),
    save: () => undefined,
    restore: () => undefined,
    getTransform: () => options.transform ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };

  return { calls, context: context as unknown as CanvasRenderingContext2D };
}

export function plaqueDrawFrom(calls: readonly string[]): PlaqueDraw | null {
  const fillRect = calls.find((call) => call.startsWith("fillRect:"));
  const fillText = calls.find((call) => call.startsWith("fillText:"));
  if (fillRect === undefined || fillText === undefined) return null;

  const [, rectX, , rectWidth] = fillRect.split(/[:,]/);
  const [, , textX] = fillText.split(/[:,]/);
  return {
    rectX: Number(rectX),
    rectWidth: Number(rectWidth),
    textX: Number(textX),
  };
}
