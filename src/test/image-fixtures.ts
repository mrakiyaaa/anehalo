import { crc32, deflateSync } from 'node:zlib';

const excalidrawMime = 'application/vnd.excalidraw+json';

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** The text Excalidraw's "Embed scene" stores for a drawing, here uncompressed. */
function embeddedPayload(sceneJson: string): string {
  return JSON.stringify({
    version: '1',
    encoding: 'bstring',
    compressed: false,
    encoded: sceneJson,
  });
}

/** A valid 1×1 PNG, with a drawing embedded the way "Embed scene" does when one is given. */
export function pngImage(sceneJson?: string): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const text =
    sceneJson === undefined
      ? []
      : [chunk('tEXt', Buffer.from(`${excalidrawMime}\0${embeddedPayload(sceneJson)}`, 'latin1'))];
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
    ...text,
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A small SVG, with a drawing embedded the way "Embed scene" does when one is given. */
export function svgImage(sceneJson?: string): Uint8Array {
  const metadata =
    sceneJson === undefined
      ? ''
      : [
          '<!-- svg-source:excalidraw -->',
          '<metadata>',
          `<!-- payload-type:${excalidrawMime} -->`,
          '<!-- payload-version:2 -->',
          '<!-- payload-start -->',
          Buffer.from(embeddedPayload(sceneJson), 'utf8').toString('base64'),
          '<!-- payload-end -->',
          '</metadata>',
        ].join('');
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${metadata}<rect width="10" height="10"/></svg>`,
  );
}
