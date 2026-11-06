export function installCanvasFontMetricsFix(): () => void {
  const style = document.createElement('style');
  // Tailwind's block images skew html2canvas's hidden one-pixel font measurement image.
  style.textContent =
    'body > div[style*="visibility: hidden"] > img[width="1"][height="1"] { display: inline !important; }';
  document.head.append(style);
  return () => style.remove();
}
