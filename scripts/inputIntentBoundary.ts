import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAst } from "rolldown/parseAst";

// Gate 1 of B9 (input intents): a static check that player input reaches the game only as input intents.
//  R1  DOM input listeners (mouse, pointer, wheel, key, touch, click, contextmenu) are bound only in src/input.
//  R2  In src/render, src/ui and src/App.tsx no DOM / React input event object is handed to a function, directly or
//      inside an object literal. Allowed: reading its fields (event.clientX) and DOM-only helpers, i.e. local
//      functions that use it only for preventDefault / stopPropagation / stopImmediatePropagation.
//  R3  A host element's on* handler (JSX or createElement props) is an inline function or a local function that
//      takes no event or is a DOM-only helper: a bare reference like onClick={onClose} would receive the event.
//  R4  Host element handlers do not call the game's tool / speed setters or dispatch directly: tools and speeds go
//      through the `toolSelect` / `speed` intents (PlatformServices.input).
// Usage: npx tsx scripts/inputIntentBoundary.ts  (prints violations as JSON; exit 1 when there are any)

export type Violation = { readonly file: string; readonly line: number; readonly rule: "R1" | "R2" | "R3" | "R4"; readonly text: string };

const ROOT = new URL("..", import.meta.url).pathname;
const SCANNED = ["src/render", "src/ui", "src/App.tsx"];
const INPUT_EVENTS = /^(mouse\w*|pointer\w*|touch\w*|key\w*|wheel|click|dblclick|contextmenu)$/;
const EVENT_TYPE = /\b\w*(Mouse|Pointer|Wheel|Keyboard|Touch)Event\b/;
const DOM_ONLY_METHODS = new Set(["preventDefault", "stopPropagation", "stopImmediatePropagation"]);
const SINKS = new Set(["setSpeed", "setSelectedTool", "setZoneTool", "dispatch"]);

type Node = { readonly type: string; readonly start: number; readonly end: number; readonly [key: string]: unknown };

function files(path: string): string[] {
  const absolute = join(ROOT, path);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute).flatMap(name => files(join(path, name))).filter(file => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"));
}

function children(node: Node): Node[] {
  const out: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) { for (const item of value) if (item !== null && typeof item === "object" && typeof (item as Node).type === "string") out.push(item as Node); }
    else if (value !== null && typeof value === "object" && typeof (value as Node).type === "string") out.push(value as Node);
  }
  return out;
}

const isFunction = (node: Node | null | undefined): node is Node => node !== undefined && node !== null
  && (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration");
const nameOf = (node: unknown): string | null => {
  const value = node as Node | null;
  if (value === null || value === undefined) return null;
  if (value.type === "Identifier" || value.type === "JSXIdentifier") return value.name as string;
  return null;
};

export function checkSource(file: string, source: string): Violation[] {
  const program = parseAst(source, { lang: file.endsWith(".tsx") ? "tsx" : "ts" }) as unknown as Node;
  const parents = new Map<Node, Node>();
  const all: Node[] = [];
  const walk = (node: Node) => { all.push(node); for (const child of children(node)) { parents.set(child, node); walk(child); } };
  walk(program);
  const lineOf = (offset: number) => source.slice(0, offset).split("\n").length;
  const violations: Violation[] = [];
  const report = (node: Node, rule: Violation["rule"]) => violations.push({ file, line: lineOf(node.start), rule, text: source.slice(node.start, Math.min(node.end, node.start + 90)).replace(/\s+/g, " ") });

  // Local functions by name (const x = () => ..., function x() {}).
  const locals = new Map<string, Node>();
  for (const node of all) {
    if (node.type === "FunctionDeclaration" && nameOf(node.id) !== null) locals.set(nameOf(node.id) as string, node);
    if (node.type === "VariableDeclarator" && nameOf(node.id) !== null && isFunction(node.init as Node)) locals.set(nameOf(node.id) as string, node.init as Node);
  }
  const paramName = (fn: Node, index = 0): string | null => nameOf((fn.params as Node[] | undefined)?.[index]);
  const bodyUses = (fn: Node, name: string): Node[] => {
    const uses: Node[] = [];
    const visit = (node: Node) => { if (node.type === "Identifier" && node.name === name && parents.get(node) !== fn) uses.push(node); for (const child of children(node)) visit(child); };
    visit(fn.body as Node);
    return uses;
  };
  const domOnlyCache = new Map<Node, boolean>();
  /** Uses its first parameter only as event.preventDefault() / stopPropagation() / stopImmediatePropagation(). */
  const domOnly = (fn: Node): boolean => {
    const cached = domOnlyCache.get(fn);
    if (cached !== undefined) return cached;
    const name = paramName(fn);
    const result = name === null || bodyUses(fn, name).every(use => {
      const member = parents.get(use);
      return member?.type === "MemberExpression" && member.object === use && DOM_ONLY_METHODS.has(nameOf(member.property) ?? "")
        && parents.get(member)?.type === "CallExpression";
    });
    domOnlyCache.set(fn, result);
    return result;
  };
  const hostHandler = (node: Node): boolean => {
    const parent = parents.get(node);
    if (parent?.type === "JSXExpressionContainer") {
      const attribute = parents.get(parent);
      const element = attribute === undefined ? undefined : parents.get(attribute);
      return attribute?.type === "JSXAttribute" && /^on[A-Z]/.test(nameOf(attribute.name) ?? "")
        && element?.type === "JSXOpeningElement" && /^[a-z]/.test(nameOf(element.name) ?? "");
    }
    if (parent?.type === "Property" && parent.value === node && /^on[A-Z]/.test(nameOf(parent.key) ?? "")) {
      const object = parents.get(parent); const call = object === undefined ? undefined : parents.get(object);
      return call?.type === "CallExpression" && /createElement$/.test(source.slice((call.callee as Node).start, (call.callee as Node).end));
    }
    return false;
  };

  for (const node of all) {
    // R1
    if (node.type === "CallExpression" && (node.callee as Node).type === "MemberExpression") {
      const method = nameOf((node.callee as Node).property);
      const first = (node.arguments as Node[])[0];
      if ((method === "addEventListener" || method === "removeEventListener") && first?.type === "Literal" && INPUT_EVENTS.test(String(first.value))) report(node, "R1");
    }
    if (!isFunction(node)) continue;
    const handler = hostHandler(node);
    const typed = ((node.params as Node[]) ?? []).map((param, index) => {
      const annotation = param.typeAnnotation as Node | null | undefined;
      return annotation !== null && annotation !== undefined && EVENT_TYPE.test(source.slice(annotation.start, annotation.end)) ? paramName(node, index) : null;
    }).filter((name): name is string => name !== null);
    const eventNames = new Set([...typed, ...(handler && paramName(node) !== null ? [paramName(node) as string] : [])]);
    // R2
    for (const name of eventNames) {
      if (domOnly(node) && name === paramName(node)) continue;
      for (const use of bodyUses(node, name)) {
        const parent = parents.get(use);
        if (parent?.type === "MemberExpression" && parent.object === use) continue;
        if (parent?.type === "Property" && parent.key === use && parent.value !== use) continue;
        if (parent?.type === "CallExpression" && (parent.arguments as Node[]).includes(use)) {
          const callee = locals.get(nameOf(parent.callee) ?? "");
          if (callee !== undefined && domOnly(callee)) continue;
        }
        report(use, "R2");
      }
    }
    // R4: game setters called straight from a host element handler.
    if (handler) {
      const visit = (inner: Node) => {
        if (inner.type === "CallExpression" && SINKS.has(nameOf(inner.callee) ?? "")) report(inner, "R4");
        for (const child of children(inner)) if (!isFunction(child)) visit(child);
      };
      visit(node.body as Node);
    }
  }
  // R3: host handlers given by reference.
  for (const node of all) {
    if (node.type !== "Identifier" && node.type !== "MemberExpression") continue;
    if (!hostHandler(node)) continue;
    const local = node.type === "Identifier" ? locals.get(node.name as string) : undefined;
    if (local !== undefined && (((local.params as Node[]) ?? []).length === 0 || domOnly(local))) continue;
    report(node, "R3");
  }
  return violations;
}

export function inputIntentViolations(): Violation[] {
  return SCANNED.flatMap(files).flatMap(file => checkSource(relative(ROOT, file), readFileSync(file, "utf8")));
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  const violations = inputIntentViolations();
  console.log(JSON.stringify({ violations: violations.length, list: violations }, null, 2));
  process.exitCode = violations.length === 0 ? 0 : 1;
}
