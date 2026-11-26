// Função autocontida: executada apenas na página autorizada, sem dependências.
export function readPageContent({ mode = 'selection', limit = 8000 } = {}) {
  const excluded = 'script, style, noscript, nav, header, footer, aside, form, input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [hidden], [aria-hidden="true"], [data-private]';
  const isExcluded = (node) => {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !element || Boolean(element.closest(excluded));
  };
  let text = '';
  if (mode === 'selection') {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return { error: 'empty-selection' };
    const range = selection.getRangeAt(0);
    if (isExcluded(selection.anchorNode) || isExcluded(selection.focusNode)) return { error: 'private-selection' };
    // Não importa uma seleção que atravesse formulários ou áreas editáveis.
    const commonRoot = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (Array.from(commonRoot.querySelectorAll('form, input, textarea, [contenteditable]:not([contenteditable="false"]), [data-private]'))
      .some((element) => range.intersectsNode(element))) return { error: 'private-selection' };
    text = selection.toString().trim();
  } else {
    const root = document.querySelector('main, [role="main"], article') || document.body;
    if (!root) return { error: 'empty-page' };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent.trim() || isExcluded(node)) return NodeFilter.FILTER_REJECT;
        const element = node.parentElement;
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.visibility === 'collapse' || !element.getClientRects().length) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    let length = 0;
    while (walker.nextNode()) {
      const part = walker.currentNode.textContent.trim().replace(/\s+/g, ' ');
      length += part.length + (parts.length ? 1 : 0);
      parts.push(part);
      if (length > limit) break;
    }
    text = parts.join('\n');
  }
  if (!text) return { error: mode === 'selection' ? 'empty-selection' : 'empty-page' };
  return {
    text: text.slice(0, limit),
    truncated: text.length > limit,
    title: document.title,
    url: location.origin + location.pathname,
    mode,
  };
}
