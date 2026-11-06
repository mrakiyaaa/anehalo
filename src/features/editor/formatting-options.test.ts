/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isTextColor, isTextSize, textColors, textSizes } from './formatting-options';
const themeStyles = readFileSync('src/styles/globals.css', 'utf8');
const editorStyles = readFileSync('src/styles/editor-tools.css', 'utf8').replace(/\s+/g, ' ');

describe('semantic formatting tokens', () => {
  it('maps all eight colors to theme tokens available in both themes', () => {
    expect(textColors).toHaveLength(8);
    const light = themeStyles.split(":root[data-theme='dark']")[0] ?? '';
    const dark = themeStyles.split(":root[data-theme='dark']")[1]?.split(':root {')[0] ?? '';
    for (const color of textColors) {
      expect(light).toContain(`${color.token}:`);
      expect(dark).toContain(`${color.token}:`);
      expect(editorStyles).toContain(
        `[data-color='${color.name}'] { color: var(${color.token}); }`,
      );
      expect(isTextColor(color.name)).toBe(true);
    }
    expect(isTextColor('#ff0000')).toBe(false);
    expect(isTextColor('url(javascript:bad)')).toBe(false);
  });
  it('maps semantic sizes and rejects arbitrary CSS', () => {
    for (const size of textSizes) {
      expect(themeStyles).toContain(`${size.token}:`);
      expect(editorStyles).toContain(
        `[data-size='${size.name}'] { font-size: var(${size.token}); }`,
      );
      expect(isTextSize(size.name)).toBe(true);
    }
    expect(isTextSize('42px')).toBe(false);
  });
});
