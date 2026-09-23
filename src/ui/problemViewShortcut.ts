export function isProblemViewShortcut(code: string, repeat: boolean, editableTarget: boolean): boolean {
  return code === 'KeyO' && !repeat && !editableTarget;
}
