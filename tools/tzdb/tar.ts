import { gunzipSync } from 'node:zlib';

/**
 * The regular files of a gzipped tar archive (POSIX ustar), by name. Enough for IANA's release tarballs, which hold
 * only regular files at the top level; anything else in an archive is passed over. The archive ends at the first
 * header without a name (the zero blocks tar writes at the end, or the end of the data).
 */
export function readTarGz(archive: Buffer): Map<string, Buffer> {
  const tar = gunzipSync(archive);
  const files = new Map<string, Buffer>();
  const text = (from: number, length: number) => tar.subarray(from, from + length).toString('utf8').split('\0')[0] as string;
  for (let at = 0; text(at, 100) !== ''; ) {
    const name = text(at, 100);
    const size = Number.parseInt(text(at + 124, 12), 8);
    const type = text(at + 156, 1);
    const prefix = text(at + 345, 155);
    if (type === '0' || type === '') files.set(prefix === '' ? name : `${prefix}/${name}`, tar.subarray(at + 512, at + 512 + size));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
