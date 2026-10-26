import { crc32, inflateRawSync } from 'node:zlib';

/**
 * The files of a zip archive (PKWARE's APPNOTE), by name: enough for GeoNames' dumps, one file each, stored or
 * deflated. The sizes are read from the central directory, since GeoNames writes its entries with a data descriptor
 * (the local header's sizes are zero). Anything else (encryption, zip64, other methods) stops the read.
 */
export function readZip(archive: Buffer): Map<string, Buffer> {
  // The end of central directory record: its signature, searched back from the end past any comment.
  let end = -1;
  for (let at = archive.length - 22; at >= 0 && at >= archive.length - 22 - 0xffff; at -= 1) {
    if (archive.readUInt32LE(at) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end === -1) throw new Error('not a zip archive: no end of central directory');
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i += 1) {
    if (archive.readUInt32LE(at) !== 0x02014b50) throw new Error('a damaged zip: a central directory entry has no signature');
    const flags = archive.readUInt16LE(at + 8);
    const method = archive.readUInt16LE(at + 10);
    const crc = archive.readUInt32LE(at + 16);
    const compressed = archive.readUInt32LE(at + 20);
    const size = archive.readUInt32LE(at + 24);
    const nameLength = archive.readUInt16LE(at + 28);
    const extraLength = archive.readUInt16LE(at + 30);
    const commentLength = archive.readUInt16LE(at + 32);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if ((flags & 1) !== 0) throw new Error(`${name} is encrypted`);
    if (archive.readUInt32LE(local) !== 0x04034b50) throw new Error(`a damaged zip: ${name} has no local header`);
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + compressed);
    let body: Buffer;
    if (method === 0) body = Buffer.from(data);
    else if (method === 8) body = inflateRawSync(data);
    else throw new Error(`${name} is compressed by method ${method}, which isn't read`);
    if (body.length !== size || crc32(body) !== crc) throw new Error(`a damaged zip: ${name} doesn't match its size and checksum`);
    files.set(name, body);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
