import type { ReactNode } from "react";

import type { ButtonVariant } from "./Button";

/**
 * UI-KIT-1 disclosure: `<details>` whose `<summary>` wears the button art (secondary by default, `icon` for a square
 * help seal). The summary is the control; its open state is the browser's (`onToggle(open)` reports it, no event).
 */
export function Disclosure(props: {
  readonly summary: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string | undefined;
  readonly summaryClassName?: string | undefined;
  readonly summaryLabel?: string | undefined;
  readonly variant?: Extract<ButtonVariant, "secondary" | "quiet" | "icon" | "surface"> | undefined;
  readonly tone?: "light" | "dark" | undefined;
  readonly onToggle?: ((open: boolean) => void) | undefined;
}) {
  const { summary, children, className, summaryClassName, summaryLabel, variant = "secondary", tone, onToggle } = props;
  const kit = `ui-btn ui-btn--${variant}${tone === "dark" ? " ui-btn--dark" : ""} ui-disclosure-summary`;
  return (
    <details className={className === undefined ? "ui-disclosure" : `${className} ui-disclosure`}
      onToggle={onToggle === undefined ? undefined : event => onToggle(event.currentTarget.open)}>
      <summary className={summaryClassName === undefined ? kit : `${summaryClassName} ${kit}`} aria-label={summaryLabel}>{summary}</summary>
      {children}
    </details>
  );
}
