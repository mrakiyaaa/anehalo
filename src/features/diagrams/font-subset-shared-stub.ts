/**
 * Replaces Excalidraw's "subset-shared" chunk (see the plain-excalidraw-fonts plugin in
 * vite.config.ts). The real one subsets fonts with a WebAssembly build that creates functions
 * from strings, which the app's Content Security Policy rightly refuses, so every SVG export
 * logged errors before falling back to whole fonts. Exports embed the whole font files (split by
 * unicode range, so only the parts the text needs) with no code that needs `eval`.
 */
export const Commands = { Subset: 'SUBSET' } as const;

// Kept below the engine's limit on arguments for String.fromCharCode.
const CHUNK_BYTES = 0x8000;

export function toBase64(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_BYTES));
  return Promise.resolve(`data:font/woff2;base64,${btoa(binary)}`);
}

/** The font as it is: whole files are embedded instead of subsetted ones. */
export const subsetToBinary = (buffer: ArrayBuffer): Promise<ArrayBuffer> =>
  Promise.resolve(buffer);

export const subsetToBase64 = (buffer: ArrayBuffer): Promise<string> => toBase64(buffer);
