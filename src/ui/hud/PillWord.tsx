/** LS1-14: a cell's word ("인구 ", "식량 ") and its value — lord mode's short pill (1366 px and narrower) hides the word, the
 * cell's picture saying it; the text and the cell's name stay whole. */
export function Worded({ label }: { readonly label: string }) {
  const at = label.indexOf(" ");
  return at < 0 ? <>{label}</> : <><span className="status-pill-word">{label.slice(0, at + 1)}</span>{label.slice(at + 1)}</>;
}
