import designStyles from '@/styles/globals.css?raw';

export function lightToken(name: string): string {
  const value = designStyles.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`Missing export design token: ${name}`);
  return value;
}
