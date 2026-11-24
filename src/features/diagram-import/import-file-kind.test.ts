import { describe, expect, it } from 'vitest';
import { hasPngSignature, importFileKind, importTitle } from './import-file-kind';

describe('import file kinds', () => {
  it('knows the three importable types by extension, in any letter case', () => {
    expect(importFileKind('Plan.excalidraw')).toBe('excalidraw');
    expect(importFileKind('Plan.EXCALIDRAW')).toBe('excalidraw');
    expect(importFileKind('Plan.excalidraw.png')).toBe('png');
    expect(importFileKind('Plan.svg')).toBe('svg');
  });

  it('refuses everything else', () => {
    for (const name of ['notes.md', 'photo.jpg', 'drawing.json', 'no-extension', 'png'])
      expect(importFileKind(name)).toBeNull();
  });

  it('recognises a PNG by its signature', () => {
    expect(
      hasPngSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe(true);
    expect(hasPngSignature(new TextEncoder().encode('<svg></svg>'))).toBe(false);
    expect(hasPngSignature(new Uint8Array())).toBe(false);
  });
});

describe('import titles', () => {
  it('keeps the original file name as the title, without its extension', () => {
    expect(importTitle('Release flow.excalidraw')).toBe('Release flow');
    expect(importTitle('Release flow.png')).toBe('Release flow');
    expect(importTitle('v1.2 plan.svg')).toBe('v1.2 plan');
  });

  it('drops the .excalidraw excalidraw.com puts before .png and .svg', () => {
    expect(importTitle('Architecture.excalidraw.png')).toBe('Architecture');
    expect(importTitle('Architecture.excalidraw.svg')).toBe('Architecture');
  });

  it('never leaves an unusable name', () => {
    expect(importTitle('.png')).toBe('Untitled diagram');
    expect(importTitle('a:b?.excalidraw')).toBe('ab');
    expect(importTitle('con.excalidraw')).toBe('_con');
  });
});
