import { randomBytes } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

/** A rectangle with every field Excalidraw writes, so restore() changes nothing. */
function rectangle(index: number) {
  const column = index % 100;
  const row = Math.floor(index / 100);
  return {
    id: `box-${index}`,
    type: 'rectangle',
    x: column * 60,
    y: row * 60,
    width: 40,
    height: 40,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: index + 1,
    version: 1,
    versionNonce: index + 7,
    isDeleted: false,
    boundElements: null,
    updated: 1731000000000,
    link: null,
    locked: false,
  };
}

function image(index: number, fileId: string) {
  return {
    ...rectangle(100_000 + index),
    id: `picture-${index}`,
    type: 'image',
    x: index * 420,
    y: -500,
    width: 400,
    height: 400,
    status: 'saved',
    fileId,
    scale: [1, 1],
    crop: null,
  };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** A valid PNG of random pixels; random data does not compress, so its size is predictable. */
export function noisePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows: Buffer[] = [];
  for (let row = 0; row < height; row++)
    rows.push(Buffer.concat([Buffer.from([0]), randomBytes(width * 4)]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 1 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function excalidrawFile(elements: readonly object[], files: Record<string, object> = {}): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    appState: { viewBackgroundColor: '#ffffff', gridSize: 20, gridStep: 5, gridModeEnabled: false },
    files,
  });
}

export function smallDiagram(elementCount = 3): string {
  return excalidrawFile(Array.from({ length: elementCount }, (_, index) => rectangle(index)));
}

/** 5,000 shapes and 5 embedded images of about 2 MB each, for the save-performance test. */
export function largeDiagram(): string {
  const files: Record<string, object> = {};
  const images = Array.from({ length: 5 }, (_, index) => {
    const fileId = `photo-${index}`;
    files[fileId] = {
      id: fileId,
      mimeType: 'image/png',
      dataURL: `data:image/png;base64,${noisePng(724, 724).toString('base64')}`,
      created: 1731000000000,
      lastRetrieved: 1731000000000,
    };
    return image(index, fileId);
  });
  return excalidrawFile(
    [...Array.from({ length: 5_000 }, (_, index) => rectangle(index)), ...images],
    files,
  );
}

export interface SavedDiagramFile {
  readonly type: string;
  readonly source: string;
  readonly elements: readonly {
    readonly id: string;
    readonly type: string;
    readonly isDeleted: boolean;
  }[];
  readonly files: Record<string, unknown>;
}

export function readDiagramFile(text: string | null): SavedDiagramFile {
  if (text === null) throw new Error('The diagram file does not exist.');
  return JSON.parse(text) as SavedDiagramFile;
}
