import { describe, expect, it } from 'vitest';
import { Commands, subsetToBase64, subsetToBinary, toBase64 } from './font-subset-shared-stub';

describe('font subsetting stand-in', () => {
  it('speaks the same commands as the code it replaces', () => {
    expect(Commands.Subset).toBe('SUBSET');
  });

  it('turns a font into a woff2 data URL', async () => {
    const bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 255]);
    expect(await toBase64(bytes)).toBe(`data:font/woff2;base64,${btoa('wOF2\0\u0001\u0002ÿ')}`);
    expect(await toBase64(bytes.buffer)).toBe(await toBase64(bytes));
    expect(await subsetToBase64(bytes.buffer)).toBe(await toBase64(bytes));
  });

  it('handles a font far larger than one chunk without running out of arguments', async () => {
    const bytes = new Uint8Array(1_000_000).map((_, index) => index % 251);
    const url = await toBase64(bytes);
    const decoded = Uint8Array.from(
      atob(url.slice('data:font/woff2;base64,'.length)),
      (character) => character.charCodeAt(0),
    );
    expect(decoded.length).toBe(bytes.length);
    expect(decoded[999_999]).toBe(bytes[999_999]);
    expect(decoded[40_000]).toBe(bytes[40_000]);
  });

  it('keeps the whole font when asked to subset it', async () => {
    const font = new Uint8Array([1, 2, 3]).buffer;
    expect(await subsetToBinary(font)).toBe(font);
  });
});
