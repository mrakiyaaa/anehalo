export const textColors = [
  { name: 'sky', label: 'Sky', token: '--sky-fg' },
  { name: 'mint', label: 'Mint', token: '--mint-fg' },
  { name: 'peach', label: 'Peach', token: '--peach-fg' },
  { name: 'lilac', label: 'Lilac', token: '--lilac-fg' },
  { name: 'butter', label: 'Butter', token: '--butter-fg' },
  { name: 'rose', label: 'Rose', token: '--rose-fg' },
  { name: 'slate', label: 'Slate', token: '--editor-slate' },
  { name: 'coral', label: 'Coral', token: '--editor-coral' },
] as const;

export const textSizes = [
  { name: 'small', label: 'Small', token: '--editor-size-small' },
  { name: 'normal', label: 'Normal', token: '--editor-size-normal' },
  { name: 'large', label: 'Large', token: '--editor-size-large' },
  { name: 'huge', label: 'Huge', token: '--editor-size-huge' },
] as const;

export type TextColorName = (typeof textColors)[number]['name'];
export type TextSizeName = (typeof textSizes)[number]['name'];

export function isTextColor(value: unknown): value is TextColorName {
  return textColors.some((color) => color.name === value);
}

export function isTextSize(value: unknown): value is TextSizeName {
  return textSizes.some((size) => size.name === value);
}
