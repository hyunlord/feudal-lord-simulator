import type { CSSProperties, ReactNode, Ref } from "react";

import { kitClass } from "./kitProps";

/**
 * UI-KIT-1 frames: the P0 9-slices every panel, card and modal wears (uiSkin.css `--art-frame-*`).
 *   light · dark (panels) · objective (goal cards; `state` complete / warn) · advisor (the steward; `state` warn) ·
 *   modal · tooltip · record (chronicle and ledger records: the light frame's manuscript edge on a toast-weight body).
 * `Panel` is a region, `Card` an item in a list, `Modal` a dialog (`role="dialog"`, `aria-modal`, its title as the name).
 */
export type FrameKind = "light" | "dark" | "objective" | "advisor" | "modal" | "tooltip" | "record";

type FrameProps = {
  readonly kind?: FrameKind | undefined;
  readonly state?: "complete" | "warn" | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly children?: ReactNode;
  readonly id?: string;
  readonly role?: string;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-live"?: "polite" | "assertive" | "off";
  readonly tabIndex?: number;
  readonly ref?: Ref<HTMLElement>;
  readonly [data: `data-${string}`]: string | number | boolean | undefined;
};

function frameProps(props: FrameProps, part: string, fallback: FrameKind) {
  const { kind = fallback, state, className, children: _children, ref: _ref, ...rest } = props;
  const classes = kitClass("ui-frame", [kind, state === undefined ? undefined : `${kind}-${state}`]);
  return { ...rest, className: className === undefined ? classes : `${className} ${classes}`, "data-ui-kit": part };
}

export function Panel(props: FrameProps & { readonly as?: "section" | "div" | "aside" | "nav" }) {
  const { as: Tag = "section", ref, ...rest } = props;
  return <Tag ref={ref as never} {...frameProps(rest, "panel", "light")}>{props.children}</Tag>;
}

export function Card(props: FrameProps & { readonly as?: "article" | "div" | "li" }) {
  const { as: Tag = "article", ref, ...rest } = props;
  return <Tag ref={ref as never} {...frameProps(rest, "card", "record")}>{props.children}</Tag>;
}

export function Modal(props: FrameProps & { readonly titleId: string }) {
  const { titleId, ref, ...rest } = props;
  return (
    <section ref={ref as never} role="dialog" aria-modal="true" aria-labelledby={titleId} {...frameProps(rest, "modal", "modal")}>
      {props.children}
    </section>
  );
}
