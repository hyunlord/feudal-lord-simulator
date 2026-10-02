import type { CSSProperties } from "react";

/**
 * NAT-4 number field (LU-D7: the new-game map number): a text input that takes digits only, on the reading parchment
 * (P0 `frame_tooltip`, uiKit.css `.ui-number`) — the kit's only text entry; the skin audit lets `.ui-number` through as it
 * does the slider. `value` is the digits shown; each edit hands the caller the new digits (anything else typed or
 * pasted is dropped, at most `maxDigits`). Numeric keypad on touch (`inputMode`). Its keys never reach the map (the
 * camera keys), Enter leaves the field, and with `isolate` a press on it stays with it (a modal over the map, the
 * welcome's dismiss layer). `invalid` marks it for assistive tech and draws the seal-red rule; `describedBy` names the
 * line that says why.
 */
export function NumberField(props: {
  readonly value: string;
  readonly onChange: (digits: string) => void;
  readonly label: string;
  readonly maxDigits: number;
  readonly invalid?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly className?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly isolate?: boolean | undefined;
  readonly [data: `data-${string}`]: string | undefined;
}) {
  const { value, onChange, label, maxDigits, invalid = false, describedBy, className, disabled, isolate = false, ...data } = props;
  return (
    <input {...data} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" spellCheck={false} maxLength={maxDigits}
      className={className === undefined ? "ui-number" : `${className} ui-number`} style={{ "--ui-number-digits": maxDigits } as CSSProperties}
      aria-label={label} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} disabled={disabled} value={value}
      onChange={event => onChange(numberFieldDigits(event.currentTarget.value, maxDigits))}
      onPointerDown={event => { if (isolate) event.stopPropagation(); }}
      onClick={event => { if (isolate) event.stopPropagation(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
      }} />
  );
}

/** The digits of `text`, at most `maxDigits` (what the field keeps of a keystroke or a paste). */
export function numberFieldDigits(text: string, maxDigits: number): string {
  return text.replace(/[^0-9]/g, "").slice(0, maxDigits);
}
