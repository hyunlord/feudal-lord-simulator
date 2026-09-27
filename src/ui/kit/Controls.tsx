import type { CSSProperties, ReactNode } from "react";

import { UiIcon } from "../UiIcon";
import { Button } from "./Button";
import { kitClass } from "./kitProps";

/**
 * UI-KIT-1 on/off controls, slider, tabs, chips, tooltip and divider. Frames are the P0 art named by the tokens in
 * uiSkin.css; the states are drawn in code (kit.css).
 */

/** An on/off switch: a parchment track with a wax seal that slides to the right when on (`role="switch"`). */
export function Toggle(props: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly className?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly isolate?: boolean | undefined;
  readonly [data: `data-${string}`]: string | undefined;
}) {
  const { checked, onChange, label, className, disabled, isolate, ...data } = props;
  return (
    <Button {...data} className={className === undefined ? "ui-toggle" : `${className} ui-toggle`} variant="secondary" role="switch" aria-checked={checked}
      disabled={disabled} isolate={isolate} onPress={() => onChange(!checked)}>
      <span className="ui-toggle-track" aria-hidden="true"><span className="ui-toggle-seal" /></span>
      <span className="ui-toggle-label">{label}</span>
    </Button>
  );
}

/** A checkbox: a seal-shaped box that shows the prediction sheet's tick when checked (`role="checkbox"`). */
export function Checkbox(props: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly className?: string | undefined;
  readonly disabled?: boolean | undefined;
}) {
  const { checked, onChange, label, className, disabled } = props;
  return (
    <Button className={className === undefined ? "ui-checkbox" : `${className} ui-checkbox`} variant="quiet" role="checkbox" aria-checked={checked}
      disabled={disabled} onPress={() => onChange(!checked)}>
      <span className="ui-checkbox-box" aria-hidden="true">{checked ? <UiIcon sheet="prediction" cell="ok" size={24} /> : null}</span>
      <span className="ui-checkbox-label">{label}</span>
    </Button>
  );
}

/** A slider: a parchment groove with a seal thumb (the range input, dressed in kit.css; its keys never reach the map). */
export function Slider(props: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly valueText?: string;
  readonly className?: string | undefined;
  readonly disabled?: boolean | undefined;
}) {
  const { value, min, max, step, onChange, label, valueText, className, disabled } = props;
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input type="range" className={className === undefined ? "ui-slider" : `${className} ui-slider`}
      min={min} max={max} step={step} value={value} aria-label={label} aria-valuetext={valueText} disabled={disabled}
      style={{ "--ui-slider-fill": `${fill}%` } as CSSProperties}
      onChange={event => onChange(Number(event.currentTarget.value))} />
  );
}

export type TabItem<K extends string> = { readonly key: K; readonly label: ReactNode; readonly disabled?: boolean };

/** Tabs (P0 `tab_build_base`): a `tablist` whose chosen tab is `aria-selected`; ArrowLeft / ArrowRight move between them. */
export function Tabs<K extends string>(props: {
  readonly tabs: readonly TabItem<K>[];
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly label: string;
  readonly className?: string | undefined;
  readonly tabClassName?: string;
}) {
  const { tabs, selected, onSelect, label, className, tabClassName } = props;
  const index = tabs.findIndex(tab => tab.key === selected);
  const step = (delta: number) => {
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next !== undefined && next.disabled !== true) onSelect(next.key);
  };
  return (
    <div role="tablist" aria-label={label} className={className === undefined ? "ui-tabs" : `${className} ui-tabs`}
      onKeyDown={event => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        event.stopPropagation();
        step(event.key === "ArrowRight" ? 1 : -1);
      }}>
      {tabs.map(tab => (
        <Button key={tab.key} className={tabClassName} variant="tab" role="tab" aria-selected={tab.key === selected} tabIndex={tab.key === selected ? 0 : -1}
          disabled={tab.disabled} onPress={() => onSelect(tab.key)}>
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

/** A chip (P0 `chip_condition_base`): a condition, count or tag. `tone` colours the text by status. */
export function Chip(props: { readonly children: ReactNode; readonly tone?: "ok" | "warn" | "block" | "info"; readonly className?: string | undefined }) {
  const { children, tone, className } = props;
  const classes = kitClass("ui-chip", [tone]);
  return <span className={className === undefined ? classes : `${className} ${classes}`}>{children}</span>;
}

/** A tooltip body (P0 `frame_tooltip`). It is shown by its owner on focus or press as well as hover (no hover-only text). */
export function Tooltip(props: { readonly children: ReactNode; readonly id?: string; readonly className?: string }) {
  const { children, id, className } = props;
  return <span role="tooltip" id={id} className={className === undefined ? "ui-tooltip" : `${className} ui-tooltip`}>{children}</span>;
}

/** A manuscript rule (P0 `divider_manuscript_*`). */
export function Divider(props: { readonly tone?: "light" | "dark"; readonly className?: string }) {
  const classes = kitClass("ui-divider", [props.tone === "dark" ? "dark" : undefined]);
  return <hr className={props.className === undefined ? classes : `${props.className} ${classes}`} />;
}
