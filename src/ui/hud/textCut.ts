// NAT-4 (QA-022): whether a clamped text shows less than it holds — a line-clamped body taller inside than its box, or
// a one-line ellipsis title wider inside than its box. The 1 px slack absorbs sub-pixel rounding of the line boxes.

export type TextBox = Readonly<{ scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number }>;

export function textCut(box: TextBox | null): boolean {
  if (box === null) return false;
  return box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
}
