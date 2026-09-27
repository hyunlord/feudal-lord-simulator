import { useId, useRef, useState } from "react";

import { UiIcon } from "../UiIcon";

/**
 * UI-KIT-1 select: no native `<select>` (it keeps the browser's square look). A secondary button shows the chosen
 * option; pressing it opens a light-framed list panel under it.
 *
 * - Mouse and touch: press the button, then an option. Pressing outside the list (it loses the focus) closes it.
 * - Keyboard (and a pad driving the focus): on the button ArrowDown / ArrowUp / Enter / Space open the list at the
 *   chosen option; in the list ArrowUp / ArrowDown / Home / End move, Enter / Space choose, Escape closes, Tab closes
 *   and moves on. The keys the list uses do not reach the map (its camera keys).
 * - Screen readers: a `listbox` of `option`s with `aria-selected`, the active option as `aria-activedescendant`, the
 *   button `aria-haspopup="listbox"` with `aria-expanded`, and `label` as the accessible name.
 */
export type SelectOption<V extends string | number> = { readonly value: V; readonly label: string };

export function Select<V extends string | number>(props: {
  readonly value: V;
  readonly options: readonly SelectOption<V>[];
  readonly onChange: (value: V) => void;
  readonly label: string;
  readonly className?: string;
  readonly disabled?: boolean;
}) {
  const { value, options, onChange, label, className, disabled = false } = props;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const id = useId();
  const chosen = Math.max(0, options.findIndex(option => option.value === value));
  const show = (index: number) => {
    setActive(index);
    setOpen(true);
    // The list mounts on this render; focus it after.
    queueMicrotask(() => list.current?.focus());
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    close(true);
    if (option !== undefined && option.value !== value) onChange(option.value);
  };
  const optionId = (index: number) => `${id}-option-${index}`;
  return (
    <div className={className === undefined ? "ui-select" : `${className} ui-select`} data-open={open ? "true" : undefined}
      onBlur={event => { if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" className="ui-btn ui-btn--secondary ui-select-trigger"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-label={`${label}: ${options[chosen]?.label ?? ""}`}
        disabled={disabled}
        onClick={() => { if (open) close(false); else show(chosen); }}
        onKeyDown={event => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          event.stopPropagation();
          show(chosen);
        }}>
        <span className="ui-select-value">{options[chosen]?.label ?? ""}</span>
        <UiIcon sheet="action" cell="up" size={24} className="ui-select-chevron" />
      </button>
      {open ? (
        <ul ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={optionId(active)}
          className="ui-frame ui-frame--light ui-select-list"
          onKeyDown={event => {
            const last = options.length - 1;
            const move: Readonly<Record<string, number>> = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last };
            if (event.key in move) setActive(move[event.key]!);
            else if (event.key === "Enter" || event.key === " ") choose(active);
            else if (event.key === "Escape") close(true);
            else if (event.key === "Tab") { setOpen(false); return; }
            else return;
            event.preventDefault();
            event.stopPropagation();
          }}>
          {options.map((option, index) => (
            <li key={String(option.value)} id={optionId(index)} role="option" aria-selected={index === chosen}
              className={`ui-select-option${index === active ? " ui-select-option--active" : ""}`}
              onPointerMove={() => { if (index !== active) setActive(index); }}
              onClick={() => choose(index)}>
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
