export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
export function button(text: string, action: () => void, primary = false): HTMLButtonElement {
  const node = element('button', text, primary ? 'primary' : '');
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function section(title: string): HTMLElement {
  const node = element('section');
  node.append(element('h2', title));
  return node;
}
