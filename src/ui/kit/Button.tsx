import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { kitClass, orderedHostProps } from "./kitProps";

/**
 * UI-KIT-1 button. Every clickable control in src/ui is one of these (or a kit part built on it); the ESLint rule
 * `no-restricted-syntax` forbids a bare `<button>` outside src/ui/kit.
 *
 * - `variant` picks the P0 art (uiSkin.css tokens): primary · secondary · quiet · danger · icon (square) · toggle
 *   (secondary art, `aria-pressed` shows the pressed state) · tab (oak) · surface (a cell, row or card of a framed
 *   strip or panel: the frame around it is its skin, the kit only adds the states).
 * - `size` sets padding and type (sm · md · lg); without it the screen's own layout rules keep their sizes.
 * - States are code, not art: hover brightness, pressed 1 px, the focus ring, disabled grey (kit.css).
 * - Input rules R2–R4 (scripts/inputIntentBoundary.ts): the handlers take no event. `onPress()` is a press;
 *   `onPressAt(at)` also gets where it landed (for strips and maps: the point and the button's box, `keyboard` for an
 *   Enter or Space press). `isolate` stops the press reaching the elements behind (a modal over the map).
 * - The caller's attributes render in the caller's order, its class first, so markup contracts in tests still hold.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "icon" | "toggle" | "tab" | "surface";
export type ButtonSize = "sm" | "md" | "lg";
export type PressPoint = { readonly clientX: number; readonly clientY: number; readonly rect: DOMRect; readonly keyboard: boolean };

type HostAttributes = { [K in keyof ButtonHTMLAttributes<HTMLButtonElement> as K extends `on${string}` ? never : K]?: ButtonHTMLAttributes<HTMLButtonElement>[K] | undefined };

export type ButtonProps = HostAttributes & {
  readonly children?: ReactNode;
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  /** A surface or icon on a dark strip (the HUD, the build drawer). */
  readonly tone?: "light" | "dark" | undefined;
  readonly onPress?: (() => void) | undefined;
  readonly onPressAt?: ((at: PressPoint) => void) | undefined;
  readonly isolate?: boolean | undefined;
  /** The pointer came over (true) or left (false); never the only way to reach what it shows (focus does too). */
  readonly onHover?: ((hovering: boolean) => void) | undefined;
  readonly onFocusChange?: ((focused: boolean) => void) | undefined;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
};

const KIT_KEYS = new Set(["variant", "size", "tone", "onPress", "onPressAt", "isolate", "onHover", "onFocusChange", "children"]);

export function Button(props: ButtonProps) {
  const { variant = "secondary", size, tone, onPress, onPressAt, isolate = false, onHover, onFocusChange, children } = props;
  const classes = kitClass("ui-btn", [variant, size, tone === "dark" ? "dark" : undefined]);
  const host = orderedHostProps(props, KIT_KEYS, classes, "button");
  return (
    <button {...host}
      onMouseEnter={onHover === undefined ? undefined : () => onHover(true)}
      onMouseLeave={onHover === undefined ? undefined : () => onHover(false)}
      onFocus={onFocusChange === undefined ? undefined : () => onFocusChange(true)}
      onBlur={onFocusChange === undefined ? undefined : () => onFocusChange(false)}
      onPointerDown={event => { if (isolate) event.stopPropagation(); }}
      onClick={event => {
        if (isolate) event.stopPropagation();
        if (onPressAt !== undefined) {
          onPressAt({ clientX: event.clientX, clientY: event.clientY, rect: event.currentTarget.getBoundingClientRect(), keyboard: event.detail === 0 });
        }
        onPress?.();
      }}>
      {children}
    </button>
  );
}

/** A square icon button (P0 `button_icon_square_base`); `label` is its accessible name (and tooltip). */
export function IconButton(props: Omit<ButtonProps, "variant" | "aria-label"> & { readonly label: string }) {
  const { label, ...rest } = props;
  return <Button aria-label={label} title={rest.title ?? label} {...rest} variant="icon" />;
}
