// A CanvasRenderingContext2D stand-in for Node: tracks the transform and records every call with rounded
// arguments, so two draws can be compared by the hash of their call streams (tests and D1a report scripts).
export type Recording = { readonly canvas: { width: number; height: number; ops: string[] }; readonly context: CanvasRenderingContext2D };

export function recordingCanvas(width: number, height: number): Recording {
  const canvas = { width, height, ops: [] as string[] };
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: (typeof transform)[] = [];
  let patterns = 0;
  const format = (value: unknown): string => typeof value === "number" ? String(Math.round(value * 1000) / 1000)
    : typeof value === "object" && value !== null && "label" in value ? String((value as { label: unknown }).label)
    : typeof value === "object" && value !== null && "ops" in value ? "canvas" : String(value);
  const record = (name: string, args: readonly unknown[]): void => { canvas.ops.push(`${name}(${args.map(format).join(",")})`); };
  const multiply = (m: typeof transform) => {
    const t = transform;
    transform = { a: t.a * m.a + t.c * m.b, b: t.b * m.a + t.d * m.b, c: t.a * m.c + t.c * m.d, d: t.b * m.c + t.d * m.d,
      e: t.a * m.e + t.c * m.f + t.e, f: t.b * m.e + t.d * m.f + t.f };
  };
  const fields: Record<string, unknown> = { canvas, globalAlpha: 1, globalCompositeOperation: "source-over", imageSmoothingEnabled: true };
  const methods: Record<string, (...args: never[]) => unknown> = {
    save: () => { stack.push(transform); record("save", []); },
    restore: () => { transform = stack.pop() ?? transform; record("restore", []); },
    setTransform: (...args: unknown[]) => {
      const value = typeof args[0] === "object" ? args[0] as typeof transform
        : { a: args[0] as number, b: args[1] as number, c: args[2] as number, d: args[3] as number, e: args[4] as number, f: args[5] as number };
      transform = { ...value }; record("setTransform", Object.values(transform));
    },
    translate: (x: number, y: number) => { multiply({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }); record("translate", [x, y]); },
    scale: (x: number, y: number) => { multiply({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); record("scale", [x, y]); },
    getTransform: () => ({ ...transform }),
    measureText: () => ({ width: 0 }),
    clearRect: (...args: unknown[]) => {
      if (transform.a === 1 && transform.d === 1 && transform.e === 0 && transform.f === 0) canvas.ops.length = 0;
      record("clearRect", args);
    },
    createPattern: (image: unknown) => {
      const pattern = { label: `pattern${patterns++}:${format(image)}`, setTransform: (m: unknown) => record("pattern.setTransform", Object.values(m as object)) };
      return pattern;
    },
  };
  const context = new Proxy(fields, {
    get(target, key: string) {
      if (key in methods) return methods[key];
      if (key in target) return target[key];
      return (...args: unknown[]) => { record(key, args); return null; };
    },
    set(target, key: string, value) { target[key] = value; record(`set ${key}`, [value]); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { canvas, context };
}

