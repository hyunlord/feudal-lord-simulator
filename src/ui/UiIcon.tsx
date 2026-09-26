import { uiIconStyle, type UiIconCell, type UiIconSheet, type UiIconSize } from "./uiArt";

/** One painted UI icon (UX-2). Decorative unless `label` is given (then it is an image with that name). */
export function UiIcon<S extends UiIconSheet>({ sheet, cell, size = 24, label, className }: {
  readonly sheet: S;
  readonly cell: UiIconCell<S>;
  readonly size?: UiIconSize;
  readonly label?: string;
  readonly className?: string;
}) {
  const classes = className === undefined ? "ui-icon" : `ui-icon ${className}`;
  return label === undefined
    ? <span className={classes} aria-hidden="true" data-icon={`${sheet}.${String(cell)}`} style={uiIconStyle(sheet, cell, size)} />
    : <span className={classes} role="img" aria-label={label} data-icon={`${sheet}.${String(cell)}`} style={uiIconStyle(sheet, cell, size)} />;
}
