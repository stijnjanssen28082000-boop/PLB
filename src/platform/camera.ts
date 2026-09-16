import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Photo capture and compression (docs/datamodel.md 3.8).
 *
 * Long edge 2048px, JPEG quality 80, target ≤1.5MB. The original is not kept —
 * ten years of storage per inspection is a real cost (concept §11.10) — so the
 * sha256 is taken over the compressed file, which is the file that will be
 * produced in a dispute.
 */

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.8;

export interface CapturedPhoto {
  localPath: string;
  sha256: string;
  takenAt: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export async function capturePhoto(): Promise<CapturedPhoto | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 90,
    correctOrientation: true,
  });

  if (!photo.dataUrl) return null;
  return compress(photo.dataUrl);
}

/** Exported so the dev harness can feed in a file instead of a camera. */
export async function compress(dataUrl: string): Promise<CapturedPhoto> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const buffer = await blob.arrayBuffer();

  return {
    localPath: URL.createObjectURL(blob),
    sha256: await sha256Hex(buffer),
    takenAt: new Date().toISOString(),
    fileSizeBytes: blob.size,
    width,
    height,
  };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the photo'));
    image.src = source;
  });
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
