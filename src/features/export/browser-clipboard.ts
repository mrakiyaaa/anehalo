export async function writeBrowserClipboard(text: string, html?: string): Promise<void> {
  let clipboardError: unknown = null;
  try {
    if (html !== undefined && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await clipboardWithTimeout(
        navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]),
      );
      return;
    }
    if (html === undefined && navigator.clipboard?.writeText) {
      await clipboardWithTimeout(navigator.clipboard.writeText(text));
      return;
    }
  } catch (error) {
    clipboardError = error;
  }
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const activeElement = document.activeElement;
  const copy = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
    if (html !== undefined) event.clipboardData?.setData('text/html', html);
  };
  document.addEventListener('copy', copy);
  try {
    if (!document.execCommand('copy'))
      throw new Error('Clipboard access is unavailable.', { cause: clipboardError });
  } finally {
    document.removeEventListener('copy', copy);
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
    if (activeElement instanceof HTMLElement) activeElement.focus();
  }
}

async function clipboardWithTimeout(operation: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Clipboard permission did not respond.')), 1500);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
