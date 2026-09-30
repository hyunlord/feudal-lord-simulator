// UI-AUDIT-1: the geometry audit's measure. `collectSurface` runs in the page (it reads the DOM: rects, computed frame
// insets, text line boxes, clipping, the portrait ornament's opaque pixels); `evaluateSurface` is pure (rects in, checks
// out) so tests/uiGeometryMeasure.test.ts runs it on synthetic surfaces. Both are passed to the page by their source
// (`page.evaluate(collectSurface, spec)`): they use nothing from this module's scope, and the page gets a `__name`
// shim for tsx's keepNames wrappers (scripts/uiGeometryAudit.mjs).
// The inner box (work order §2.1): the frame's content-safe rect inset by the gap (8 px). The content-safe rect is, by frame kind: css / flat — the border box inset by max(border-width,
// border-image-width − border-image-outset) per side (a surface not yet converted to the frame tokens still has its
// frame in border-image-width); layer — the content slot's box (the art's content rect), else the frame layer inset by
// its own frame widths; painting — the registry's safe rect scaled from art pixels to the rendered size. On an axis the
// surface may scroll, content may reach the padding box (it scrolls under the gap). A text line counts by its line box
// (the glyph box trimmed to the line height), so a font's taller glyph box is not a failure. A failure inside an
// element that already fails the same check (a button's label and icon inside a button beyond the box) is not counted
// again; a surface button (a cell, a whole-card hit area: it paints nothing) is checked by its contents.
// Checks: outside (text, controls, images, rules beyond the inner box), overflow (the root or a part overflowing where
// it may not scroll, text clipped without an ellipsis), border (controls, rules, images on the frame band), portrait (the
// face beyond the printed ring, ornament pixels outside it), overlap (buttons with buttons, text with buttons, text with
// text, the registry's no-overlap siblings), empty (content under 40 % of the inner box: a warning), controls (every
// clickable a kit Button wearing button art).

export type Box = { readonly l: number; readonly t: number; readonly r: number; readonly b: number };
export type Sides = { readonly t: number; readonly r: number; readonly b: number; readonly l: number };
export type ItemKind = "text" | "control" | "image" | "rule";
export type Clipper = { readonly path: string; readonly scroll: boolean; readonly ellipsis: boolean };
export type Item = {
  readonly kind: ItemKind; readonly path: string; readonly text?: string;
  /** The visible part (clipped by overflow ancestors inside the root, and the root when it clips); null: nothing shows. */
  readonly rect: Box | null; readonly full: Box; readonly clipper: Clipper | null;
  /** Placed on the frame on purpose (a registry frame slot). */
  readonly slot: boolean;
  /** Text: its line boxes. */
  readonly lines?: readonly Box[];
  /** Indices (into items) of the controls this item is inside. */
  readonly inControls: readonly number[];
  /** Indices (into items) of every item this one is inside. */
  readonly within: readonly number[];
  readonly control?: { readonly kit: boolean; readonly art: boolean; readonly variant: string | null };
};
export type Collected = {
  readonly found: boolean;
  readonly viewport: { readonly w: number; readonly h: number };
  readonly expectFound: boolean | null;
  readonly root?: {
    readonly path: string; readonly rect: Box; readonly frame: Sides; readonly padding: Sides;
    readonly overflow: { readonly x: number; readonly y: number }; readonly scrollable: { readonly x: boolean; readonly y: boolean };
  };
  readonly layer?: { readonly rect: Box; readonly frame: Sides } | null;
  readonly slot?: { readonly rect: Box; readonly padding: Sides } | null;
  readonly items?: readonly Item[];
  readonly scrollers?: readonly { readonly path: string; readonly axis: "x" | "y"; readonly over: number; readonly allowed: boolean }[];
  readonly portrait?: {
    readonly ring: { readonly cx: number; readonly cy: number; readonly r: number };
    readonly face: { readonly cx: number; readonly cy: number; readonly r: number; readonly path: string } | null;
    readonly ornament: { readonly path: string; readonly rect: Box; readonly opaque: number; readonly outside: number; readonly maxOut: number } | null;
  } | null;
  readonly siblings?: readonly { readonly selector: string; readonly rects: readonly { readonly path: string; readonly rect: Box }[]; readonly nested: readonly (readonly [number, number])[] }[];
};
export type MeasureSpec = {
  readonly root: string; readonly frame: "css" | "layer" | "painting" | "flat"; readonly gap: number;
  readonly frameLayer?: string | undefined; readonly contentSlot?: string | undefined; readonly frameSlots?: readonly string[] | undefined;
  readonly scroll?: "x" | "y" | "xy" | undefined; readonly scrollParts?: readonly string[] | undefined;
  readonly painting?: { readonly art: { readonly w: number; readonly h: number }; readonly safe: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } } | undefined;
  readonly portraitRing?: { readonly cx: number; readonly cy: number; readonly r: number; readonly inner: number; readonly face: string; readonly ornament: string } | undefined;
  readonly siblingsNoOverlap?: readonly string[] | undefined;
  readonly expect?: string | undefined;
};
export type CheckName = "outside" | "overflow" | "border" | "portrait" | "overlap" | "empty" | "controls";
export const CHECKS: readonly CheckName[] = ["outside", "overflow", "border", "portrait", "overlap", "empty", "controls"];
export type Failure = { readonly check: CheckName; readonly what: string; readonly path: string; readonly px: number; readonly rect: Box | null; readonly text?: string };
export type Evaluation = {
  readonly found: boolean; readonly inner: Box | null; readonly safe: Box | null;
  readonly failures: readonly Failure[]; readonly counts: Readonly<Record<CheckName, number>>;
  readonly empty: { readonly ratio: number; readonly warn: boolean } | null;
  readonly expectMissed: boolean;
};

/** In the page: everything evaluateSurface needs, for the first visible match of `spec.root`. */
export async function collectSurface(spec: MeasureSpec): Promise<Collected> {
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const shown = (element: Element) => {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden") return false;
    const check = (element as Element & { checkVisibility?: (options: object) => boolean }).checkVisibility;
    return check === undefined ? true : check.call(element, { opacityProperty: true, visibilityProperty: true });
  };
  const expectFound = spec.expect === undefined ? null : [...document.querySelectorAll(spec.expect)].some(shown);
  const root = [...document.querySelectorAll(spec.root)].find(shown);
  if (root === undefined) return { found: false, viewport, expectFound };
  const px = (value: string) => { const number = parseFloat(value); return Number.isFinite(number) ? number : 0; };
  const boxOf = (rect: DOMRect) => ({ l: rect.left, t: rect.top, r: rect.right, b: rect.bottom });
  const sides = (style: CSSStyleDeclaration, name: "border" | "padding") => name === "border"
    ? { t: px(style.borderTopWidth), r: px(style.borderRightWidth), b: px(style.borderBottomWidth), l: px(style.borderLeftWidth) }
    : { t: px(style.paddingTop), r: px(style.paddingRight), b: px(style.paddingBottom), l: px(style.paddingLeft) };
  // The frame's inset per side: the border width, or the border image's width less its outset when that is more.
  const frameInset = (element: Element) => {
    const style = getComputedStyle(element); const border = sides(style, "border");
    if (style.borderImageSource === "none" || style.borderImageSource === "") return border;
    const rect = element.getBoundingClientRect();
    const four = (value: string) => { const parts = value.trim().split(/\s+/); const a = parts[0] ?? "0"; const b = parts[1] ?? a; const c = parts[2] ?? a; const d = parts[3] ?? b; return [a, b, c, d]; };
    const base = [border.t, border.r, border.b, border.l]; const extent = [rect.height, rect.width, rect.height, rect.width];
    const resolve = (value: string, index: number) => value.endsWith("px") ? px(value) : value.endsWith("%") ? px(value) / 100 * extent[index]!
      : value === "auto" ? base[index]! : Number.isFinite(Number(value)) ? Number(value) * base[index]! : base[index]!;
    const widths = four(style.borderImageWidth); const outsets = four(style.borderImageOutset);
    const at = (index: number) => Math.max(base[index]!, resolve(widths[index]!, index) - resolve(outsets[index]!, index));
    return { t: at(0), r: at(1), b: at(2), l: at(3) };
  };
  const path = (element: Element) => {
    const parts: string[] = [];
    for (let node: Element | null = element; node !== null && node !== root.parentElement && parts.length < 4; node = node.parentElement) {
      const classes = [...node.classList].filter(name => !name.startsWith("ui-btn")).slice(0, 2).join(".");
      parts.unshift(`${node.tagName.toLowerCase()}${classes === "" ? "" : `.${classes}`}`);
    }
    return parts.join(" > ");
  };
  const rootStyle = getComputedStyle(root);
  const scrolls = (value: string) => value === "auto" || value === "scroll" || value === "overlay";
  const rootRect = boxOf(root.getBoundingClientRect());
  const layerElement = spec.frameLayer === undefined ? null : [...root.querySelectorAll(spec.frameLayer)].find(shown) ?? null;
  const slotElement = spec.contentSlot === undefined ? null : [...root.querySelectorAll(spec.contentSlot)].find(shown) ?? null;
  const excluded = (element: Element) => layerElement !== null && (element === layerElement || layerElement.contains(element));
  const inSlot = (element: Element) => (spec.frameSlots ?? []).some(selector => element.closest(selector) !== null && root.contains(element.closest(selector)));

  // The region the children of `container` can show in (null: they do not show), with the innermost clipper.
  type Region = { readonly box: Box; readonly clipper: Clipper | null } | null;
  const regions = new Map<Element, Region>();
  const everywhere = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
  const cut = (a: Box, b: Box, x: boolean, y: boolean) => ({ l: x ? Math.max(a.l, b.l) : a.l, r: x ? Math.min(a.r, b.r) : a.r, t: y ? Math.max(a.t, b.t) : a.t, b: y ? Math.min(a.b, b.b) : a.b });
  const regionFor = (container: Element): Region => {
    const cached = regions.get(container); if (cached !== undefined) return cached;
    const outer: Region = container === root ? { box: everywhere, clipper: null } : container.parentElement === null ? null : regionFor(container.parentElement);
    let region: Region = outer;
    if (outer !== null) {
      const style = getComputedStyle(container);
      if (style.clip !== "auto" && style.clip !== "" || style.clipPath !== "none" || container.classList.contains("visually-hidden")) region = null;
      else if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        const rect = container.getBoundingClientRect(); const border = sides(style, "border");
        const padding = { l: rect.left + border.l, t: rect.top + border.t, r: rect.right - border.r, b: rect.bottom - border.b };
        const ellipsis = style.textOverflow === "ellipsis" || (style.getPropertyValue("-webkit-line-clamp") || "none") !== "none";
        region = { box: cut(outer.box, padding, style.overflowX !== "visible", style.overflowY !== "visible"),
          clipper: { path: path(container), scroll: scrolls(style.overflowX) || scrolls(style.overflowY), ellipsis } };
      }
    }
    regions.set(container, region); return region;
  };
  const visiblePart = (box: Box, region: Region) => {
    if (region === null) return null;
    const part = cut(box, region.box, true, true);
    return part.r - part.l > 0.5 && part.b - part.t > 0.5 ? part : null;
  };

  const CONTROL = 'button, summary, [role="button"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="slider"], [role="treeitem"], a[href], input:not([type="hidden"]), select, textarea';
  const ART = /url\(/;
  const items: Item[] = []; const controlIndex = new Map<Element, number>(); const itemIndex = new Map<Element, number>();
  const around = (element: Element | null, index: Map<Element, number>) => { const found: number[] = []; for (let node = element; node !== null && node !== root.parentElement; node = node.parentElement) { const at = index.get(node); if (at !== undefined) found.push(at); } return found; };
  const controlsAround = (element: Element | null) => around(element, controlIndex);
  const visibleBorder = (style: CSSStyleDeclaration) => (["Top", "Right", "Bottom", "Left"] as const).some(side =>
    px(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1 && !["none", "hidden"].includes(style.getPropertyValue(`border-${side.toLowerCase()}-style`))
    && !/rgba\([^)]*,\s*0\)|transparent/.test(style.getPropertyValue(`border-${side.toLowerCase()}-color`)));
  const scrollers: { path: string; axis: "x" | "y"; over: number; allowed: boolean }[] = [];
  for (const element of root.querySelectorAll("*")) {
    if (excluded(element) || !shown(element)) continue;
    const style = getComputedStyle(element); const tag = element.tagName.toLowerCase();
    const full = boxOf(element.getBoundingClientRect());
    const region = element.parentElement === null ? null : regionFor(element.parentElement);
    const allowed = (spec.scrollParts ?? []).some(selector => element.matches(selector));
    if (scrolls(style.overflowX) && element.scrollWidth > element.clientWidth + 1) scrollers.push({ path: path(element), axis: "x", over: element.scrollWidth - element.clientWidth, allowed });
    if (scrolls(style.overflowY) && element.scrollHeight > element.clientHeight + 1) scrollers.push({ path: path(element), axis: "y", over: element.scrollHeight - element.clientHeight, allowed });
    const base = { path: path(element), rect: visiblePart(full, region), full, clipper: region?.clipper ?? null, slot: inSlot(element),
      inControls: controlsAround(element.parentElement), within: around(element.parentElement, itemIndex) };
    const at = items.length;
    if (element.matches(CONTROL)) {
      const kit = element.classList.contains("ui-btn") || element.classList.contains("ui-select-option") || element.closest(".ui-select, .ui-slider") !== null;
      // A list option is a row of its framed list (a surface, as the skin audit counts it).
      const variant = element.classList.contains("ui-select-option") ? "surface"
        : [...element.classList].find(name => name.startsWith("ui-btn--") && ["surface", "quiet", "primary", "secondary", "danger", "icon", "toggle", "tab"].includes(name.slice(8)))?.slice(8) ?? null;
      controlIndex.set(element, items.length);
      items.push({ ...base, kind: "control", text: (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
        control: { kit, art: ART.test(style.borderImageSource) || ART.test(style.backgroundImage), variant } });
    } else if (["img", "canvas", "svg", "video", "picture"].includes(tag) || ART.test(style.backgroundImage) || ART.test(style.borderImageSource)) {
      items.push({ ...base, kind: "image" });
    } else if (tag === "hr" || visibleBorder(style)) {
      items.push({ ...base, kind: "rule" });
    }
    if (items.length > at) itemIndex.set(element, at);
  }
  // Text: every non-blank text node, by its line boxes.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement; const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (parent === null || text === "" || excluded(parent) || !shown(parent)) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    // The line box: the glyph box trimmed to the line height about its middle.
    const lineHeight = px(getComputedStyle(parent).lineHeight);
    const lineBox = (rect: DOMRect) => { const box = boxOf(rect); if (lineHeight <= 0 || rect.height <= lineHeight) return box;
      const middle = (box.t + box.b) / 2; return { l: box.l, r: box.r, t: middle - lineHeight / 2, b: middle + lineHeight / 2 }; };
    const lines = [...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5).slice(0, 60).map(lineBox);
    if (lines.length === 0) continue;
    const full = { l: Math.min(...lines.map(line => line.l)), t: Math.min(...lines.map(line => line.t)), r: Math.max(...lines.map(line => line.r)), b: Math.max(...lines.map(line => line.b)) };
    const region = regionFor(parent);
    if (region === null) continue;
    const visibleLines = lines.map(line => visiblePart(line, region)).filter((line): line is Box => line !== null);
    items.push({ kind: "text", path: path(parent), text: text.slice(0, 40), rect: visiblePart(full, region), full, clipper: region.clipper, slot: inSlot(parent),
      lines: visibleLines, inControls: controlsAround(parent), within: around(parent, itemIndex) });
  }

  let portrait: Collected["portrait"] = null;
  if (spec.portraitRing !== undefined && spec.painting !== undefined) {
    const ringSpec = spec.portraitRing; const scaleX = (rootRect.r - rootRect.l) / spec.painting.art.w; const scaleY = (rootRect.b - rootRect.t) / spec.painting.art.h;
    const ring = { cx: rootRect.l + ringSpec.cx * scaleX, cy: rootRect.t + ringSpec.cy * scaleY, r: ringSpec.r * (scaleX + scaleY) / 2 };
    const faceElement = [...root.querySelectorAll(ringSpec.face)].find(shown);
    const faceBox = faceElement === undefined ? null : boxOf(faceElement.getBoundingClientRect());
    const face = faceBox === null ? null : { cx: (faceBox.l + faceBox.r) / 2, cy: (faceBox.t + faceBox.b) / 2, r: Math.min(faceBox.r - faceBox.l, faceBox.b - faceBox.t) / 2, path: path(faceElement!) };
    const ornamentElement = [...root.querySelectorAll(ringSpec.ornament)].find(shown);
    let ornament: NonNullable<Collected["portrait"]>["ornament"] = null;
    if (ornamentElement !== undefined) {
      const rect = boxOf(ornamentElement.getBoundingClientRect());
      const url = /url\("?([^")]+)"?\)/.exec(getComputedStyle(ornamentElement).backgroundImage)?.[1];
      let opaque = 0; let outside = 0; let maxOut = 0;
      if (url !== undefined) {
        const image = new Image(); image.src = url;
        await image.decode().catch(() => undefined);
        if (image.naturalWidth > 0) {
          const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
            if (data[(y * canvas.width + x) * 4 + 3]! < 40) continue;
            opaque += 1;
            const pageX = rect.l + (x + 0.5) * (rect.r - rect.l) / canvas.width; const pageY = rect.t + (y + 0.5) * (rect.b - rect.t) / canvas.height;
            const beyond = Math.hypot(pageX - ring.cx, pageY - ring.cy) - ring.r;
            if (beyond > 0.5) { outside += 1; maxOut = Math.max(maxOut, beyond); }
          }
        }
      }
      ornament = { path: path(ornamentElement), rect, opaque, outside, maxOut };
    }
    portrait = { ring, face, ornament };
  }
  const siblings = (spec.siblingsNoOverlap ?? []).map(selector => {
    const found = [...root.querySelectorAll(selector)].filter(element => shown(element) && !excluded(element));
    const nested: [number, number][] = [];
    found.forEach((a, i) => found.forEach((b, j) => { if (i < j && (a.contains(b) || b.contains(a))) nested.push([i, j]); }));
    return { selector, rects: found.map(element => ({ path: path(element), rect: boxOf(element.getBoundingClientRect()) })), nested };
  });
  const layerRect = layerElement === null ? null : { rect: boxOf(layerElement.getBoundingClientRect()), frame: frameInset(layerElement) };
  const slotRect = slotElement === null ? null : { rect: boxOf(slotElement.getBoundingClientRect()), padding: sides(getComputedStyle(slotElement), "padding") };
  return {
    found: true, viewport, expectFound,
    root: { path: path(root), rect: rootRect, frame: frameInset(root), padding: sides(rootStyle, "padding"),
      overflow: { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight },
      scrollable: { x: scrolls(rootStyle.overflowX), y: scrolls(rootStyle.overflowY) } },
    layer: layerRect, slot: slotRect, items, scrollers, portrait, siblings,
  };
}

/** Pure: the checks for one collected surface. */
export function evaluateSurface(collected: Collected, spec: MeasureSpec): Evaluation {
  const zero = { outside: 0, overflow: 0, border: 0, portrait: 0, overlap: 0, empty: 0, controls: 0 };
  if (!collected.found || collected.root === undefined) return { found: false, inner: null, safe: null, failures: [], counts: zero, empty: null, expectMissed: collected.expectFound === false };
  const TOLERANCE = 0.5;
  const round = (value: number) => Math.round(value * 10) / 10;
  const inset = (box: Box, by: Sides) => ({ l: box.l + by.l, t: box.t + by.t, r: box.r - by.r, b: box.b - by.b });
  const even = (value: number) => ({ t: value, r: value, b: value, l: value });
  const meet = (a: Box, b: Box) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const overlapOf = (a: Box, b: Box) => ({ w: Math.min(a.r, b.r) - Math.max(a.l, b.l), h: Math.min(a.b, b.b) - Math.max(a.t, b.t) });
  /** How far `box` reaches beyond `limit` on its worst side (≤ 0: inside). */
  const beyond = (box: Box, limit: Box) => Math.max(limit.l - box.l, box.r - limit.r, limit.t - box.t, box.b - limit.b);
  const root = collected.root;
  const rootSafe = inset(root.rect, root.frame);
  const rootInner = inset(rootSafe, even(spec.gap));
  let safe = rootSafe; let inner = rootInner;
  if (spec.frame === "layer" && collected.slot) { safe = meet(rootSafe, collected.slot.rect); inner = meet(rootInner, inset(collected.slot.rect, even(spec.gap))); }
  else if (spec.frame === "layer" && collected.layer) { safe = meet(rootSafe, inset(collected.layer.rect, collected.layer.frame)); inner = meet(rootInner, inset(safe, even(spec.gap))); }
  else if (spec.frame === "painting" && spec.painting !== undefined) {
    const scaleX = (root.rect.r - root.rect.l) / spec.painting.art.w; const scaleY = (root.rect.b - root.rect.t) / spec.painting.art.h; const art = spec.painting.safe;
    const painted = { l: root.rect.l + art.x * scaleX, t: root.rect.t + art.y * scaleY, r: root.rect.l + (art.x + art.w) * scaleX, b: root.rect.t + (art.y + art.h) * scaleY };
    safe = meet(rootSafe, painted); inner = meet(rootInner, inset(painted, even(spec.gap)));
  }
  // On an axis the surface scrolls, its content scrolls under the gap: the limit is the padding box there.
  const scrollX = spec.scroll === "x" || spec.scroll === "xy"; const scrollY = spec.scroll === "y" || spec.scroll === "xy";
  const allowed = { l: scrollX ? rootSafe.l : inner.l, r: scrollX ? rootSafe.r : inner.r, t: scrollY ? rootSafe.t : inner.t, b: scrollY ? rootSafe.b : inner.b };
  const failures: Failure[] = [];
  const fail = (check: CheckName, what: string, path: string, px: number, rect: Box | null, text?: string) =>
    failures.push(text === undefined ? { check, what, path, px: round(px), rect } : { check, what, path, px: round(px), rect, text });
  const items = collected.items ?? [];

  // Items already failing a check: what is inside them is not counted for it again.
  const failed: Record<"outside" | "border", Set<number>> = { outside: new Set(), border: new Set() };
  // A surface button paints nothing of its own (a cell or a whole-card hit area): its contents are what is checked.
  const counted = (check: "outside" | "border", item: Item) => item.control?.variant !== "surface" && !item.within.some(index => failed[check].has(index));
  // a. outside the inner box.
  items.forEach((item, index) => {
    if (item.slot || item.rect === null || !counted("outside", item)) return;
    const over = beyond(item.rect, allowed);
    if (over > TOLERANCE) { failed.outside.add(index); fail("outside", `${item.kind} beyond the inner box`, item.path, over, item.rect, item.text); }
  });
  // b. overflow: the root where it may not scroll, parts that scroll where none may, text cut without an ellipsis.
  if (!scrollX && root.overflow.x > 1) fail("overflow", root.scrollable.x ? "the surface scrolls sideways" : "content wider than the surface", root.path, root.overflow.x, root.rect);
  if (!scrollY && root.overflow.y > 1) fail("overflow", root.scrollable.y ? "the surface scrolls" : "content taller than the surface", root.path, root.overflow.y, root.rect);
  for (const scroller of collected.scrollers ?? []) if (!scroller.allowed) fail("overflow", `a part scrolls (${scroller.axis})`, scroller.path, scroller.over, null);
  for (const item of items) {
    if (item.kind !== "text" || item.clipper === null || item.clipper.scroll || item.clipper.ellipsis) continue;
    const shownBox = item.rect;
    const cutBy = shownBox === null ? Math.max(item.full.r - item.full.l, item.full.b - item.full.t) : Math.max(shownBox.l - item.full.l, item.full.r - shownBox.r, shownBox.t - item.full.t, item.full.b - shownBox.b);
    if (cutBy > 1) fail("overflow", `text clipped by ${item.clipper.path} without an ellipsis`, item.path, cutBy, item.full, item.text);
  }
  // c. controls, rules and images on the frame band.
  items.forEach((item, index) => {
    if (item.slot || item.rect === null || item.kind === "text" || !counted("border", item)) return;
    const onFrame = overlapOf(item.rect, root.rect);
    if (onFrame.w <= 0 || onFrame.h <= 0) return;
    const intrusion = beyond(item.rect, safe);
    if (intrusion > TOLERANCE) { failed.border.add(index); fail("border", `${item.kind} on the frame`, item.path, intrusion, item.rect, item.text); }
  });
  // d. the round portrait.
  const portrait = collected.portrait;
  if (portrait) {
    if (portrait.face !== null) {
      const out = Math.hypot(portrait.face.cx - portrait.ring.cx, portrait.face.cy - portrait.ring.cy) + portrait.face.r - portrait.ring.r;
      if (out > 1) fail("portrait", "the face reaches beyond the printed ring", portrait.face.path, out,
        { l: portrait.face.cx - portrait.face.r, t: portrait.face.cy - portrait.face.r, r: portrait.face.cx + portrait.face.r, b: portrait.face.cy + portrait.face.r });
    }
    if (portrait.ornament !== null && portrait.ornament.outside > 0) {
      fail("portrait", `${portrait.ornament.outside} of ${portrait.ornament.opaque} ornament pixels outside the ring`, portrait.ornament.path, portrait.ornament.maxOut, portrait.ornament.rect);
    }
  }
  // e. overlaps.
  const indexed = items.map((item, index) => ({ item, index })).filter(({ item }) => item.rect !== null && !item.slot);
  const controls = indexed.filter(({ item }) => item.kind === "control");
  const seen = new Set<string>();
  const overlapFail = (what: string, a: string, b: string, box: Box, size: { w: number; h: number }) => {
    const key = `${what}|${a}|${b}`; if (seen.has(key)) return; seen.add(key);
    fail("overlap", what, `${a} ✕ ${b}`, Math.min(size.w, size.h), box);
  };
  for (let i = 0; i < controls.length; i += 1) for (let j = i + 1; j < controls.length; j += 1) {
    const a = controls[i]!; const b = controls[j]!;
    if (a.item.inControls.includes(b.index) || b.item.inControls.includes(a.index)) continue;
    const size = overlapOf(a.item.rect!, b.item.rect!);
    if (size.w > 1 && size.h > 1) overlapFail("buttons overlap", a.item.path, b.item.path, meet(a.item.rect!, b.item.rect!), size);
  }
  const texts = indexed.filter(({ item }) => item.kind === "text");
  for (const text of texts) {
    for (const control of controls) {
      if (text.item.inControls.includes(control.index)) continue;
      for (const line of text.item.lines ?? []) {
        const size = overlapOf(line, control.item.rect!);
        if (size.w > 1 && size.h > 1) { overlapFail("text under a button", text.item.path, control.item.path, meet(line, control.item.rect!), size); break; }
      }
    }
  }
  for (let i = 0; i < texts.length; i += 1) for (let j = i + 1; j < texts.length; j += 1) {
    const a = texts[i]!; const b = texts[j]!;
    const hit = (a.item.lines ?? []).some(line => (b.item.lines ?? []).some(other => { const size = overlapOf(line, other); return size.w > 3 && size.h > 3; }));
    if (hit) overlapFail("text over text", a.item.path, b.item.path, meet(a.item.rect!, b.item.rect!), overlapOf(a.item.rect!, b.item.rect!));
  }
  for (const group of collected.siblings ?? []) {
    for (let i = 0; i < group.rects.length; i += 1) for (let j = i + 1; j < group.rects.length; j += 1) {
      if (group.nested.some(([x, y]) => x === i && y === j)) continue;
      const a = group.rects[i]!; const b = group.rects[j]!; const size = overlapOf(a.rect, b.rect);
      if (size.w > 1 && size.h > 1) overlapFail(`${group.selector} overlap`, a.path, b.path, meet(a.rect, b.rect), size);
    }
  }
  // f. empty space: content (text lines, controls, images) over the inner box's area (the frame band holds no content
  // by rule, so it is not counted as empty), on a 4 px grid.
  const CELL = 4; const area = inner;
  const width = Math.max(1, Math.ceil((area.r - area.l) / CELL)); const height = Math.max(1, Math.ceil((area.b - area.t) / CELL));
  const grid = new Uint8Array(width * height);
  const paint = (box: Box) => {
    const part = meet(box, area); if (part.r <= part.l || part.b <= part.t) return;
    for (let y = Math.floor((part.t - area.t) / CELL); y < Math.min(height, Math.ceil((part.b - area.t) / CELL)); y += 1)
      for (let x = Math.floor((part.l - area.l) / CELL); x < Math.min(width, Math.ceil((part.r - area.l) / CELL)); x += 1) grid[y * width + x] = 1;
  };
  for (const { item } of indexed) { if (item.kind === "text") for (const line of item.lines ?? []) paint(line); else if (item.kind !== "rule") paint(item.rect!); }
  const ratio = area.r > area.l && area.b > area.t ? grid.reduce((sum, cell) => sum + cell, 0) / grid.length : 1;
  const empty = { ratio: Math.round(ratio * 1000) / 1000, warn: ratio < 0.4 };
  // g. controls: kit Buttons wearing button art (surface cells and quiet links carry none by design).
  for (const { item } of controls) {
    const control = item.control!;
    if (!control.kit) fail("controls", "a clickable that is not a kit Button", item.path, 0, item.rect, item.text);
    else if (!control.art && control.variant !== "surface" && control.variant !== "quiet") fail("controls", "a kit Button without button art", item.path, 0, item.rect, item.text);
  }
  const counts = { ...zero };
  for (const failure of failures) counts[failure.check] += 1;
  return { found: true, inner, safe, failures, counts, empty, expectMissed: collected.expectFound === false };
}

/** In the page: red boxes over the failures (and the inner box dashed) for a capture; returns the layer's id. */
export function markFailures(marks: { readonly boxes: readonly Box[]; readonly inner: Box | null }): string {
  const id = `ui-geometry-marks-${Date.now()}`;
  const layer = document.createElement("div"); layer.id = id;
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
  const add = (box: Box, style: string) => { const mark = document.createElement("div");
    mark.style.cssText = `position:fixed;left:${box.l - 1}px;top:${box.t - 1}px;width:${box.r - box.l + 2}px;height:${box.b - box.t + 2}px;box-sizing:border-box;${style}`; layer.append(mark); };
  if (marks.inner !== null) add(marks.inner, "border:1px dashed rgb(0,120,255)");
  for (const box of marks.boxes) add(box, "border:2px solid rgb(230,20,40)");
  document.body.append(layer);
  return id;
}
