/**
 * Resize and re-encode listing photos in the browser before Supabase upload
 * to stay within free-tier storage limits.
 */

export const MAX_LISTING_PHOTOS = 5;

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

export async function compressListingImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await loadImageElement(file);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
  if (!blob || blob.size === 0) return file;

  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
