import DOMPurify from 'dompurify';

export function isSafeLink(value: string): boolean {
  const allowed =
    /^(https?:\/\/|mailto:|tel:)/i.test(value.trim()) &&
    !Array.from(value.trim()).some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    );
  if (!allowed) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.hostname.length > 0
      : url.pathname.length > 0;
  } catch {
    return false;
  }
}

export function sanitizeEditorHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'strike',
      'code',
      'pre',
      'mark',
      'span',
      'h1',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'a',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'data-color',
      'data-size',
      'data-type',
      'data-checked',
      'start',
      'colspan',
      'rowspan',
      'style',
    ],
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(sanitized, 'text/html');
  for (const element of document.body.querySelectorAll<HTMLElement>('[style]')) {
    const styles = element.style;
    const tags = [
      [/bold|[6-9]00/.test(styles.fontWeight), 'strong'],
      [styles.fontStyle === 'italic', 'em'],
      [styles.textDecoration.includes('underline'), 'u'],
      [styles.textDecoration.includes('line-through'), 's'],
    ] as const;
    for (const [enabled, tag] of tags) {
      if (!enabled) continue;
      const wrapper = document.createElement(tag);
      wrapper.append(...element.childNodes);
      element.append(wrapper);
    }
    element.removeAttribute('style');
  }
  for (const anchor of document.body.querySelectorAll('a')) {
    if (!isSafeLink(anchor.getAttribute('href') ?? '')) anchor.removeAttribute('href');
  }
  return document.body.innerHTML;
}
