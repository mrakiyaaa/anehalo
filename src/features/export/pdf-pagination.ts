export interface PrintInterval {
  readonly top: number;
  readonly bottom: number;
}
export interface PrintChunk {
  readonly start: number;
  readonly end: number;
}

export function paginatePrintContent(
  height: number,
  pageHeight: number,
  intervals: readonly PrintInterval[],
): readonly PrintChunk[] {
  const chunks: PrintChunk[] = [];
  let start = 0;
  while (start < height - 0.5) {
    let end = Math.min(height, start + pageHeight);
    let crossing = intervals.filter(
      (interval) =>
        interval.top < end - 0.5 && interval.bottom > end + 0.5 && interval.bottom > start,
    );
    while (crossing.length) {
      const previous = end;
      end = Math.min(...crossing.map((interval) => interval.top));
      if (end <= start + 0.5) {
        end = Math.max(...crossing.map((interval) => interval.bottom));
        break;
      }
      crossing = intervals.filter(
        (interval) =>
          interval.top < end - 0.5 && interval.bottom > end + 0.5 && interval.bottom > start,
      );
      if (end === previous) break;
    }
    chunks.push({ start, end });
    start = end;
  }
  return chunks;
}

export function printIntervals(root: HTMLElement): readonly PrintInterval[] {
  const origin = root.getBoundingClientRect().top;
  const intervals: PrintInterval[] = [];
  const add = (rectangle: DOMRect) => {
    if (rectangle.height > 0.5)
      intervals.push({ top: rectangle.top - origin, bottom: rectangle.bottom - origin });
  };
  for (const element of root.querySelectorAll('img,tr')) add(element.getBoundingClientRect());
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || node.parentElement?.closest('tr')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rectangle of range.getClientRects()) add(rectangle);
  }
  return intervals;
}
