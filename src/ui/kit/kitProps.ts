/** `ui-btn ui-btn--primary ui-btn--md` from a base class and its set modifiers. */
export function kitClass(base: string, modifiers: readonly (string | undefined | false)[]): string {
  return [base, ...modifiers.filter((modifier): modifier is string => typeof modifier === "string" && modifier !== "").map(modifier => `${base}--${modifier}`)].join(" ");
}

/**
 * The host element's attributes in the order the caller wrote them (tests read the markup with ordered patterns),
 * without the kit's own props: the caller's class first and the kit's classes after it, a `type` in front when the
 * caller gave none. No attribute of the kit's own: a kit part is known by its `ui-*` class (the skin audit reads it).
 */
export function orderedHostProps(props: object, kitKeys: ReadonlySet<string>, kitClasses: string,
  defaults: Readonly<Record<string, string>> = { type: "button" }): Record<string, unknown> {
  const host: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) if (!(key in props)) host[key] = value;
  if (!("className" in props)) host.className = kitClasses;
  for (const [key, value] of Object.entries(props)) {
    if (kitKeys.has(key)) continue;
    host[key] = key === "className" ? (typeof value === "string" && value !== "" ? `${value} ${kitClasses}` : kitClasses) : value;
  }
  return host;
}
