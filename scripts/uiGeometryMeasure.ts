// UI-AUDIT-1: the geometry audit's measure. `collectSurface` runs in the page (it reads the DOM: rects, computed frame
// insets, text line boxes, clipping, the portrait ornament's opaque pixels); `evaluateSurface` is pure (rects in, checks
// out) so tests/uiGeometryMeasure.test.ts runs it on synthetic surfaces. Both are passed to the page by their source
// (`page.evaluate(collectSurface, spec)`): they use nothing from this module's scope, and the page gets a `__name`
// shim for tsx's keepNames wrappers (scripts/uiGeometryAudit.mjs).
// The inner box (work order §2.1): the frame's content-safe rect inset by the gap (8 px). A root that carries
// `data-frame="<kind>"` (the frame tokens: src/ui/frameTokens.generated.ts) has border-width = the kind's safe inset and
// padding = the gap, so its inner box is its computed content box (the padding counted as at least the gap); the
// border-image then only paints and is not read. A root without data-frame (not converted) falls back to: the
// content-safe rect is, by frame kind: css / flat — the border box inset by max(border-width,
// border-image-width − border-image-outset) per side (a surface not yet converted to the frame tokens still has its
// frame in border-image-width); layer — the content slot's box (the art's content rect), else the frame layer inset by
// its own frame widths; painting — the registry's safe rect scaled from art pixels to the rendered size. On an axis the
// surface may scroll, content may reach the padding box (it scrolls under the gap). A text line counts by its line box
// (the glyph box trimmed to the line height), so a font's taller glyph box is not a failure. A failure inside an
// element that already fails the same check (a button's label and icon inside a button beyond the box) is not counted
// again; a surface button (a cell, a whole-card hit area: it paints nothing) is checked by its contents. A flat or
// unframed root that paints nothing (no fill, image, border or border image: a container like the action dock) has its
// border box as the inner box — no frame, no gap — and its children are still checked.
// Checks: outside (text, controls, images, rules beyond the inner box), overflow (the root or a part overflowing where
// it may not scroll, text clipped without an ellipsis), border (controls, rules, images on the frame band), portrait (the
// face beyond the printed ring, ornament pixels outside it), overlap (buttons with buttons, text with buttons, text with
// text, the registry's no-overlap siblings), empty (content under 40 % of the inner box: a warning), controls (every
// clickable a kit Button wearing button art).
// QA round 15 (2026-10-01, the three findings the audit missed): content (every text, control and required element —
// the row's `requires`: title, body, choices, buttons — is shown, has a size, and is painted: the audit takes the root
// twice, the second time with its text transparent and its controls hidden, and an element whose pixels do not change
// is covered by something else — QA-034's frame layer over the petition's body), hud (an always-on HUD control that
// paints over the surface, or that the surface covers while it is live — QA-035's dock over the settings' last row), and
// ornament (a drawn line — the art's rule, a CSS border — running through a text's line box, found on the second
// capture where the text is gone — QA-015's biography rule through the empty-records line).
// Reachable by scrolling (QA round 15, R15 triage): a root inside a scrolling ancestor (a part of the panel slot, the
// family tree's pan) is judged by what that ancestor shows — its region starts from the ancestor's padding box, not from
// everywhere, so a part scrolled out of the drawer is not "covered by the map" and the root's hidden part does not meet
// the HUD; a root the ancestors show nothing of is scrolled into view first (`revealSurface`, as a player scrolls to
// it). The paint pass does not judge a line or a control a scroller cuts (a row half scrolled out: its visible sliver
// can be only the line's leading); everything wholly inside the scroller's view is judged as before.

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
  /** Text: the line boxes no scrolling clipper cuts (the paint pass judges these; absent: all of `lines`). */
  readonly wholeLines?: readonly Box[];
  /** A scrolling clipper cuts it (part of it is scrolled out: reachable, and the paint pass does not judge it). */
  readonly scrollCut?: boolean;
  /** Text: the content box of the block its lines are laid out in (`snapLine`). */
  readonly block?: Box;
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
    /** Its data-frame kind (null: none). */
    readonly kind: string | null;
    /** scrollWidth − clientWidth, scrollHeight − clientHeight (the frame layer and art-space wrapper included). */
    readonly overflow: { readonly x: number; readonly y: number }; readonly scrollable: { readonly x: boolean; readonly y: boolean };
    /** Its computed border widths (the padding box's edge). */
    readonly border?: Sides;
    /** It paints something of its own: a fill, a background image, a visible border or a border image. */
    readonly paints?: boolean;
    /** The part of it its scrolling ancestors show (null: none; absent: all of it). */
    readonly visible?: Box | null;
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
  /** Visible framed roots (data-frame) on the page that no registry root selector matches. */
  readonly unregistered?: readonly { readonly kind: string; readonly path: string }[];
  /** The row's required elements: each selector's shown matches (rects) and how many matches are not shown. */
  readonly requires?: readonly { readonly selector: string; readonly rects: readonly Box[]; readonly hidden: number; readonly scrolled?: number }[];
  /** Always-on HUD controls (not inside the root, not holding it) whose box meets the root's: the shared part, whether
   * the HUD is the topmost element there (it paints over the surface), and whether it is live elsewhere (topmost at its
   * own points, or under a layer that paints nothing). */
  readonly hud?: readonly { readonly path: string; readonly rect: Box; readonly shared: Box; readonly over: boolean; readonly live: boolean }[];
  /** Set by the audit from the two captures (scripts/uiGeometryPaint.ts): pixels that changed per item (null: not
   * sampled — a surface button, a control's own text), per required rect, and the drawn lines through text. */
  readonly paint?: {
    readonly items: readonly (number | null)[];
    readonly requires: readonly (readonly number[])[];
    readonly crossings: readonly { readonly item: number; readonly line: Box; readonly axis: "x" | "y" }[];
  };
};
export type MeasureSpec = {
  readonly root: string; readonly frame: "css" | "layer" | "painting" | "flat"; readonly gap: number;
  readonly frameLayer?: string | undefined; readonly contentSlot?: string | undefined; readonly frameSlots?: readonly string[] | undefined;
  readonly scroll?: "x" | "y" | "xy" | undefined; readonly scrollParts?: readonly string[] | undefined;
  readonly painting?: { readonly art: { readonly w: number; readonly h: number }; readonly safe: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } } | undefined;
  readonly portraitRing?: { readonly cx: number; readonly cy: number; readonly r: number; readonly inner: number; readonly face: string; readonly ornament: string } | undefined;
  readonly siblingsNoOverlap?: readonly string[] | undefined;
  readonly expect?: string | undefined;
  /** Every registry root selector (to list framed roots on the page that none of them matches). */
  readonly registryRoots?: readonly string[] | undefined;
  /** Elements the surface must show, painted (the content check). */
  readonly requires?: readonly string[] | undefined;
  /** The always-on HUD controls (the hud check); absent: not checked. */
  readonly hud?: readonly string[] | undefined;
};
export type CheckName = "outside" | "overflow" | "border" | "portrait" | "overlap" | "empty" | "controls" | "content" | "hud" | "ornament";
export const CHECKS: readonly CheckName[] = ["outside", "overflow", "border", "portrait", "overlap", "empty", "controls", "content", "hud", "ornament"];
export type Failure = { readonly check: CheckName; readonly what: string; readonly path: string; readonly px: number; readonly rect: Box | null; readonly text?: string };
/** A failure's key across runs (the baseline): its check and element path, not its px. */
export const failureKey = (failure: Pick<Failure, "check" | "path">): string => `${failure.check}|${failure.path}`;
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
  const pathOf = (element: Element) => [...element.classList].slice(0, 2).join(".") || element.tagName.toLowerCase();
  const registered = (element: Element) => (spec.registryRoots ?? []).some(selector => { try { return element.matches(selector); } catch { return false; } });
  const unregistered = spec.registryRoots === undefined ? [] : [...document.querySelectorAll("[data-frame]")]
    .filter(element => shown(element) && !registered(element)).map(element => ({ kind: element.getAttribute("data-frame") ?? "", path: pathOf(element) }));
  const root = [...document.querySelectorAll(spec.root)].find(shown);
  if (root === undefined) return { found: false, viewport, expectFound, unregistered };
  const px = (value: string) => { const number = parseFloat(value); return Number.isFinite(number) ? number : 0; };
  const boxOf = (rect: DOMRect) => ({ l: rect.left, t: rect.top, r: rect.right, b: rect.bottom });
  const sides = (style: CSSStyleDeclaration, name: "border" | "padding") => name === "border"
    ? { t: px(style.borderTopWidth), r: px(style.borderRightWidth), b: px(style.borderBottomWidth), l: px(style.borderLeftWidth) }
    : { t: px(style.paddingTop), r: px(style.paddingRight), b: px(style.paddingBottom), l: px(style.paddingLeft) };
  // The frame's inset per side: the border width, or (a surface not on the frame tokens) the border image's width less
  // its outset when that is more.
  const frameInset = (element: Element) => {
    const style = getComputedStyle(element); const border = sides(style, "border");
    if (element.hasAttribute("data-frame") || style.borderImageSource === "none" || style.borderImageSource === "") return border;
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

  // The region the children of `container` can show in (null: they do not show), with the innermost clipper, and the
  // part of it the scrolling clippers alone leave (what is cut there is scrolled out, and reachable).
  type Region = { readonly box: Box; readonly clipper: Clipper | null; readonly scrollBox: Box } | null;
  const regions = new Map<Element, Region>();
  const everywhere = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
  const cut = (a: Box, b: Box, x: boolean, y: boolean) => ({ l: x ? Math.max(a.l, b.l) : a.l, r: x ? Math.min(a.r, b.r) : a.r, t: y ? Math.max(a.t, b.t) : a.t, b: y ? Math.min(a.b, b.b) : a.b });
  const paddingBox = (element: Element, style: CSSStyleDeclaration) => {
    const rect = element.getBoundingClientRect(); const border = sides(style, "border");
    return { l: rect.left + border.l, t: rect.top + border.t, r: rect.right - border.r, b: rect.bottom - border.b };
  };
  // The root's scrolling ancestors (the slot a part sits in, the tree's pan): the root's region starts from what they show.
  const ancestors = ((): NonNullable<Region> => {
    let box: Box = everywhere; let clipper: Clipper | null = null;
    for (let node = root.parentElement; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node); const x = scrolls(style.overflowX); const y = scrolls(style.overflowY);
      if (!x && !y) continue;
      box = cut(box, paddingBox(node, style), x, y);
      clipper ??= { path: pathOf(node), scroll: true, ellipsis: false };
    }
    return { box, clipper, scrollBox: box };
  })();
  const regionFor = (container: Element): Region => {
    const cached = regions.get(container); if (cached !== undefined) return cached;
    const outer: Region = container === root ? ancestors : container.parentElement === null ? null : regionFor(container.parentElement);
    let region: Region = outer;
    if (outer !== null) {
      const style = getComputedStyle(container);
      if (style.clip !== "auto" && style.clip !== "" || style.clipPath !== "none" || container.classList.contains("visually-hidden")) region = null;
      else if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        const padding = paddingBox(container, style);
        const ellipsis = style.textOverflow === "ellipsis" || (style.getPropertyValue("-webkit-line-clamp") || "none") !== "none";
        region = { box: cut(outer.box, padding, style.overflowX !== "visible", style.overflowY !== "visible"),
          clipper: { path: path(container), scroll: scrolls(style.overflowX) || scrolls(style.overflowY), ellipsis },
          scrollBox: cut(outer.scrollBox, padding, scrolls(style.overflowX), scrolls(style.overflowY)) };
      }
    }
    regions.set(container, region); return region;
  };
  const visiblePart = (box: Box, region: Region) => {
    if (region === null) return null;
    const part = cut(box, region.box, true, true);
    return part.r - part.l > 0.5 && part.b - part.t > 0.5 ? part : null;
  };
  /** A scrolling clipper cuts `box` (beyond its view by more than half a pixel). */
  const scrollCut = (box: Box, region: Region) => region !== null
    && (box.l < region.scrollBox.l - 0.5 || box.t < region.scrollBox.t - 0.5 || box.r > region.scrollBox.r + 0.5 || box.b > region.scrollBox.b + 0.5);

  const CONTROL = 'button, summary, [role="button"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="slider"], [role="treeitem"], a[href], input:not([type="hidden"]), select, textarea';
  const ART = /url\(/;
  const items: Item[] = []; const controlIndex = new Map<Element, number>(); const itemIndex = new Map<Element, number>();
  const around = (element: Element | null, index: Map<Element, number>) => { const found: number[] = []; for (let node = element; node !== null && node !== root.parentElement; node = node.parentElement) { const at = index.get(node); if (at !== undefined) found.push(at); } return found; };
  const controlsAround = (element: Element | null) => around(element, controlIndex);
  const visibleBorder = (style: CSSStyleDeclaration) => (["Top", "Right", "Bottom", "Left"] as const).some(side =>
    px(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1 && !["none", "hidden"].includes(style.getPropertyValue(`border-${side.toLowerCase()}-style`))
    && !/rgba\([^)]*,\s*0\)|transparent/.test(style.getPropertyValue(`border-${side.toLowerCase()}-color`)));
  const scrollers: { path: string; axis: "x" | "y"; over: number; allowed: boolean }[] = [];
  // The frame's own parts on the frame tokens: a data-frame root's direct child laid over its whole border box (a frame
  // layer at -safe, a painting's art-space wrapper). Not content itself (the wrapper's children are) and not overflow.
  const rootBox = root.getBoundingClientRect();
  const framePart = (element: Element) => {
    if (element.parentElement !== root || !root.hasAttribute("data-frame") || getComputedStyle(element).position !== "absolute") return false;
    const box = element.getBoundingClientRect();
    return Math.abs(box.left - rootBox.left) <= 1 && Math.abs(box.top - rootBox.top) <= 1 && Math.abs(box.right - rootBox.right) <= 1 && Math.abs(box.bottom - rootBox.bottom) <= 1;
  };
  for (const element of root.querySelectorAll("*")) {
    if (excluded(element) || framePart(element) || !shown(element)) continue;
    const style = getComputedStyle(element); const tag = element.tagName.toLowerCase();
    const full = boxOf(element.getBoundingClientRect());
    const region = element.parentElement === null ? null : regionFor(element.parentElement);
    const allowed = (spec.scrollParts ?? []).some(selector => element.matches(selector));
    if (scrolls(style.overflowX) && element.scrollWidth > element.clientWidth + 1) scrollers.push({ path: path(element), axis: "x", over: element.scrollWidth - element.clientWidth, allowed });
    if (scrolls(style.overflowY) && element.scrollHeight > element.clientHeight + 1) scrollers.push({ path: path(element), axis: "y", over: element.scrollHeight - element.clientHeight, allowed });
    const base = { path: path(element), rect: visiblePart(full, region), full, clipper: region?.clipper ?? null, slot: inSlot(element),
      inControls: controlsAround(element.parentElement), within: around(element.parentElement, itemIndex), scrollCut: scrollCut(full, region) };
    const at = items.length;
    if (element.matches(CONTROL)) {
      const kit = element.classList.contains("ui-btn") || element.classList.contains("ui-select-option") || element.closest(".ui-select, .ui-slider, .ui-number") !== null; // NAT-4: the kit NumberField is a kit control
      // A list option is a row of its framed list (a surface, as the skin audit counts it).
      const variant = element.classList.contains("ui-select-option") ? "surface"
        : [...element.classList].find(name => name.startsWith("ui-btn--") && ["surface", "quiet", "primary", "secondary", "danger", "icon", "close", "toggle", "tab"].includes(name.slice(8)))?.slice(8) ?? null;
      controlIndex.set(element, items.length);
      items.push({ ...base, kind: "control", text: (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
        // LM-R1: a fixed-height face drawn on the control's ::before (the kit select's 40 px Wave 38 face in a 44 px target).
        control: { kit, art: ART.test(style.borderImageSource) || ART.test(style.backgroundImage) || ART.test(getComputedStyle(element, "::before").borderImageSource), variant } });
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
    // The block the lines are laid out in (an inline parent's lines are its block's).
    let blockElement: Element = parent;
    while (blockElement !== root && blockElement.parentElement !== null && ["inline", "contents"].includes(getComputedStyle(blockElement).display)) blockElement = blockElement.parentElement;
    const blockStyle = getComputedStyle(blockElement); const blockRect = boxOf(blockElement.getBoundingClientRect());
    const blockBorder = sides(blockStyle, "border"); const blockPadding = sides(blockStyle, "padding");
    const block = { l: blockRect.l + blockBorder.l + blockPadding.l, t: blockRect.t + blockBorder.t + blockPadding.t, r: blockRect.r - blockBorder.r - blockPadding.r, b: blockRect.b - blockBorder.b - blockPadding.b };
    if (lines.length === 0) continue;
    const full = { l: Math.min(...lines.map(line => line.l)), t: Math.min(...lines.map(line => line.t)), r: Math.max(...lines.map(line => line.r)), b: Math.max(...lines.map(line => line.b)) };
    const region = regionFor(parent);
    if (region === null) continue;
    const visibleLines = lines.map(line => visiblePart(line, region)).filter((line): line is Box => line !== null);
    const wholeLines = lines.filter(line => !scrollCut(line, region)).map(line => visiblePart(line, region)).filter((line): line is Box => line !== null);
    items.push({ kind: "text", path: path(parent), text: text.slice(0, 40), rect: visiblePart(full, region), full, clipper: region.clipper, slot: inSlot(parent),
      lines: visibleLines, wholeLines, scrollCut: scrollCut(full, region), block, inControls: controlsAround(parent), within: around(parent, itemIndex) });
  }

  // The measured root, for the audit's second capture (scripts/uiGeometryAudit.mjs takes the attribute off again).
  for (const other of document.querySelectorAll("[data-geometry-root]")) other.removeAttribute("data-geometry-root");
  root.setAttribute("data-geometry-root", "");
  const requires = (spec.requires ?? []).map(selector => {
    const matches = [...root.querySelectorAll(selector)].filter(element => !excluded(element));
    const visible = matches.filter(shown);
    // The visible part (an inner scroller clips it; scrolled out, wholly or in part, it is reachable and not judged).
    const parts = visible.map(element => { const region = element.parentElement === null ? null : regionFor(element.parentElement); const box = boxOf(element.getBoundingClientRect());
      return scrollCut(box, region) ? null : visiblePart(box, region); });
    return { selector, rects: parts.filter((part): part is Box => part !== null).slice(0, 12), hidden: matches.length - visible.length, scrolled: parts.filter(part => part === null).length };
  });
  // The HUD: hit tests with every element taking the pointer (a container that lets clicks through still paints).
  const hud: NonNullable<Collected["hud"]>[number][] = [];
  if (spec.hud !== undefined && spec.hud.length > 0) {
    const force = document.createElement("style"); force.textContent = "* { pointer-events: auto !important; }"; document.head.append(force);
    const clear = (element: Element) => { const style = getComputedStyle(element);
      return /^(transparent|rgba\([^)]*,\s*0\))$/.test(style.backgroundColor) && style.backgroundImage === "none" && (style.borderImageSource === "none" || style.borderImageSource === "") && !visibleBorder(style); };
    const grid = (box: Box) => { const points: [number, number][] = [];
      for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.25, 0.5, 0.75]) points.push([box.l + (box.r - box.l) * fx, box.t + (box.b - box.t) * fy]); return points; };
    const inView = ([x, y]: [number, number]) => x >= 0 && y >= 0 && x < viewport.w && y < viewport.h;
    const rootStyleNow = getComputedStyle(root);
    const rootPaints = !clear(root) || (rootStyleNow.borderImageSource !== "none" && rootStyleNow.borderImageSource !== "");
    // What of the surface shows: the part its scrolling ancestors (and, for its children, itself) leave in view.
    const surfaceBoxes = (rootPaints ? [visiblePart(rootRect, ancestors)] : [...root.children].filter(shown).map(child => visiblePart(boxOf(child.getBoundingClientRect()), regionFor(root))))
      .filter((box): box is Box => box !== null);
    try {
      for (const selector of spec.hud) for (const element of document.querySelectorAll(selector)) {
        if (!shown(element) || root.contains(element) || element.contains(root)) continue;
        const rect = boxOf(element.getBoundingClientRect());
        // A root that paints nothing (a click-through container: the event chips' rail) is judged by its shown children.
        const meets = surfaceBoxes.map(box => ({ l: Math.max(rect.l, box.l), t: Math.max(rect.t, box.t), r: Math.min(rect.r, box.r), b: Math.min(rect.b, box.b) }))
          .filter(box => box.r - box.l > 1 && box.b - box.t > 1);
        if (meets.length === 0) continue;
        const shared = meets.reduce((a, b) => ((b.r - b.l) * (b.b - b.t) > (a.r - a.l) * (a.b - a.t) ? b : a));
        const over = grid(shared).filter(inView).some(([x, y]) => { const top = document.elementFromPoint(x, y); return top !== null && element.contains(top); });
        const outside = grid(rect).filter(inView).filter(([x, y]) => x < shared.l || x > shared.r || y < shared.t || y > shared.b);
        const live = (outside.length > 0 ? outside : grid(rect).filter(inView)).some(([x, y]) => {
          const top = document.elementFromPoint(x, y); if (top === null) return false;
          if (element.contains(top)) return true;
          // A full-screen layer that paints nothing (a click-through backdrop) leaves the HUD in sight.
          for (let node: Element | null = top; node !== null && !node.contains(element); node = node.parentElement) if (!clear(node)) return false;
          return true;
        });
        hud.push({ path: pathOf(element), rect, shared, over, live });
      }
    } finally { force.remove(); }
  }
  let portrait: Collected["portrait"] = null;
  if (spec.portraitRing !== undefined && spec.painting !== undefined) {
    // One scale, the width's (a painting 9-slice only grows downward): the ring from the top-left.
    const ringSpec = spec.portraitRing; const scale = (rootRect.r - rootRect.l) / spec.painting.art.w;
    const ring = { cx: rootRect.l + ringSpec.cx * scale, cy: rootRect.t + ringSpec.cy * scale, r: ringSpec.r * scale };
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
    root: { path: path(root), rect: rootRect, frame: frameInset(root), padding: sides(rootStyle, "padding"), kind: root.getAttribute("data-frame"),
      overflow: { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight }, border: sides(rootStyle, "border"), visible: visiblePart(rootRect, ancestors),
      paints: !/^(transparent|rgba\([^)]*,\s*0\))$/.test(rootStyle.backgroundColor) || rootStyle.backgroundImage !== "none" || visibleBorder(rootStyle)
        || (rootStyle.borderImageSource !== "none" && rootStyle.borderImageSource !== ""),
      scrollable: { x: scrolls(rootStyle.overflowX), y: scrolls(rootStyle.overflowY) } },
    layer: layerRect, slot: slotRect, items, scrollers, portrait, siblings, unregistered, requires, hud,
  };
}

/** In the page: when its scrolling ancestors show nothing of the root (the family tree pans to the lord, its banner far
 * to the side; a gallery's row below the fold), scroll them — as a player does — until its start is in their view, on
 * each axis it is out on. A root partly in view is left as it opened. Returns whether anything scrolled. */
export function revealSurface(selector: string): boolean {
  const root = [...document.querySelectorAll(selector)].find(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; });
  if (root === undefined) return false;
  const scrolls = (value: string) => value === "auto" || value === "scroll" || value === "overlay";
  let moved = false;
  for (let node = root.parentElement; node !== null; node = node.parentElement) {
    const style = getComputedStyle(node);
    const box = root.getBoundingClientRect(); const view = node.getBoundingClientRect();
    if (scrolls(style.overflowX) && (box.right <= view.left || box.left >= view.right)) { node.scrollLeft += box.left - view.left; moved = true; }
    if (scrolls(style.overflowY) && (box.bottom <= view.top || box.top >= view.bottom)) { node.scrollTop += box.top - view.top; moved = true; }
  }
  return moved;
}

/** Chrome's text rects use whole-pixel ascent and descent, so a line box centred on the glyph box can sit up to 1 px from
 * where layout put it (R15: the welcome's 18.4 px title — a 26 px content area, ascent 21 / descent 5 — came out 0.7 px
 * above its own block, which starts on the inner box). A line past its block's content box by less than 1 px, top or
 * bottom, is moved back by that much; a line further out (a block overflowing its height) is left as measured, and so
 * is a text a clipper cuts (evaluateSurface: its cut edge is the clipper's). */
export function snapLine(line: Box, block: Box | undefined): Box {
  if (block === undefined) return line;
  const above = block.t - line.t; const below = line.b - block.b;
  if (above > 0 && above < 1 && below + above <= 0.01) return { ...line, t: line.t + above, b: line.b + above };
  if (below > 0 && below < 1 && above + below <= 0.01) return { ...line, t: line.t - below, b: line.b - below };
  return line;
}

/** In the page: wait (at most `ms`) until every image the root and its descendants paint with — background and border
 * images — has loaded and decoded. On a busy machine a drawer's frame and its tabs' button art arrived after the paint
 * pass had taken its captures (R15: slot.ledger.* tabs "not painted" in 5 of 1,812 cells): the audit measures the
 * surface as it settles, not its first frames. Returns how many images it waited for. */
export async function surfaceArtLoaded({ selector, ms }: { readonly selector: string; readonly ms: number }): Promise<number> {
  const roots = [...document.querySelectorAll(selector)];
  const urls = new Set<string>();
  for (const root of roots) for (const element of [root, ...root.querySelectorAll("*")]) {
    const style = getComputedStyle(element);
    for (const value of [style.backgroundImage, style.borderImageSource]) for (const match of value.matchAll(/url\("?([^")]+)"?\)/g)) urls.add(match[1]!);
  }
  const decode = (url: string) => { const image = new Image(); image.src = url; return image.decode().catch(() => undefined); };
  await Promise.race([Promise.all([...urls].map(decode)), new Promise(done => setTimeout(done, ms))]);
  return urls.size;
}

/** Changed pixels below which an element counts as not painted (the second capture hides it; the same render otherwise). */
export const PAINTED_MIN = 3;

/** Pure: the checks for one collected surface. */
export function evaluateSurface(collected: Collected, spec: MeasureSpec): Evaluation {
  const zero = { outside: 0, overflow: 0, border: 0, portrait: 0, overlap: 0, empty: 0, controls: 0, content: 0, hud: 0, ornament: 0 };
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
  // On the frame tokens: the content box, the padding counted as at least the gap.
  const tokens = root.kind !== null && root.kind !== undefined;
  const rootInner = inset(rootSafe, tokens ? { t: Math.max(root.padding.t, spec.gap), r: Math.max(root.padding.r, spec.gap), b: Math.max(root.padding.b, spec.gap), l: Math.max(root.padding.l, spec.gap) } : even(spec.gap));
  let safe = rootSafe; let inner = rootInner;
  // A flat (or unframed) root that paints nothing is a container: no frame to keep off, so its border box is the inner
  // box, no gap. Decided from computed style: a container that gets a fill or a rule is measured with the gap again.
  const container = root.paints === false && (root.kind === null || root.kind === undefined || root.kind === "flat") && !collected.layer && spec.frame !== "painting";
  // A content slot is the art's content rect with the gap already inside it: its box is the inner box.
  if (container) { safe = root.rect; inner = root.rect; }
  else if (!tokens && spec.frame === "layer" && collected.slot) { safe = meet(rootSafe, collected.slot.rect); inner = meet(rootSafe, collected.slot.rect); }
  else if (!tokens && spec.frame === "layer" && collected.layer) { safe = meet(rootSafe, inset(collected.layer.rect, collected.layer.frame)); inner = meet(rootInner, inset(safe, even(spec.gap))); }
  else if (!tokens && spec.frame === "painting" && spec.painting !== undefined) {
    // One scale, the width's; the bottom edge keeps its distance from the bottom (a taller card keeps its bottom rule).
    const scale = (root.rect.r - root.rect.l) / spec.painting.art.w; const art = spec.painting.safe; const size = spec.painting.art;
    const painted = { l: root.rect.l + art.x * scale, t: root.rect.t + art.y * scale, r: root.rect.r - (size.w - art.x - art.w) * scale, b: root.rect.b - (size.h - art.y - art.h) * scale };
    safe = meet(rootSafe, painted); inner = meet(rootInner, inset(painted, even(spec.gap)));
  }
  // On an axis the surface scrolls, its content scrolls under the gap: the limit is the padding box there.
  const scrollX = spec.scroll === "x" || spec.scroll === "xy"; const scrollY = spec.scroll === "y" || spec.scroll === "xy";
  const allowed = { l: scrollX ? rootSafe.l : inner.l, r: scrollX ? rootSafe.r : inner.r, t: scrollY ? rootSafe.t : inner.t, b: scrollY ? rootSafe.b : inner.b };
  const failures: Failure[] = [];
  const fail = (check: CheckName, what: string, path: string, px: number, rect: Box | null, text?: string) =>
    failures.push(text === undefined ? { check, what, path, px: round(px), rect } : { check, what, path, px: round(px), rect, text });
  // Text line boxes back on their block where the whole-pixel glyph box put them a fraction off it (snapLine).
  // Only a text no clipper cuts: a cut line's edge is the clipper's, not the glyph box's estimate.
  const uncut = (item: Item) => item.rect !== null && Math.max(Math.abs(item.rect.l - item.full.l), Math.abs(item.rect.t - item.full.t), Math.abs(item.rect.r - item.full.r), Math.abs(item.rect.b - item.full.b)) < 0.01;
  const items = (collected.items ?? []).map(item => {
    if (item.kind !== "text" || item.block === undefined || !uncut(item)) return item;
    const snap = (line: Box) => snapLine(line, item.block);
    const lines = (item.lines ?? []).map(snap);
    const span = (boxes: readonly Box[]) => boxes.length === 0 ? null : { l: Math.min(...boxes.map(line => line.l)), t: Math.min(...boxes.map(line => line.t)), r: Math.max(...boxes.map(line => line.r)), b: Math.max(...boxes.map(line => line.b)) };
    return { ...item, lines, ...(item.wholeLines === undefined ? {} : { wholeLines: item.wholeLines.map(snap) }), full: snap(item.full), rect: item.rect === null ? null : span(lines) ?? item.rect };
  });

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
  // b. overflow: the root where it may not scroll, parts that scroll where none may, text cut without an ellipsis. The
  // root's scroll overflow counts only as far as content reaches past its padding box: a frame layer or an art-space
  // wrapper covers the border box by design (the frame tokens) and is no overflow.
  const padEdge = { r: root.rect.r - (root.border?.r ?? 0), b: root.rect.b - (root.border?.b ?? 0) };
  const reach = items.reduce((far, item) => item.rect === null || item.slot ? far : { r: Math.max(far.r, item.rect.r), b: Math.max(far.b, item.rect.b) }, { r: -Infinity, b: -Infinity });
  const overflowX = Math.min(root.overflow.x, Math.max(0, reach.r - padEdge.r)); const overflowY = Math.min(root.overflow.y, Math.max(0, reach.b - padEdge.b));
  if (!scrollX && overflowX > 1) fail("overflow", root.scrollable.x ? "the surface scrolls sideways" : "content wider than the surface", root.path, overflowX, root.rect);
  if (!scrollY && overflowY > 1) fail("overflow", root.scrollable.y ? "the surface scrolls" : "content taller than the surface", root.path, overflowY, root.rect);
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
  // Only the part of it the root's scrolling ancestors show holds content to count.
  const CELL = 4; const area = root.visible === undefined || root.visible === null ? inner : meet(inner, root.visible);
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
  // h. content: the required elements are there, shown and painted; no text or control is painted over; and some of the
  // surface's text and controls is in view at all (a drawer whose view collapsed to its frame shows none of it, and a
  // scroller with no view leaves nothing to scroll to — R15: the population drawer opened 0 px tall).
  const content = items.filter(item => (item.kind === "text" || item.kind === "control") && !item.slot);
  if (content.length > 0 && content.every(item => item.rect === null)) fail("content", "none of the surface's text and controls is in view (its view is collapsed or scrolled away)", root.path, 0, root.rect);
  for (const required of collected.requires ?? []) {
    if (required.rects.length === 0 && (required.scrolled ?? 0) > 0) continue;
    if (required.rects.length === 0) { fail("content", required.hidden > 0 ? `required ${required.selector} not shown (no size, hidden or transparent)` : `required ${required.selector} missing`, required.selector, 0, null); continue; }
    const changed = collected.paint?.requires[(collected.requires ?? []).indexOf(required)];
    if (changed !== undefined && changed.length > 0 && changed.every(count => count < PAINTED_MIN)) fail("content", `required ${required.selector} not painted (covered by another layer)`, required.selector, 0, required.rects[0]!);
  }
  if (collected.paint !== undefined) items.forEach((item, index) => {
    const changed = collected.paint!.items[index];
    if (changed === null || changed === undefined || item.rect === null || changed >= PAINTED_MIN) return;
    fail("content", `${item.kind} not painted (covered by another layer)`, item.path, 0, item.rect, item.text);
  });
  // i. hud: an always-on HUD control over the surface, or under it while it is live.
  for (const hit of collected.hud ?? []) {
    const size = overlapOf(hit.shared, hit.shared);
    if (hit.over) fail("hud", "the HUD paints over the surface", hit.path, Math.min(size.w, size.h), hit.shared);
    else if (hit.live) fail("hud", "the surface covers a live HUD control", hit.path, Math.min(size.w, size.h), hit.shared);
  }
  // j. ornament: a drawn line through a text's line box.
  for (const crossing of collected.paint?.crossings ?? []) {
    const item = items[crossing.item]; if (item === undefined) continue;
    fail("ornament", `text crossed by a drawn ${crossing.axis === "x" ? "vertical" : "horizontal"} line`, item.path, 0, crossing.line, item.text);
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
