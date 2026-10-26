/**
 * SLATE — headshots.
 *
 * A player brings whatever photo they have: a phone picture nine thousand
 * pixels wide, a tiny avatar, a landscape crop, a portrait one. All of them
 * have to end up as the same thing — one headshot, one shape, one modest file
 * that fits inside a save.
 *
 * Everything in this file is pure arithmetic and validation, deliberately kept
 * apart from the canvas work so the hard part — making any photo fit — can be
 * tested rather than eyeballed.
 */

/**
 * The frame every headshot ends up in.
 *
 * Four by five, because that is the shape a performer's headshot has been since
 * eight-by-tens, and 512 across because it stays sharp on a retina screen at
 * the size it is actually shown while staying small enough to live in a save.
 */
export const PORTRAIT_WIDTH = 512;
export const PORTRAIT_HEIGHT = 640;
export const PORTRAIT_ASPECT = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;

/** Anything larger than this is refused before it is decoded. */
export const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

/** Formats a browser can reliably decode and re-encode. */
export const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif',
] as const;

/** How far in the player may zoom past the fitted size. */
export const MAX_ZOOM = 4;

export interface Placement {
  /** Multiplier on the cover-fit scale. 1 is exactly filling the frame. */
  zoom: number;
  /** Where the image sits, as a fraction of the slack in each direction. */
  offsetX: number;
  offsetY: number;
}

export const CENTRED: Placement = { zoom: 1, offsetX: 0, offsetY: 0 };

export interface DrawRect {
  x: number; y: number; width: number; height: number;
}

/**
 * The two things that go wrong after a file has been accepted, said the same
 * way wherever a photo is framed: the headshot picker and the phone's.
 */
export const CANNOT_ENCODE = 'That photo couldn’t be saved. Try a different one.';
export const CANNOT_DECODE = 'That photo couldn’t be opened. It may be damaged, so try a different one.';

/** Why a file was refused, in words a player can act on. */
export function describeRejection(file: { type: string; size: number; name: string }): string | null {
  if (!file.type.startsWith('image/')) {
    return `${file.name || 'That file'} isn’t an image. Choose a JPEG, PNG or WebP photo.`;
  }
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `${file.type.replace('image/', '').toUpperCase()} images aren’t supported. Try a JPEG, PNG or WebP.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit. Try a smaller one.`;
  }
  if (file.size === 0) {
    return 'That file is empty. Choose a different photo.';
  }
  return null;
}

/**
 * The scale at which an image of these dimensions just covers the frame.
 *
 * Cover rather than contain: a headshot with letterboxing down the sides is
 * not a headshot. The wider-relative-to-the-frame the source is, the more its
 * sides are cropped, and the reverse for a tall one.
 */
export function coverScale(sourceWidth: number, sourceHeight: number, frameWidth = PORTRAIT_WIDTH, frameHeight = PORTRAIT_HEIGHT): number {
  // A decode that went wrong can report zero, a negative, or NaN. None of
  // those may be allowed to become a NaN rectangle further down.
  if (!usableDimension(sourceWidth) || !usableDimension(sourceHeight)) return 1;
  return Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
}

/** Whether a reported dimension is something we can compute with. */
function usableDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * How far the image may slide in each direction before its edge would come
 * inside the frame. Zero on an axis means that axis exactly fits and cannot
 * move — which is what happens to the short side of a cover fit at zoom 1.
 */
export function slack(sourceWidth: number, sourceHeight: number, placement: Placement, frameWidth = PORTRAIT_WIDTH, frameHeight = PORTRAIT_HEIGHT): { x: number; y: number } {
  if (!usableDimension(sourceWidth) || !usableDimension(sourceHeight)) return { x: 0, y: 0 };
  const scale = coverScale(sourceWidth, sourceHeight, frameWidth, frameHeight) * Math.max(1, placement.zoom);
  return {
    x: Math.max(0, (sourceWidth * scale - frameWidth) / 2),
    y: Math.max(0, (sourceHeight * scale - frameHeight) / 2),
  };
}

/** Keeps a placement inside what the image can actually cover. */
export function clampPlacement(placement: Placement): Placement {
  return {
    zoom: Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(placement.zoom) ? placement.zoom : 1)),
    offsetX: Math.min(1, Math.max(-1, Number.isFinite(placement.offsetX) ? placement.offsetX : 0)),
    offsetY: Math.min(1, Math.max(-1, Number.isFinite(placement.offsetY) ? placement.offsetY : 0)),
  };
}

/**
 * Where to draw the source image so it covers the frame under this placement.
 *
 * The result is always at least as large as the frame in both directions and
 * always overlaps it, whatever the source's shape — which is the whole promise
 * of "any photo fits".
 */
export function drawRect(
  sourceWidth: number,
  sourceHeight: number,
  placement: Placement = CENTRED,
  frameWidth = PORTRAIT_WIDTH,
  frameHeight = PORTRAIT_HEIGHT,
): DrawRect {
  const safe = clampPlacement(placement);
  // Fall back to the frame's own shape when the source did not report a usable
  // size, so a broken image yields a plain filled frame rather than nonsense.
  const width0 = usableDimension(sourceWidth) ? sourceWidth : frameWidth;
  const height0 = usableDimension(sourceHeight) ? sourceHeight : frameHeight;

  const scale = coverScale(width0, height0, frameWidth, frameHeight) * safe.zoom;
  const width = width0 * scale;
  const height = height0 * scale;
  const room = slack(width0, height0, safe, frameWidth, frameHeight);

  return {
    x: (frameWidth - width) / 2 + room.x * safe.offsetX,
    y: (frameHeight - height) / 2 + room.y * safe.offsetY,
    width,
    height,
  };
}

/** Roughly how many bytes a data URL of this length occupies once decoded. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}
